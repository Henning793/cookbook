# Design: Importer oppskrift fra URL

## Mål

La en innlogget familiemedlem lime inn en URL til en oppskrift på nettet,
hente ut tittel/ingredienser/fremgangsmåte automatisk, og få dem forhåndsutfylt
i det eksisterende oppskrift-skjemaet for gjennomsyn og retting før lagring.

## Ikke-mål (bevisst utenfor scope)

- Bilde-import (krever OCR/AI - droppet etter diskusjon med bruker, se
  samtalehistorikk 2026-08-30).
- Automatisk import av oppskriftsbilde fra kilde-siden (`image`-feltet i
  JSON-LD ignoreres i første omgang - brukeren kan fortsatt laste opp eget
  bilde som før).
- Støtte for sider uten strukturerte oppskrift-data (schema.org `Recipe`) -
  disse gir en tydelig feilmelding, ikke et forsøk på fritekst-parsing.
- Automatisk lagring - importert data lander alltid i det vanlige
  gjennomgå-og-rediger-skjemaet, aldri rett i databasen.

## Arkitektur

Nettleseren kan ikke hente en vilkårlig ekstern URL direkte (CORS), så vi
legger til én ny serverløs funksjon som kjører på Netlify (samme
auto-deploy-flyt som resten av appen, ingen nye verktøy):

```
Bruker limer inn URL i appen
        |
        v
Frontend kaller GET /.netlify/functions/import-recipe?url=<url>
        |
        v
Netlify Function: henter siden server-side, leter etter
schema.org "Recipe" i JSON-LD, normaliserer til appens format
        |
        v
Returnerer { title, ingredients, steps } til frontend
        |
        v
RecipeForm (samme delte komponent som "legg til" og "rediger")
forhåndsutfylles - brukeren ser gjennom, retter, og trykker "Lagre oppskrift"
```

Ingen endring i databaseskjema eller RLS - importen produserer bare data som
går inn i den eksisterende "legg til oppskrift"-flyten.

## Backend: `netlify/functions/import-recipe.ts`

**Request:** `GET /.netlify/functions/import-recipe?url=<encoded-url>`

**Steg:**

1. Valider `url`-parameteren:
   - Må være en gyldig, absolutt URL med `http:` eller `https:`-skjema.
   - Avvis URL-er der host åpenbart peker til privat/internt nettverk
     (`localhost`, `127.0.0.1`, `169.254.x.x`, `10.x.x.x`, `172.16-31.x.x`,
     `192.168.x.x`) - enkel SSRF-beskyttelse siden endepunktet er
     uautentisert og offentlig tilgjengelig.
2. Hent siden med `fetch`, tidsavbrudd på 8 sekunder, en beskrivende
   `User-Agent`-header (f.eks. `"Mine oppskrifter-importer/1.0"`), og en
   grense på hvor mye respons-body som leses (f.eks. 2 MB) for å unngå å
   henge på enorme sider.
3. Let etter alle `<script type="application/ld+json">`-tagger i HTML-en.
   Parse hver som JSON (ignorer de som feiler å parse'es). For hvert
   JSON-objekt:
   - Sjekk om det selv har `"@type"` som inneholder `"Recipe"` (kan være
     streng eller array).
   - Hvis objektet har et `"@graph"`-array, let gjennom det etter et
     element med `"@type"` som inneholder `"Recipe"`.
   - Bruk det første treffet.
4. Finnes ingen `Recipe`-data: returner `404` med
   `{ error: "Fant ingen strukturert oppskrift på denne siden. Prøv en annen kilde, eller legg den inn manuelt." }`.
5. Normaliser treffet til appens format:
   - `title` <- `name`.
   - `ingredients` <- hvert element i `recipeIngredient` (array av strenger)
     tolkes med et enkelt mønster: `/^([\d.,/\s]+)?\s*(g|kg|ml|dl|l|ss|ts|stk|boks|klype)?\s*(.+)$/i`.
     Klarer mønsteret å skille ut et tall og en kjent enhet, brukes det;
     ellers legges hele linjen i `name` med `amount: null, unit: ''`.
   - `steps` <- `recipeInstructions` normaliseres til en flat liste med
     tekststrenger:
     - Er det én streng: del på linjeskift.
     - Er det et array av strenger: bruk direkte.
     - Er det et array av `HowToStep`/`HowToSection`-objekter: hent `.text`
       fra hvert `HowToStep` (gå inn i `.itemListElement` for
       `HowToSection`).
6. Returner `200` med `{ title, ingredients, steps }`.

**Feilhåndtering:** nettverksfeil, tidsavbrudd, ugyldig JSON, uventet form på
dataene - fanges og gir alltid en av et lite sett tydelige norske
feilmeldinger, aldri en rå stack trace til klienten.

## Frontend

- I `AddRecipeForm.tsx`: over "+ Legg til oppskrift"-knappen (eller som en
  lenke ved siden av), en ny "Importer fra URL"-lenke/toggle.
- Trykk på den åpner et lite skjema: ett URL-felt + "Hent oppskrift"-knapp.
- Under henting: vis en enkel lastetilstand, deaktiver knappen.
- Ved suksess: bytt til `RecipeForm` med `initial` satt til det som ble
  hentet (`image_url: null`), heading f.eks.
  "Se gjennom importert oppskrift". Brukeren redigerer/fullfører som normalt
  og trykker "Lagre oppskrift" - dette går gjennom nøyaktig samme
  innsettings-kode (og RLS) som manuell registrering.
- Ved feil: vis feilmeldingen fra funksjonen, la brukeren prøve en annen URL
  eller gå til vanlig manuelt skjema.
- Avbryt fra importskjemaet går tilbake til utgangspunktet (samme mønster
  som resten av skjemaene i appen).

## Testing

Prosjektet har ingen automatiserte tester per i dag (bekreftet tidligere i
samtalen), så dette verifiseres manuelt, i tråd med resten av appen:

- Test mot 2-3 ekte oppskrift-URL-er fra store nettsider som er kjent for å
  bruke schema.org Recipe-data.
- Test mot en URL uten strukturerte oppskrift-data - bekreft tydelig
  feilmelding, ingen krasj.
- Test mot en ugyldig/uoppnåelig URL - bekreft tydelig feilmelding.
- Bekreft at `npm run build` fortsatt går gjennom.

## Åpne spørsmål / antakelser

- Netlify Functions kjører som Node.js-funksjoner i dette prosjektet (ingen
  Node-avhengighet er lagt til fra før - `@netlify/functions`-pakken må
  legges til som devDependency, og en `functions`-mappe konfigureres i
  `netlify.toml`).
- Ingrediens-parsingen er best-effort. Det er akseptert og kommunisert til
  brukeren at en del linjer havner som ren tekst i `name`-feltet og må
  justeres manuelt.
