# Mine oppskrifter

Enkel kokebok-app: en nettside du legger som snarvei på telefonens
hjemskjerm, som lar hele familien lagre og se oppskrifter sammen. Alle med
lenken kan se alle oppskriftene, uansett hvem som eier dem. Hvert
familiemedlem logger inn (e-post og passord) for å legge til oppskrifter i
sin egen kokebok — man kan ikke legge til eller endre i noen andres.

Bygget med Vite + React + TypeScript, Supabase (database, innlogging,
bildelagring) og hostet på Netlify. Fungerer som en installerbar PWA med
cache, slik at tidligere sette oppskrifter også vises uten nett.

## 1. Opprett en Supabase-konto og et prosjekt

1. Gå til https://supabase.com og opprett en gratis konto.
2. Opprett et nytt prosjekt (velg region f.eks. "EU" for lavere ventetid fra Norge).
3. Når prosjektet er klart: gå til **SQL Editor** i menyen til venstre, lim inn
   innholdet i [`supabase/schema.sql`](supabase/schema.sql), og trykk **Run**.
   Dette oppretter tabellene for oppskrifter og profiler, tilgangsregler
   (RLS), og en bucket for bilder.
4. Kjør i tillegg innholdet i
   [`supabase/migration_recipe_header_fields.sql`](supabase/migration_recipe_header_fields.sql)
   i samme SQL Editor. Den legger til tre valgfrie felt (`description`,
   `total_minutes`, `servings`) som det nye designet viser på
   oppskrift-siden når de finnes — ingen skjema i appen lar deg sette dem
   ennå, så dette er trygt å kjøre nå og ta i bruk senere.
5. Kjør i tillegg innholdet i [`supabase/migration_family_groups.sql`](supabase/migration_family_groups.sql)
   i samme SQL Editor. Den oppretter tabeller for familiegrupper,
   invitasjonskoder (8 tegn), roller (admin/medlem), samlinger av
   oppskrifter, og deling mellom familier. Eksisterende brukere blir
   automatisk lagt til i en "Default-familie" som admin.

   Nye brukere lagd manuelt i Supabase Dashboard får ikke en familie til
   de logger inn i appen. Ved første innlogging ser de en
   onboarding-skjerm hvor de kan opprette en ny familiegruppe eller bli
   med i en eksisterende ved å skrive inn invitasjonskoden fra et
   familiemedlem. Invitasjonskoden brukes både for å bli medlem av
   familien og for å dele oppskrifter eller samlinger mellom familier.
   All familieadministrasjon — medlemmer, invitasjonskode, delinger —
   skjer via "Familie"-lenken på profilsiden (`/familie`).
6. Gå til **Project settings -> API**. Du trenger to verdier derfra:
   - **Project URL**
   - **anon public key**

## 2. Legg til familiemedlemmer

Appen har ikke noe registreringsskjema — du oppretter en bruker manuelt for
deg selv og for hvert familiemedlem som skal kunne legge til oppskrifter:

1. Gå til **Authentication -> Users -> Add user -> Create new user**, skriv
   inn e-post og passord, og huk av for **Auto Confirm User** slik at
   personen slipper e-postbekreftelse.
2. Kopier bruker-ID-en (UUID-en) til den nye brukeren fra brukerlisten.
3. Gå til **SQL Editor** og gi dem et visningsnavn (det som vises på
   oppskriftene deres i appen), f.eks.:

   ```sql
   insert into profiles (id, display_name) values ('<uuid-fra-auth-users>', 'Mamma');
   ```

Gjenta for hvert familiemedlem. Uten en rad i `profiles` vises brukerens
oppskrifter i appen med navnet "Ukjent".

### Eier-modellen

- Alle (også ikke-innloggede) kan **se** alle oppskrifter, uansett hvem som
  eier dem.
- En innlogget bruker kan bare **legge til, endre eller slette** oppskrifter
  i sin egen kokebok. Dette håndheves av databasens tilgangsregler (RLS) —
  ikke bare av appens grensesnitt — så det er ikke mulig å omgå ved å prøve
  seg fram i appen eller sende forespørsler direkte til Supabase.

### Eksisterende oppskrifter fra før denne endringen

`owner_id`-kolonnen på `recipes` er lagt til uten et strengt krav om at den
må ha en verdi (`not null`), fordi eksisterende rader ikke automatisk kan få
riktig eier tilordnet fra SQL Editor. Har du oppskrifter fra før som mangler
`owner_id`, sett dem manuelt i SQL Editor, f.eks.:

```sql
update recipes set owner_id = '<uuid-fra-auth-users>' where title = 'Min gamle oppskrift';
```

## 3. Sett opp miljøvariabler

Kopier `.env.example` til `.env` og fyll inn verdiene fra Supabase:

```
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=din-anon-key
```

`.env` skal ikke lastes opp til git — sjekk at den står i `.gitignore`.

## 4. Kjør lokalt (valgfritt, for testing)

```
npm install
npm run dev
```

Åpne linken som vises i terminalen.

## 5. Deploy til Netlify

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

## 6. Legg til på hjemskjermen (quick-link)

**iPhone (Safari):** åpne siden -> Del-ikonet -> "Legg til på Hjem-skjerm".

**Android (Chrome):** åpne siden -> meny (tre prikker) -> "Legg til på
startskjermen" / "Installer app".

Appen åpnes da i fullskjerm uten nettleser-UI, som en vanlig app.

## 7. Logg inn for å legge til oppskrifter

Trykk sirkelen øverst til høyre på Hjem-skjermen for å gå til profilsiden
(`/meg`), og skriv inn e-post og passord for brukeren din (se punkt 2 over).
Når du er logget inn dukker en "+"-knapp opp på Hjem-skjermen for å legge til
nye oppskrifter i din egen kokebok.

## 8. Importer oppskrift fra URL

Trykk "+"-knappen på Hjem-skjermen for å gå til Ny oppskrift-siden, og velg
"Importer fra URL". Lim inn en lenke til en oppskrift, og appen forsøker å
hente ut tittel, ingredienser og fremgangsmåte automatisk.

Dette fungerer kun på nettsider som har strukturerte oppskriftsdata
innebygd (schema.org "Recipe" — det formatet Google bruker for
oppskrift-forhåndsvisninger i søk). De fleste store oppskriftsider har
dette, men ikke alle. Fungerer det ikke, gir appen en tydelig feilmelding,
og du kan legge inn oppskriften manuelt i stedet.

Importen fyller kun ut skjemaet — ingenting lagres før du selv trykker
"Lagre oppskrift". Ingrediens-mengder og -enheter tolkes automatisk der det
går, men sjekk gjerne gjennom før lagring siden tolkningen er
"best effort" og ikke alltid perfekt.

Ingen API-nøkkel eller ekstra kostnad er nødvendig for denne funksjonen.

## Struktur

- `src/lib/supabaseClient.ts` – kobling til Supabase.
- `src/lib/importRecipe.ts` – frontend-klient som kaller import-funksjonen.
- `netlify/functions/` – `import-recipe.mjs` (funksjonshandler) og `lib/`
  (URL-sikkerhet og parsing av schema.org-oppskriftsdata).
- `src/components/Login.tsx` – innlogging via e-post og passord.
- `src/components/RecipeForm.tsx` – skjema for å legge til/redigere oppskrift + bilde.
- `src/pages/` – de syv skjermene (Hjem, Samling, Oppskrift, Kokemodus,
  Ny oppskrift, Søk, Profil), koblet sammen med `react-router-dom`.
- `src/context/AppContext.tsx` – delt tilstand (innlogging, oppskrifter,
  profiler, filtre) tilgjengelig for alle skjermene.
- `supabase/schema.sql` – databasetabeller (oppskrifter og profiler),
  tilgangsregler og bilde-bucket.
- `supabase/migration_recipe_header_fields.sql` – valgfrie ekstra felt på
  oppskrifter (se punkt 1).

## Videre forbedringer (ikke i MVP)

- Redigere/slette oppskrifter fra appen (i dag må det gjøres i Supabase-UI).
- Kategorier utover dagens etiketter.
- Offline-kø: lagre en ny oppskrift mens du er uten nett, og synke automatisk
  når du får nett igjen (i dag krever "legg til" at du er tilkoblet).
