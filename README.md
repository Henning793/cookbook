# Mine oppskrifter

Enkel kokebok-app: en nettside du legger som snarvei på telefonens
hjemskjerm, som lar deg lagre og se dine egne oppskrifter. Alle med lenken
kan se oppskriftene; kun du kan legge til nye (via innlogging med e-post og
passord).

Bygget med Vite + React + TypeScript, Supabase (database, innlogging,
bildelagring) og hostet på Netlify. Fungerer som en installerbar PWA med
cache, slik at tidligere sette oppskrifter også vises uten nett.

## 1. Opprett en Supabase-konto og et prosjekt

1. Gå til https://supabase.com og opprett en gratis konto.
2. Opprett et nytt prosjekt (velg region f.eks. "EU" for lavere ventetid fra Norge).
3. Når prosjektet er klart: gå til **SQL Editor** i menyen til venstre, lim inn
   innholdet i [`supabase/schema.sql`](supabase/schema.sql), og trykk **Run**.
   Dette oppretter tabellen for oppskrifter, tilgangsregler (RLS), og en
   bucket for bilder.
4. Gå til **Project settings -> API**. Du trenger to verdier derfra:
   - **Project URL**
   - **anon public key**
5. Opprett din egen brukerkonto (appen har ikke noe registreringsskjema, siden
   kun du skal kunne logge inn): gå til **Authentication -> Users -> Add user
   -> Create new user**, skriv inn e-post og passord, og huk av for **Auto
   Confirm User** slik at du slipper e-postbekreftelse.

## 2. Sett opp miljøvariabler

Kopier `.env.example` til `.env` og fyll inn verdiene fra Supabase:

```
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=din-anon-key
```

`.env` skal ikke lastes opp til git — sjekk at den står i `.gitignore`.

## 3. Kjør lokalt (valgfritt, for testing)

```
npm install
npm run dev
```

Åpne linken som vises i terminalen.

## 4. Deploy til Netlify

1. Push prosjektet til et GitHub-repo.
2. Opprett en gratis konto på https://netlify.com og koble den til GitHub.
3. **Add new site -> Import an existing project**, velg repoet ditt.
   Netlify finner `netlify.toml` automatisk (build-kommando og publish-mappe
   er allerede satt opp).
4. Under **Site settings -> Environment variables**, legg inn de samme to
   variablene som i `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. Du får en `.netlify.app`-adresse (kan endres til noe kortere under
   **Site settings -> Change site name**, eller kobles til eget domene).

## 5. Legg til på hjemskjermen (quick-link)

**iPhone (Safari):** åpne siden -> Del-ikonet -> "Legg til på Hjem-skjerm".

**Android (Chrome):** åpne siden -> meny (tre prikker) -> "Legg til på
startskjermen" / "Installer app".

Appen åpnes da i fullskjerm uten nettleser-UI, som en vanlig app.

## 6. Logg inn for å legge til oppskrifter

Skriv inn e-post og passord for brukeren du opprettet i Supabase-dashboardet
(se steg 5 over). Da vises skjemaet for å legge til nye oppskrifter. Alle
andre som åpner lenken kan se oppskriftene, men bare du (og andre du evt.
gir tilgang via Supabase) kan legge til/endre.

## Struktur

- `src/lib/supabaseClient.ts` – kobling til Supabase.
- `src/components/Login.tsx` – innlogging via e-post og passord.
- `src/components/AddRecipeForm.tsx` – skjema for å legge til oppskrift + bilde.
- `src/components/RecipeList.tsx` – viser lagrede oppskrifter.
- `supabase/schema.sql` – databasetabell, tilgangsregler og bilde-bucket.

## Videre forbedringer (ikke i MVP)

- Redigere/slette oppskrifter fra appen (i dag må det gjøres i Supabase-UI).
- Søk/filtrering, kategorier, porsjonsstørrelse.
- Flere brukere med hver sin innlogging og egne tilganger.
- Offline-kø: lagre en ny oppskrift mens du er uten nett, og synke automatisk
  når du får nett igjen (i dag krever "legg til" at du er tilkoblet).
