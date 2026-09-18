# Mine oppskrifter

Enkel kokebok-app: en nettside du legger som snarvei på telefonens
hjemskjerm. Alle oppretter sin egen konto (e-post og passord) og kan legge
til egne oppskrifter med en gang — helt uavhengig av andre. Å bli med i
eller opprette en familiegruppe er valgfritt, og trengs først når du vil
dele oppskrifter med noen andre: medlemmer av samme familie ser hverandres
oppskrifter, og familier kan dele enkeltoppskrifter, samlinger eller hele
boken med hverandre. Man kan aldri legge til, endre eller slette
oppskrifter som tilhører noen andre.

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

   Samlinger opprettes og fylles automatisk fra etikettene på oppskriftene
   (en trigger på `recipes` — se `sync_recipe_tags_to_collections` i samme
   fil): den første familie-oppskriften med etiketten "Middag" oppretter
   samlingen "Middag", og senere oppskrifter med samme etikett i samme
   familie kobles automatisk til den. Man oppretter eller fyller aldri en
   samling manuelt — det gjør man ved å sette etiketter på oppskriften.

   Nye brukere lagd manuelt i Supabase Dashboard får ikke en familie til
   de logger inn i appen. Ved første innlogging ser de en
   onboarding-skjerm hvor de kan opprette en ny familiegruppe eller bli
   med i en eksisterende ved å skrive inn invitasjonskoden fra et
   familiemedlem. Invitasjonskoden brukes både for å bli medlem av
   familien og for å dele oppskrifter, samlinger, eller hele familiens
   bok mellom familier. All familieadministrasjon — medlemmer,
   invitasjonskode, delinger — skjer via "Familie"-lenken på profilsiden
   (`/familie`).
6. Gå til **Project settings -> API**. Du trenger to verdier derfra:
   - **Project URL**
   - **anon public key**
7. Sett opp CAPTCHA-beskyttelse for registrering (se punkt 2 under) og
   skru av e-postbekreftelse (**Authentication -> Providers -> Email ->
   Confirm email**: av) — nye brukere kan da bruke appen med en gang etter
   registrering, uten å måtte bekrefte e-posten først.

## 2. Registrering (selvbetjent) og CAPTCHA-oppsett

Appen har et registreringsskjema (e-post, passord, navn) — hvem som helst
kan opprette sin egen konto. For å hindre roboter fra å opprette
masse-kontoer krever registreringen menneske-verifikasjon via
[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) (gratis):

1. Gå til https://dash.cloudflare.com/?to=/:account/turnstile og opprett en
   konto hvis du ikke har en.
2. Opprett en ny widget: velg type **Managed**, og legg til domenet appen
   kjører på (og `localhost` hvis du vil teste lokalt).
3. Kopier **Site Key** og **Secret Key**.
4. I appens `.env` (se punkt 3), legg til:
   ```
   VITE_TURNSTILE_SITE_KEY=din-site-key
   ```
5. I Supabase Dashboard: **Authentication -> Attack Protection -> Enable
   CAPTCHA protection**, velg **Turnstile**, og lim inn **Secret Key**.

Uten en gyldig `VITE_TURNSTILE_SITE_KEY` viser registreringsskjemaet en
tydelig feilmelding i stedet for CAPTCHA-widgeten, og registrering vil
feile mot Supabase (siden CAPTCHA-beskyttelsen er skrudd på server-side).

### Opprett en bruker manuelt i stedet (alternativ til selvregistrering)

Du kan fortsatt opprette brukere manuelt i Supabase Dashboard i stedet for
å bruke registreringsskjemaet, f.eks. for å slippe CAPTCHA-oppsettet:

1. Gå til **Authentication -> Users -> Add user -> Create new user**, skriv
   inn e-post og passord, og huk av for **Auto Confirm User**.
2. Kopier bruker-ID-en (UUID-en) til den nye brukeren fra brukerlisten.
3. Gå til **SQL Editor** og gi dem et visningsnavn (det som vises på
   oppskriftene deres i appen), f.eks.:

   ```sql
   insert into profiles (id, display_name) values ('<uuid-fra-auth-users>', 'Mamma');
   ```

Uten en rad i `profiles` vises brukerens oppskrifter i appen med navnet
"Ukjent".

### Eier- og familie-modellen

- En oppskrift uten familie (`family_id` er tom) er **personlig** — kun
  synlig og redigerbar for den som opprettet den.
- Når en bruker **oppretter eller blir med i en familie**, blir alle deres
  personlige oppskrifter automatisk med inn i familien og synlige for alle
  medlemmene (`create_family`/`join_family_by_code` i
  [`supabase/migration_family_groups.sql`](supabase/migration_family_groups.sql)).
  Dette skjer kun i det øyeblikket man blir medlem — oppskrifter man legger
  til etter det, mens man allerede er medlem, tilhører automatisk familien
  fra starten av.
- En oppskrift som tilhører en familie er synlig for alle medlemmer av den
  familien, men kan fortsatt kun **endres eller slettes** av den som
  opprettet den (med mindre oppretteren ikke lenger er medlem av familien —
  da kan alle nåværende medlemmer redigere den i stedet for at den låses).
- Familie er alltid valgfritt: en innlogget bruker kan legge til, endre og
  slette sine egne oppskrifter uten noen gang å opprette eller bli med i en
  familie. "Familie"-lenken på profilsiden (`/familie`) er der for den som
  vil opprette eller bli med i en familie senere, for å dele med andre —
  merk at dette da gjør alle ens egne oppskrifter synlige for hele familien,
  se punktet over.
- Alt dette håndheves av databasens tilgangsregler (RLS) — ikke bare av
  appens grensesnitt — så det er ikke mulig å omgå ved å prøve seg fram i
  appen eller sende forespørsler direkte til Supabase.

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
VITE_TURNSTILE_SITE_KEY=din-turnstile-site-key
```

`.env` skal ikke lastes opp til git — sjekk at den står i `.gitignore`.

## 4. Kjør lokalt (valgfritt, for testing)

```
npm install
npm run dev
```

Åpne linken som vises i terminalen.

### Kjør mot en helt lokal database (Docker) i stedet for produksjon

Hvis du vil teste en endring (f.eks. en ny SQL-migrering) uten å røre det
ekte Supabase-prosjektet, kan du kjøre hele Supabase-stacken lokalt i
Docker via Supabase CLI. `supabase/config.toml` og `supabase/.gitignore`
i dette repoet er allerede satt opp for dette (laget med `npx supabase
init`) — du trenger bare Docker installert og kjørende.

**1. Start Docker Desktop**, og bekreft at det kjører:

```bash
docker info
```

**2. Start den lokale Supabase-stacken** (fra repo-roten). Første gang
laster den ned Docker-images og kan ta noen minutter:

```bash
npx supabase start
```

Når den er ferdig, hent tilkoblingsdetaljene:

```bash
npx supabase status
```

Dette gir deg blant annet:
- `API_URL` (`http://127.0.0.1:54321`) — dette er URL-en appen skal peke på
- `ANON_KEY` — en fast, offentlig kjent demo-nøkkel for lokal utvikling (ikke en hemmelighet, samme for alle som bruker Supabase CLI lokalt)
- `DB_URL` — direkte Postgres-tilkobling (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`)
- `STUDIO_URL` (`http://127.0.0.1:54323`) — et lokalt Supabase Dashboard i nettleseren, akkurat som det ekte, for å se tabeller/kjøre SQL visuelt

**3. Kjør de tre SQL-filene mot den lokale databasen**, i rekkefølge.
Prosjektet har ingen `psql` installert som kommando i seg selv, men
Postgres-containeren har det innebygd — bruk `docker exec` mot
containeren (navnet er `supabase_db_<project_id>`, der `project_id` er
`cookingapp` satt i `supabase/config.toml`, dvs. `supabase_db_cookingapp`):

```bash
docker exec -i supabase_db_cookingapp psql -U postgres -d postgres < supabase/schema.sql
docker exec -i supabase_db_cookingapp psql -U postgres -d postgres < supabase/migration_recipe_header_fields.sql
docker exec -i supabase_db_cookingapp psql -U postgres -d postgres < supabase/migration_family_groups.sql
```

Alle tre er idempotente (trygge å kjøre flere ganger), akkurat som mot
det ekte prosjektet.

**4. Pek appen mot den lokale databasen** ved å opprette en `.env.local`
-fil (Vite prioriterer denne over `.env`, og den er lagt til i
`.gitignore` — den ekte `.env` med produksjonsnøklene blir ikke rørt):

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ANON_KEY fra "npx supabase status">
```

**5. Opprett testbrukere.** Siden appen ikke har noe registreringsskjema
(se punkt 2), må testbrukere opprettes via GoTrue sitt admin-API med
`SERVICE_ROLE_KEY` (også fra `npx supabase status`) — dette tilsvarer det
du ellers ville gjort i Supabase Dashboard -> Authentication -> Users:

```bash
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: <SERVICE_ROLE_KEY>" -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"testa@example.com","password":"testpassword123","email_confirm":true}'
```

Kopier `id`-feltet fra svaret, og gi brukeren et visningsnavn som i punkt
2, men direkte mot den lokale containeren:

```bash
docker exec -i supabase_db_cookingapp psql -U postgres -d postgres -c \
  "insert into profiles (id, display_name) values ('<uuid-fra-forrige-steg>', 'Test A');"
```

Gjenta for flere testbrukere (f.eks. `testb@example.com`) hvis du vil
teste flere familier/deling mellom dem.

**6. Kjør appen og logg inn:**

```bash
npm run dev
```

Åpne siden, logg inn med testbrukeren(e), og test som vanlig — helt
isolert fra det ekte prosjektet.

**Rydde opp etterpå:**

```bash
npx supabase stop            # stopper containerne, beholder databasen til neste "start"
npx supabase stop --no-backup # stopper OG sletter all lokal testdata helt
```

Husk å bytte `.env.local` tilbake (eller bare slette filen) når du vil
kjøre mot det ekte prosjektet igjen.

## 5. Deploy til Netlify

1. Push prosjektet til et GitHub-repo.
2. Opprett en gratis konto på https://netlify.com og koble den til GitHub.
3. **Add new site -> Import an existing project**, velg repoet ditt.
   Netlify finner `netlify.toml` automatisk (build-kommando og publish-mappe
   er allerede satt opp).
4. Under **Site settings -> Environment variables**, legg inn de samme
   variablene som i `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_TURNSTILE_SITE_KEY`
5. Deploy. Du får en `.netlify.app`-adresse (kan endres til noe kortere under
   **Site settings -> Change site name**, eller kobles til eget domene).
   Husk å legge til denne adressen som et domene på Turnstile-widgeten din
   (se punkt 2) — CAPTCHA-en fungerer ikke på et domene den ikke er
   registrert for.

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
- `src/components/Login.tsx` – innlogging og selvbetjent registrering (e-post/passord).
- `src/components/TurnstileWidget.tsx` – Cloudflare Turnstile-widget for menneske-verifikasjon ved registrering.
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
