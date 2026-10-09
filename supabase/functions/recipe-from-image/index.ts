// Leser en oppskrift fra ett eller flere bilder (foto av kokebok, utklipp
// eller håndskrevet lapp) og returnerer den strukturert, slik at appen kan
// fylle ut oppskriftsskjemaet. Bare innloggede brukere, og maks
// DAILY_IMAGE_LIMIT bilder per bruker per dag (se
// supabase/migration_oppskrift_fra_bilde.sql).
//
// API-nøkkelen ligger som secret på funksjonen (ANTHROPIC_API_KEY) og
// finnes aldri i appen eller i repoet.
import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = 'claude-opus-5-5'
const DAILY_IMAGE_LIMIT = 20
const MAX_IMAGES_PER_REQUEST = 6
// Appen skalerer ned bildene før opplasting; dette er bare et tak.
const MAX_IMAGE_BASE64_CHARS = 4 * 1024 * 1024
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type MediaType = (typeof MEDIA_TYPES)[number]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

const INGREDIENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['amount', 'unit', 'name'],
  properties: {
    amount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    unit: { type: 'string' },
    name: { type: 'string' },
  },
}

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_recipe', 'problem', 'title', 'description', 'servings', 'loose_ingredients', 'components', 'steps'],
  properties: {
    is_recipe: { type: 'boolean' },
    problem: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    servings: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    loose_ingredients: { type: 'array', items: INGREDIENT_SCHEMA },
    components: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'ingredients'],
        properties: {
          name: { type: 'string' },
          ingredients: { type: 'array', items: INGREDIENT_SCHEMA },
        },
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'timer_minutes'],
        properties: {
          text: { type: 'string' },
          timer_minutes: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        },
      },
    },
  },
}

const SYSTEM_PROMPT = `You read recipes from photos for a Norwegian family cookbook app. The photos show one recipe: a cookbook page, a magazine clipping, a screenshot or a handwritten note, often in Norwegian. Several photos are consecutive pages or parts of the same recipe, in order. Your output fills in the app's recipe form, which the user reviews and corrects before saving.

Transcribe what is on the photos. Do not invent ingredients, amounts or steps, and do not translate: keep the language the recipe is written in. Read handwriting as well as you can; where a word or number cannot be read, write [uleselig] in its place so the user sees what to fix.

If the photos do not contain a recipe, or are too blurry or dark to read one, set is_recipe to false and write one short sentence in Norwegian in "problem" saying what is wrong (for example "Bildet viser en kvittering, ikke en oppskrift." or "Bildet er for uskarpt til at teksten kan leses."). Leave the other fields empty. Otherwise set is_recipe to true and "problem" to "".

Fields:
- title: the recipe's name.
- description: the short introduction if the recipe has one, otherwise "".
- servings: number of portions as an integer; for a range use the lower number; null if not stated.
- Ingredients: "amount" is a number (1/2 becomes 0.5, "1 1/2" becomes 1.5, a range becomes the lower number) or null when no amount is given ("salt", "litt olje"). "unit" is one of g, kg, ml, dl, l, ss, ts, stk, boks, klype whenever one of them fits (spiseskje is ss, teskje is ts, a counted item with no unit such as "2 egg" is stk). Other units are written as the recipe has them in short form (fedd, pk, neve, cup), and "unit" is "" when the ingredient has no unit. "name" is the ingredient including any preparation note ("løk, finhakket").
- Ingredient groups: when the recipe lists ingredients under headings (for example "Saus", "Deig", "Marinade"), each heading is one entry in "components", named by the heading without a trailing colon. Ingredients that stand under no heading go in "loose_ingredients". Do not create groups the recipe does not have.
- steps: one entry per step of the method, in order, without step numbers. If the method is one unbroken paragraph, split it into steps at natural points. When a step uses one of the components, end its text with a link to that component: a space, then "@" followed by the component's exact name, for example "Bland alle ingrediensene til marinaden. @Marinade". The app hides these links when showing the step and uses them to show the right ingredients, so the sentence must read correctly without them. Add a link only for components listed in "components".
- timer_minutes: when a step has a stated waiting, cooking, resting or baking time, the number of minutes someone would set a kitchen timer for (a range becomes the lower number; hours become minutes). null when the step has no such time.`

interface ImageInput {
  media_type: MediaType
  data: string
}

function readImages(body: unknown): ImageInput[] | string {
  const images = (body as { images?: unknown } | null)?.images
  if (!Array.isArray(images) || images.length === 0) return 'Ingen bilder ble sendt.'
  if (images.length > MAX_IMAGES_PER_REQUEST) {
    return `Du kan sende maks ${MAX_IMAGES_PER_REQUEST} bilder per oppskrift.`
  }
  const result: ImageInput[] = []
  for (const image of images) {
    const { media_type, data } = (image ?? {}) as { media_type?: unknown; data?: unknown }
    if (
      typeof data !== 'string' ||
      data.length === 0 ||
      !(MEDIA_TYPES as readonly unknown[]).includes(media_type) ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(data)
    ) {
      return 'Et av bildene kunne ikke leses. Prøv å velge det på nytt.'
    }
    if (data.length > MAX_IMAGE_BASE64_CHARS) return 'Et av bildene er for stort.'
    result.push({ media_type: media_type as MediaType, data })
  }
  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Bruk POST.' })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Anon-nøkkelen er også en gyldig JWT, så brukeren må slås opp.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (userError || !user) return json(401, { error: 'Du må være logget inn for å lese oppskrifter fra bilder.' })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY mangler som secret')
    return json(503, { error: 'Bildelesing er ikke satt opp ennå.' })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Ugyldig forespørsel.' })
  }
  const images = readImages(body)
  if (typeof images === 'string') return json(400, { error: images })

  const { data: remaining, error: quotaError } = await supabase.rpc('claim_recipe_scan_quota', {
    p_user_id: user.id,
    p_images: images.length,
    p_limit: DAILY_IMAGE_LIMIT,
  })
  if (quotaError) {
    console.error('Kvotesjekk feilet', quotaError)
    return json(500, { error: 'Noe gikk galt. Prøv igjen om litt.' })
  }
  if (remaining < 0) {
    return json(429, {
      error: `Du har nådd dagens grense på ${DAILY_IMAGE_LIMIT} bilder. Prøv igjen i morgen, eller skriv inn oppskriften selv.`,
    })
  }

  const refund = () => supabase.rpc('refund_recipe_scan_quota', { p_user_id: user.id, p_images: images.length })

  const anthropic = new Anthropic({ apiKey, maxRetries: 1, timeout: 120_000 })
  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((image) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: image.media_type, data: image.data },
            })),
            {
              type: 'text' as const,
              text:
                images.length === 1
                  ? 'Les oppskriften på bildet.'
                  : `Les oppskriften på disse ${images.length} bildene. De hører til samme oppskrift, i denne rekkefølgen.`,
            },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      console.error('Uventet stop_reason', response.stop_reason)
      await refund()
      return json(502, { error: 'Klarte ikke å lese oppskriften. Prøv igjen, eller skriv den inn selv.' })
    }

    const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
    const recipe = JSON.parse(text)

    if (!recipe.is_recipe) {
      return json(422, {
        error: `Fant ingen oppskrift på ${images.length === 1 ? 'bildet' : 'bildene'}. ${recipe.problem ?? ''}`.trim(),
      })
    }
    return json(200, { recipe, remaining })
  } catch (err) {
    await refund()
    if (err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500)) {
      console.error('Claude er opptatt', err)
      return json(503, { error: 'Bildelesingen er opptatt akkurat nå. Prøv igjen om litt.' })
    }
    // Feil nøkkel, tom konto, nådd månedstak og lignende havner her.
    console.error('Bildelesing feilet', err)
    return json(502, { error: 'Klarte ikke å lese oppskriften. Prøv igjen om litt, eller skriv den inn selv.' })
  }
})
