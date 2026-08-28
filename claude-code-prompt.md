# Prompt til Claude Code

Kopier alt under den stiplede linjen og lim inn i Claude Code (kjørt fra
`C:\Projects\cookingapp`-mappen).

---

Jeg bygger en enkel kokebok-app for å lagre mine egne oppskrifter. Målet er
en MVP som er så enkel som mulig: en nettside jeg legger som snarvei på
hjemskjermen på telefonen (Android og iPhone), ikke en native app i App
Store/Play Store.

## Fastlagt teknologistack (ikke endre uten å spørre meg)

- **Frontend:** Vite + React + TypeScript
- **Hosting:** Netlify (auto-deploy fra git)
- **PWA:** `vite-plugin-pwa` for manifest + service worker, slik at appen kan
  installeres på hjemskjerm og cacher tidligere sette oppskrifter for
  offline-visning. Å legge til nye oppskrifter krever fortsatt nett.
- **Backend/database:** Supabase (Postgres + Auth + Storage). Ingen egen
  server.

## Funksjonelle krav

- Alle som har lenken til appen kan **se** oppskriftene (åpen lesetilgang).
- Kun jeg (innlogget via Supabase Auth, e-post/magic link) kan **legge til**
  nye oppskrifter, fra mobilen, via et skjema i appen — ikke ved å redigere
  kode/filer og re-deploye.
- Hver oppskrift har: tittel, ingredienser (fritekst), fremgangsmåte
  (fritekst), og valgfritt bilde (lastes opp til Supabase Storage).
- Oppskriftslisten viser tittel + evt. bilde, og kan åpnes/lukkes (enkel
  liste er nok, ikke behov for egne detaljsider/ruter i MVP).

## Nåværende status

Jeg har allerede fått scaffoldet et grunnoppsett i denne mappen (av en
annen Claude-økt), så sjekk hva som finnes før du begynner:

- `package.json` med `react`, `react-dom`, `@supabase/supabase-js` som
  dependencies, og `vite-plugin-pwa` m.fl. som devDependencies.
- `vite.config.ts` med `VitePWA`-plugin konfigurert (manifest, ikoner,
  `NetworkFirst`-caching mot `*.supabase.co`).
- `src/lib/supabaseClient.ts` — Supabase-klient som leser
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` fra env.
- `src/types.ts` — `Recipe`-typen.
- `src/components/Login.tsx` — innlogging via magic link (e-post).
- `src/components/AddRecipeForm.tsx` — skjema for å legge til oppskrift +
  bilde, laster opp til Supabase Storage-bucket `recipe-images`.
- `src/components/RecipeList.tsx` — viser oppskriftene.
- `src/App.tsx` — kobler det sammen: viser `Login` eller `AddRecipeForm`
  avhengig av innloggingsstatus, og `RecipeList` under.
- `supabase/schema.sql` — SQL for å opprette `recipes`-tabellen, RLS-policyer
  (alle kan lese, kun innlogget kan skrive), og `recipe-images`-bucket.
- `.env.example` — mal for miljøvariablene.
- `netlify.toml` — build-kommando (`npm run build`) og publish-mappe
  (`dist`), pluss SPA-redirect.
- `README.md` — full oppsett-guide (Supabase-konto, env-variabler, lokal
  kjøring, Netlify-deploy, "legg til på hjemskjerm").
- Enkle placeholder-ikoner i `public/icons/` (192px og 512px) — disse bør
  byttes ut med noe finere.

**Dette er IKKE verifisert med `npm install` i denne mappen ennå** (det gikk
bra i et separat testmiljø, men er ikke bekreftet lokalt her) — start med å
kjøre `npm install` og `npm run build` og fiks eventuelle feil.

## Hva jeg trenger hjelp til nå

1. Verifiser at prosjektet installerer og bygger uten feil (`npm install`,
   `npm run dev`, `npm run build`). Fiks eventuelle problemer.
2. Gå gjennom koden som allerede finnes og rydd opp / forbedre der det
   trengs — den er skrevet som en rask MVP, ikke nødvendigvis perfekt.
3. Hjelp meg sette opp en `.env`-fil lokalt (jeg oppretter selv Supabase-
   prosjektet og limer inn nøklene — du trenger ikke gjøre det for meg).
4. Sjekk at `supabase/schema.sql` er riktig og komplett for det appen
   trenger.
5. Sett opp git-repo hvis det ikke finnes, med fornuftig `.gitignore`
   (`node_modules`, `dist`, `.env`).
6. Gi meg en kort sjekkliste for å deploye til Netlify når koden er klar
   (jeg oppretter selv Netlify-kontoen).
7. Foreslå eventuelle forbedringer for offline-oppførsel (PWA-cachingen),
   men ikke bygg noe utover MVP-scope uten å spørre meg først (f.eks. ikke
   legg til redigering/sletting av oppskrifter, søk, kategorier, eller
   flerbrukerstøtte med mindre jeg ber om det).

Spør meg om avklaringer underveis hvis noe er uklart, fremfor å gjette.
