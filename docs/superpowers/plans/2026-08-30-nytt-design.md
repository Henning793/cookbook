# Nytt design (mobil-først redesign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the seven-screen mobile-first redesign from `design/handoff/README.md` in the existing React/TypeScript/Vite/Supabase app, replacing the single-page hamburger-menu shell with routed screens, while keeping "Samlinger" backed by the app's existing tag system (`src/lib/tags.ts`) instead of the handoff's proposed `collections`/`collection_recipes` tables.

**Architecture:** Add `react-router-dom` for routing and `lucide-react` for icons (the only new dependencies — everything else stays plain CSS/React, per the handoff's own constraint). Lift `session`/`recipes`/`profiles`/`loading`/`reload`/`availableTags`/`filters`/`cookingSession` into a new `AppContext` so routed pages don't need prop-drilling. Each of the seven screens becomes its own component under `src/pages/`. `RecipeForm.tsx`'s structured ingredient/step rows (mengde/enhet dropdown, opp/ned-piler, overskrift-rader) are kept exactly as they work today — only restyled — per an explicit decision with the user (see Global Constraints).

**Spec:** [design/handoff/README.md](../../../design/handoff/README.md) (screens, tokens, routes, state, suggested order), plus this plan's Global Constraints section for the deviations agreed with the user in chat on 2026-08-30 (tags instead of collections; keep structured ingredient rows).

## Global Constraints

- **"Samlinger" = existing tags, not new tables.** Do NOT create `collections` or `collection_recipes` tables, and do NOT run those parts of `design/handoff/migration_collections.sql`. Everywhere the handoff says "collection," read "tag." The tag source is the same union the app already computes (`TAGS` constant + tags actually used on recipes — see current `App.tsx`'s `availableTags`).
- **Only migrate the three optional recipe columns.** Create a new, separate file `supabase/migration_recipe_header_fields.sql` (not the handoff's bundled file) containing only `description text`, `total_minutes int`, `servings int` as idempotent `alter table ... add column if not exists`, in the same style as `supabase/schema.sql`. Do not add any RLS policy changes — the existing `recipes` policies already cover these columns since they're on the same table/row.
- **Keep `RecipeForm.tsx`'s existing input mechanics.** Confirmed with the user: the structured ingredient rows (name/mengde/enhet dropdown + "annet", opp/ned-piler, "+ Legg til overskrift") and the step rows (opp/ned-piler, one textarea per step) stay functionally unchanged. Only restyle them with the new tokens/spacing. Do NOT switch to the handoff's literal "one ingredient per line in a textarea" description in README section 5 — that text is superseded by this ruling.
- **`description`/`total_minutes`/`servings` are always optional, everywhere, forever in this plan.** No task in this plan adds form inputs for them (the handoff doesn't list them as new `RecipeForm` fields either — only "Samling" tag-chips are called out as a new field, and that's the existing tag picker, already built). They only ever get displayed, and only when non-null. Every read of `recipe.description`, `recipe.total_minutes`, `recipe.servings` must tolerate the column not existing yet in the database (same `?? null`/`??` pattern already used for `recipe.tags` in `App.tsx`'s `loadRecipes`) — the migration is deliberately the *last* task, so tasks 1-6 run against a database that doesn't have these columns.
- **Design tokens live in `src/theme.css`, imported once from `src/main.tsx`.** Copy only the `:root` token block plus the base resets (`box-sizing`, `body`, headings, `:focus-visible`, `::selection`) from `design/handoff/styles.css` — not the generic `.btn`/`.card`/`.tag`/`.dialog` component-class layer. The app keeps its own component class names in `src/App.css` (e.g. `.recipe-card`, `.tag-chip`, `.owner-tab`); those get restyled to use the new CSS variables, not replaced by the handoff's generic classes. Delete hard-coded hex/rgba color literals from `src/App.css` in favor of the `var(--color-*)` tokens wherever a token matches; leave a literal in place (with a one-line comment why) only if no token fits.
- **Fonts load via `<link>` tags in `index.html`**, not a CSS `@import` (avoids the render-blocking double-fetch of doing both). Use Google Fonts for Caprasimo (400) and Figtree (400/600/700).
- **Icons:** `lucide-react`, every icon at `stroke-width={2.75}`. Only the icons the screens actually need: `Search`, `Share2`, `Pencil`, `Plus`, `Check`, `ChevronLeft`, `ChevronRight`. Verify each import name actually exists in the installed `lucide-react` version before using it (check `node_modules/lucide-react/dist/lucide-react.d.ts` or the package's exports) — substitute the closest equivalent if a name has changed and note the substitution in the task report.
- **Old shell is fully replaced, not kept alongside.** The current `App.tsx` (hamburger menu, inline `<details>` card grid in `RecipeList.tsx`) is superseded by the router + the seven pages. `RecipeList.tsx` and the hamburger-menu markup in the old `App.tsx` are deleted once their functionality has a home in the new pages (RecipeList's card-grid role moves into `SamlingPage`/search results; the hamburger menu's login/add-recipe role moves into `ProfilPage`/`NyOppskriftPage`/nav links). Don't delete a file until the task that replaces its functionality is done and verified.
- **Routes** (note `/samling/:tag`, not the handoff's `/samling/:id`):
  | Route | Page component |
  | --- | --- |
  | `/` | `HjemPage` |
  | `/samling/:tag` | `SamlingPage` |
  | `/oppskrift/:id` | `OppskriftPage` |
  | `/oppskrift/:id/kok` | `KokemodusPage` |
  | `/ny` | `NyOppskriftPage` |
  | `/sok` | `SokPage` |
  | `/meg` | `ProfilPage` |
- **Settings toggles with no backing data are display-only.** The Profil screen's "Alle med lenken kan lese" and "Vis navnet mitt" toggles (README section 7.4) have no settings table anywhere in this app, and actually re-tightening RLS from a client toggle is both insecure (clients can't run DDL) and far outside "restyle + navigation change" scope. Render them as static/disabled toggles showing today's true state (link-reading ON, since that's the real `anon` select policy; name-showing OFF, matching the handoff's shown default) — do not wire them to anything. Note this limitation in the task's report; it is a deliberate scope cut, not a bug.
- **No automated tests for this plan.** The project has automated tests only for the two pure Netlify Function helper modules (`netlify/functions/lib/*.test.mjs`) — nothing for the React frontend, and this plan doesn't change that convention (matches every prior UI feature in this app's history). Verification is manual: `npm run build`, `npm run lint`, and browser checks at 390×844 against `design/handoff/Kokeboka - 1b.dc.html`, per task.
- **One commit per task**, task boundaries match the handoff's own "Suggested order of work" numbering (with tokens+fonts as task 1 through migration+Hjem+Samling as task 7).

---

## Task 1: Design tokens + fonts, strip hard-coded colors from `App.css`

**Files:**
- Create: `src/theme.css`
- Modify: `index.html` (Google Fonts `<link>`s)
- Modify: `src/main.tsx` (import `./theme.css`)
- Modify: `src/App.css` (replace hard-coded color literals with `var(--color-*)`)

**Interfaces:**
- Produces: every CSS custom property listed in `design/handoff/README.md`'s "Design tokens" section (`--color-bg`, `--color-surface`, `--color-text`, `--color-accent`, `--color-accent-2`, `--color-divider`, `--color-accent-100/200/300/400/500/600/700/800/900`, `--color-accent-2-100/.../900`, `--color-neutral-100/.../900`, `--font-heading`, `--font-body`, `--space-1/2/3/4/6/8`, `--radius-sm/md/lg`, `--shadow-sm/md/lg`). Every later task's CSS depends on these existing.

- [ ] **Step 1: Create `src/theme.css`**

Copy the `:root { ... }` block verbatim from `design/handoff/styles.css` (lines 4–64) into `src/theme.css`. After the `:root` block, add these base rules (also copied from `design/handoff/styles.css`, lines 66–105, trimmed to what applies app-wide — skip `.washed` and the component-class layer):

```css
*, *::before, *::after { box-sizing: border-box; }

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  margin: 0;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  line-height: 1.12;
  letter-spacing: -0.015em;
  margin: 0 0 var(--space-2);
}

:focus { outline: none; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
::selection { background: color-mix(in srgb, var(--color-accent) 30%, transparent); }
```

- [ ] **Step 2: Load the fonts in `index.html`**

In `index.html`, inside `<head>`, after the existing `<meta name="theme-color">` line, add:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Figtree:wght@400;600;700&display=swap" rel="stylesheet" />
```

Also update `<meta name="theme-color" content="#fff7ed" />` to `content="#f5ead8"` (the new `--color-bg`) so the browser chrome matches.

- [ ] **Step 3: Import the theme in `main.tsx`**

In `src/main.tsx`, add `import './theme.css'` as the first import (before `./index.css`), so theme tokens are available to every other stylesheet that loads after it.

- [ ] **Step 4: Replace hard-coded colors in `App.css` with tokens**

Read the full current `src/App.css`. For every hex color (`#...`) or `rgba(...)`/named color that has an obvious matching token from the list above (e.g. an off-white background → `var(--color-bg)` or `var(--color-surface)`, a dark near-black text color → `var(--color-text)`, the purple/orange accent buttons → `var(--color-accent)`, border grays → `var(--color-divider)` or a `--color-neutral-*` step, error red stays as-is since there's no error token in the design system), replace it with the closest token. Where genuinely nothing fits (e.g. the destructive-red `#d1242f` used for delete buttons — the design system has no semantic "danger" color), leave the literal and add a one-line comment `/* no token for this in the design system */` above it. Don't change selectors, layout properties, or remove/rename any class in this step — color values only.

- [ ] **Step 5: Verify**

Run: `npm run build && npm run lint`
Expected: both clean (the pre-existing `react/set-state-in-effect` warning in `App.tsx` is unrelated and expected until Task 2 rewrites that file).

Run `npm run dev`, open the app at a 390×844 viewport (e.g. via the browser devtools device toolbar), and confirm the page still renders (unstyled-looking is fine — screens aren't restyled yet — but nothing should look *broken*, like invisible text).

- [ ] **Step 6: Commit**

```bash
git add src/theme.css index.html src/main.tsx src/App.css
git commit -m "Legg til design-tokens og fonter fra det nye designet"
```

---

## Task 2: Router, app shell, and shared context

**Files:**
- Create: `src/context/AppContext.tsx`
- Create: `src/pages/HjemPage.tsx`, `src/pages/SamlingPage.tsx`, `src/pages/OppskriftPage.tsx`, `src/pages/KokemodusPage.tsx`, `src/pages/NyOppskriftPage.tsx`, `src/pages/SokPage.tsx`, `src/pages/ProfilPage.tsx` (stub components for this task — filled in by later tasks)
- Modify: `src/App.tsx` (becomes the provider + router shell; delete the old hamburger-menu/RecipeList rendering)
- Modify: `package.json` (add `react-router-dom`, `lucide-react`)

**Interfaces:**
- Produces: `AppContext` / `useApp()` hook returning:
  ```ts
  interface AppContextValue {
    session: Session | null
    recipes: Recipe[]
    profiles: Profile[]
    loading: boolean
    reload: () => void
    availableTags: string[]
    filters: { ownerId: string | null; tag: string | null }
    setFilters: (patch: Partial<{ ownerId: string | null; tag: string | null }>) => void
    cookingSession: { recipeId: string; stepIndex: number } | null
    setCookingSession: (session: { recipeId: string; stepIndex: number } | null) => void
  }
  ```
  Every later task's page component consumes this via `useApp()`.

- [ ] **Step 1: Install dependencies**

```bash
npm install react-router-dom lucide-react
```

- [ ] **Step 2: Create `AppContext`**

Create `src/context/AppContext.tsx`. Move the session/recipes/profiles/loading/reload logic that exists today in `src/App.tsx` (the `useEffect` for `supabase.auth.getSession`/`onAuthStateChange`, the `loadRecipes` callback with its `tags ?? []` fallback, the profiles fetch, and the `availableTags` memo using `TAGS` from `src/lib/tags.ts`) into a `AppProvider` component here. Add the two new pieces of state the handoff calls for:

```tsx
const [filters, setFiltersState] = useState<{ ownerId: string | null; tag: string | null }>({
  ownerId: null,
  tag: null,
})

function setFilters(patch: Partial<{ ownerId: string | null; tag: string | null }>) {
  setFiltersState((current) => ({ ...current, ...patch }))
}

const [cookingSession, setCookingSessionState] = useState<{ recipeId: string; stepIndex: number } | null>(() => {
  try {
    const raw = localStorage.getItem('kokeboka.cooking')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})

function setCookingSession(session: { recipeId: string; stepIndex: number } | null) {
  setCookingSessionState(session)
  try {
    if (session) {
      localStorage.setItem('kokeboka.cooking', JSON.stringify(session))
    } else {
      localStorage.removeItem('kokeboka.cooking')
    }
  } catch {
    // localStorage unavailable (private mode, etc.) - cooking-session persistence
    // degrades to in-memory only for this page load, which is an acceptable trade-off.
  }
}
```

Export a `useApp()` hook that reads the context and throws a clear error if used outside the provider (standard pattern — `const ctx = useContext(AppContext); if (!ctx) throw new Error('useApp must be used within AppProvider'); return ctx`).

- [ ] **Step 3: Create stub pages**

For each of the seven files listed above, create a minimal placeholder that proves the route wiring works, e.g. for `src/pages/HjemPage.tsx`:

```tsx
export function HjemPage() {
  return <p>Hjem (kommer)</p>
}
```

Same pattern (swap the component/file name and the placeholder text) for the other six.

- [ ] **Step 4: Rewrite `App.tsx` as the provider + router shell**

Replace the entire contents of `src/App.tsx` with:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { HjemPage } from './pages/HjemPage'
import { SamlingPage } from './pages/SamlingPage'
import { OppskriftPage } from './pages/OppskriftPage'
import { KokemodusPage } from './pages/KokemodusPage'
import { NyOppskriftPage } from './pages/NyOppskriftPage'
import { SokPage } from './pages/SokPage'
import { ProfilPage } from './pages/ProfilPage'
import './App.css'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HjemPage />} />
          <Route path="/samling/:tag" element={<SamlingPage />} />
          <Route path="/oppskrift/:id" element={<OppskriftPage />} />
          <Route path="/oppskrift/:id/kok" element={<KokemodusPage />} />
          <Route path="/ny" element={<NyOppskriftPage />} />
          <Route path="/sok" element={<SokPage />} />
          <Route path="/meg" element={<ProfilPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
```

This deliberately drops the old hamburger-menu markup and the direct `<RecipeList>` render — that functionality moves into the real pages in later tasks. Do NOT delete `src/components/RecipeList.tsx`, `src/components/AddRecipeForm.tsx`, or `src/components/Login.tsx` yet in this task — later tasks either reuse their logic (extracting into new pages) or delete them once superseded. Leave them in place, unused, for now (a harmless unused-file state between tasks — the `set-state-in-effect` lint warning that used to point at old `App.tsx` will disappear here since that code moved).

- [ ] **Step 5: Verify**

Run: `npm run build && npm run lint`
Expected: clean build. `RecipeList.tsx`/`AddRecipeForm.tsx`/`Login.tsx` being unused doesn't fail the build (TypeScript doesn't error on unused exported components, only unused local variables) — if `npm run build`'s `tsc -b` DOES complain about unused files/exports, that's a project-config surprise; report it as a concern rather than deleting the files early to silence it.

Run `npm run dev`, navigate to each of the seven routes directly in the browser address bar (e.g. `http://localhost:5173/oppskrift/anything`), and confirm each shows its placeholder text with no console errors. Confirm client-side navigation doesn't 404 on a hard refresh of a nested route (Vite's dev server has SPA fallback built in; this also needs `netlify.toml`'s existing `/* -> /index.html` redirect for production, which is already in place — no change needed there).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/context/AppContext.tsx src/pages src/App.tsx
git commit -m "Legg til router, app-shell og delt context for det nye designet"
```

---

## Task 3: Oppskrift og Ny oppskrift

**Files:**
- Modify: `src/pages/OppskriftPage.tsx` (full implementation, replacing the Task 2 stub)
- Modify: `src/pages/NyOppskriftPage.tsx` (full implementation, replacing the Task 2 stub)
- Modify: `src/components/RecipeForm.tsx` (restyle only — no logic changes, per Global Constraints)
- Modify: `src/App.css` (styles for both pages' markup, plus the restyled `RecipeForm`)

**Interfaces:**
- Consumes: `useApp()` from Task 2 (`recipes`, `session`, `reload`, `availableTags`); `RecipeForm`/`RecipeFormValues` (existing, unchanged props); `importRecipeFromUrl` (existing, unchanged); `supabase` client (existing).
- Produces: nothing new consumed by later tasks except that `OppskriftPage` is what `HjemPage`'s "Sist brukt" card (Task 7) and `KokemodusPage`'s "Avslutt" (Task 4) navigate back to via `/oppskrift/:id`.

- [ ] **Step 1: Implement `OppskriftPage`**

Follow `design/handoff/README.md` section 3 ("Oppskrift") exactly for layout/spacing/typography, with these adaptations:
- Get the recipe via `useParams<{ id: string }>()` and `recipes.find(r => r.id === id)` from `useApp()`. If not found (e.g. direct navigation to a bad id, or recipes still loading), render a simple "Fant ikke oppskriften" / loading state — the handoff doesn't specify this edge case, so keep it minimal (a centered message, no special styling pass needed).
- Nav bar back-link label: the handoff wants `‹ <collection or Kokeboka>`. Read the referring tag from router state: when a later task (`SamlingPage`, Task 7) links here, it will pass `state={{ fromTag: tag }}` to `<Link>`/`navigate`. In `OppskriftPage`, read `const location = useLocation(); const fromTag = location.state?.fromTag as string | undefined`. Back link label is `fromTag ?? 'Kokeboka'`, and clicking it calls `navigate(fromTag ? `/samling/${encodeURIComponent(fromTag)}` : '/')`.
- `description`/`total_minutes`/`servings`: read as `recipe.description ?? null`, `recipe.total_minutes ?? null`, `recipe.servings ?? null` (the columns don't exist in the database until Task 7's migration runs — these will always be `undefined` → `null` until then, which is fine, since the spec says omit them when absent).
- Tag row: render `recipe.tags` as pills cycling the three tint pairs (`accent-100`/`accent-700`, `accent-2-100`/`accent-2-700`, `neutral-100`/`neutral-800`) by index modulo 3. Append a time pill (`{total_minutes} min`) and a servings pill (`{servings} porsjoner`) only when those values are non-null.
- Ingredients/steps: render exactly as today's `RecipeList.tsx` does (structured list with `isHeading` support, numbered steps) — just apply the new spacing/typography from section 3.6–3.7 instead of the current `.ingredient-list`/`.step-list` styling.
- "Endre": only rendered when `recipe.owner_id === session?.user.id`. Clicking it swaps the page body to the existing `RecipeForm` in edit mode (same inline-toggle pattern `RecipeList.tsx` uses today: local `editing` boolean state, `RecipeForm` with `initial` populated from the recipe, `onSubmit` calling `supabase.from('recipes').update(values).eq('id', recipe.id)` then `reload()` and un-toggling). Bring over the delete confirmation (Ja/Avbryt) the same way. Delete `RecipeList.tsx`'s inline-edit code once this page fully replaces it — but not yet in this step; do that cleanup at the end of this task once both this page and `NyOppskriftPage` are verified (see Step 4).
- "Start kokemodus" footer CTA navigates to `/oppskrift/:id/kok`, disabled (`45%` opacity, `pointer-events: none` or a real `disabled` if it's a `<button onClick={navigate}>`) when `recipe.steps.length === 0`.
- "Del": copy `${window.location.origin}/oppskrift/${id}` to the clipboard via `navigator.clipboard.writeText`, show a brief confirmation (a small transient text change, e.g. the label becomes "Kopiert!" for ~1.5s via `setTimeout`).

- [ ] **Step 2: Implement `NyOppskriftPage`**

Follow section 5 with the Global Constraints ruling (keep `RecipeForm`'s structured rows, don't switch to textareas):
- Port `AddRecipeForm.tsx`'s state machine (`view: 'closed' | 'import' | 'form'`, `importUrl`, `importing`, `importError`, `importedValues`) into this page, but start directly in a chooser state instead of the old "closed" single button — render the two entry cards from section 5.3 (`Skriv selv` → go straight to `'form'` with no `initial`; `Fra bilde` → go to the existing `'import'` view, i.e. the URL-input sub-form. Note to the user in this task's report that "Fra bilde" currently opens a URL-import field, not an image upload — this is the explicit interim mapping the handoff itself calls for).
- Once a path is chosen, render the restyled `RecipeForm` (heading `Ny oppskrift`, `availableTags` from `useApp()`, `onSubmit` inserting via `supabase.from('recipes').insert(values)` then `reload()` and `navigate('/')`, `onCancel` navigating back to `/` or resetting to the entry-card view — resetting to entry cards matches the nested-cancel behavior users are used to from `AddRecipeForm` today; use your judgment and note which you picked).
- Nav bar: `Avbryt` (left, navigates to `/`), `Lagre` (right — this is really `RecipeForm`'s own submit button relabeled/restyled to sit in the nav bar; either pass a `submitLabel="Lagre"` + render `RecipeForm`'s existing bottom action bar restyled to look like a nav-bar-style pair of links, or keep the submit button where `RecipeForm` puts it and only restyle it to match — pick whichever keeps `RecipeForm` a single source of truth for its own submit/cancel wiring rather than duplicating buttons, and note your choice).
- `Legg til bilde` row reuses `RecipeForm`'s existing image `<input type="file">`, restyled per section 5.5 (the pill-shaped row with the accent "+" circle) rather than the current plain file input — this needs a small addition to `RecipeForm.tsx` itself (see Step 3) since the image input currently has no custom-styled trigger.

- [ ] **Step 3: Restyle `RecipeForm.tsx`**

Apply the new spacing/typography/colors from section 5.4 to the existing markup — field labels, pill title input, ingredient/step row appearance, tag-picker chips (already matches section 5's "Samling" chip-row description functionally; just restyle colors: selected = `--color-accent` fill / `--color-bg` text, unselected = `1px solid var(--color-neutral-400)` outline). For the image input, wrap the existing `<input type="file">` in a styled label matching section 5.5's pill-with-icon-circle look (a `<label>` wrapping a visually-hidden `<input type="file">` is the standard accessible pattern — don't remove the native input, just hide it visually and trigger it via the styled label). Do not change any state, handlers, or prop interfaces in this file — CSS/JSX-wrapper changes only.

- [ ] **Step 4: Clean up superseded code**

Once `OppskriftPage` and `NyOppskriftPage` are both working and manually verified (Step 5), delete `src/components/AddRecipeForm.tsx` (fully replaced by `NyOppskriftPage`) and remove `RecipeList.tsx`'s inline-edit/delete-confirm code path (the `editingId`/`confirmingDeleteId` state and related JSX) since that role now lives in `OppskriftPage` — but leave `RecipeList.tsx`'s card-grid/filtering code in place for now; it's still needed as reference/until Task 7 replaces its remaining role. If deleting `AddRecipeForm.tsx` breaks any remaining import (there shouldn't be one after Task 2's `App.tsx` rewrite — double check), fix the import instead of leaving dead code.

- [ ] **Step 5: Verify**

Run: `npm run build && npm run lint`

Manually: log in, navigate to `/ny`, create a test recipe through both entry paths (`Skriv selv` and `Fra bilde` with a real recipe URL), confirm it saves and you land back appropriately. Navigate to `/oppskrift/<its-id>`, confirm the layout matches section 3 at 390px width, confirm `Endre` only shows for your own recipes, test editing and deleting. Compare side-by-side against `design/handoff/Kokeboka - 1b.dc.html`'s "Oppskrift" and "Ny oppskrift" panels.

- [ ] **Step 6: Commit**

```bash
git add src/pages/OppskriftPage.tsx src/pages/NyOppskriftPage.tsx src/components/RecipeForm.tsx src/App.css
git rm src/components/AddRecipeForm.tsx
git commit -m "Implementer Oppskrift- og Ny oppskrift-skjermene i det nye designet"
```

(Adjust the `git add`/`git rm` list to match whatever `RecipeList.tsx` cleanup you actually did in Step 4.)

---

## Task 4: Kokemodus

**Files:**
- Modify: `src/pages/KokemodusPage.tsx` (full implementation)
- Modify: `src/App.css` (dark-screen styles)

**Interfaces:**
- Consumes: `useApp()` (`recipes`, `cookingSession`, `setCookingSession` from Task 2).
- Produces: nothing new consumed elsewhere except that `HjemPage`'s "Sist brukt" card (Task 7) reads `cookingSession` written here.

- [ ] **Step 1: Implement the page**

Follow section 4 exactly:
- Find the recipe via `useParams`/`recipes`, same not-found handling as `OppskriftPage`.
- Local `stepIndex` state, initialized from `cookingSession?.recipeId === id ? cookingSession.stepIndex : 0`.
- Call `setCookingSession({ recipeId: id, stepIndex })` on every step change (a `useEffect` keyed on `stepIndex` is simplest). On reaching the last step and clicking `Ferdig`, call `setCookingSession(null)` and `navigate(`/oppskrift/${id}`)`.
- Wake lock: request `navigator.wakeLock.request('screen')` on mount inside a try/catch (the API can reject, e.g. low battery), store the returned `WakeLockSentinel` in a ref, `.release()` it on unmount, and re-request on the `visibilitychange` event when `document.visibilityState === 'visible'` and the sentinel was released. Track whether a lock is currently held in state to show/hide "Skjermen står på"; if `'wakeLock' in navigator` is false, never show that label at all.
- "Du trenger nå" panel: match ingredient names into the current step's text via simple substring search (`recipe.ingredients.filter(i => !i.isHeading && step.toLowerCase().includes(i.name.toLowerCase()))`), join matched ingredient names with ` · `. Hide the panel entirely when the match list is empty.
- Swipe: a `touchstart`/`touchend` pair on the step-body container comparing `clientX` delta (threshold ~50px) to call the same next/back handlers as the footer buttons. Keep it simple — no gesture library.
- Back button disabled on step 1 (`stepIndex === 0`); Next becomes `Ferdig` on the last step.

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`

Manually: start cooking mode on a multi-step recipe, confirm step progress pills, swipe/tap through steps, confirm the "Du trenger nå" panel appears/hides correctly for at least one step where an ingredient name appears in the step text, confirm wake lock doesn't throw in the console (Chrome desktop supports the API; if testing somewhere it doesn't, confirm the label is simply absent, not broken), confirm `Ferdig` on the last step navigates back and clears `cookingSession` (check via `localStorage.getItem('kokeboka.cooking')` in devtools — should be removed).

- [ ] **Step 3: Commit**

```bash
git add src/pages/KokemodusPage.tsx src/App.css
git commit -m "Implementer Kokemodus-skjermen"
```

---

## Task 5: Søk

**Files:**
- Modify: `src/pages/SokPage.tsx` (full implementation)
- Modify: `src/App.css` (search screen styles)

**Interfaces:**
- Consumes: `useApp()` (`recipes`, `filters`, `setFilters`, `availableTags`, `profiles`).

- [ ] **Step 1: Implement the page**

Follow section 6:
- Autofocus the input on mount (a `ref` + `useEffect` calling `.focus()`).
- Debounce the query 150ms before filtering (a `useEffect` with `setTimeout`/`clearTimeout` updating a separate `debouncedQuery` state — no library needed).
- Search over `recipe.title`, each `ingredient.name`, and each step string, case-insensitive substring match.
- Filter chips: accent chip = `filters.tag` (reuse `TAGS`/`availableTags` from context), sage chip = `filters.ownerId` (reuse the profile list — same data `RecipeList.tsx` uses today for its owner tabs). Clicking a chip toggles it via `setFilters`. `Under 30 min`/`Har bilde` chips render but are visually disabled/non-interactive (45% opacity, no click handler) per the handoff's explicit "deferred" note — do not wire them to `total_minutes`/`image_url` since the handoff says to wait for real data conventions later; a chip that silently does nothing is worse than one that visibly can't be pressed yet.
- Snippet: for the first match found (title, then ingredients, then steps, in that order), take ±30 characters around the match, wrap the matched substring in a `<mark>` styled per the tokens (`--color-accent-200` background, `--color-accent-800`-equivalent text — the closest listed token; check the table again since the README lists `accent-200`/text color pairing slightly differently for `<mark>` vs the row's own note — follow the README's own wording literally here since it's explicit: "wrapped in --color-accent-200 fill / --color-accent-800 text").
- Empty state and result count line exactly as specified.

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`

Manually: type a query matching a title, an ingredient, and a step in three different recipes; confirm all three show with correct highlighted snippets; confirm the count line; clear the query and confirm the empty/initial state (the handoff doesn't specify what shows before any query is typed — use your judgment, e.g. no results section at all until there's a query, and note your choice in the report).

- [ ] **Step 3: Commit**

```bash
git add src/pages/SokPage.tsx src/App.css
git commit -m "Implementer Søk-skjermen"
```

---

## Task 6: Profil

**Files:**
- Modify: `src/pages/ProfilPage.tsx` (full implementation)
- Modify: `src/App.css` (profile screen styles)
- Modify: `src/components/Login.tsx` (restyle only, per the same "no logic changes" rule as `RecipeForm`)

**Interfaces:**
- Consumes: `useApp()` (`session`, `recipes`, `profiles`, `availableTags` for the "collection count" stat — see ruling below).

- [ ] **Step 1: Implement the page**

Follow section 7, with these rulings (no spec coverage in the handoff for these, since it assumed the `collections` table):
- "Collection count" stat = `availableTags.length` restricted to tags actually in use (same `tagsWithRecipes` computation `RecipeList.tsx` already does today) — a count of unused tags in the fixed `TAGS` list would be a meaningless "collection count" to show a user.
- "Member count" stat = `profiles.length`.
- Settings toggles ("Alle med lenken kan lese", "Vis navnet mitt"): display-only per Global Constraints — render the correct visual state, `disabled` or otherwise non-interactive, no click handler doing anything.
- "Offline-lagring": best-effort real count — `await caches.open('supabase-cache')` (this cache name comes from `vite.config.ts`'s existing `VitePWA` `runtimeCaching` config; confirm the name matches before using it) then `.keys()`, count how many cached request URLs include any current recipe's `image_url`, show `"{count} av {recipes.length}"`. If the Cache API throws or the cache doesn't exist yet (e.g. first load, nothing cached), show `"0 av {recipes.length}"` rather than erroring.
- "Legg til på hjemskjerm": capture the `beforeinstallprompt` event in a `useEffect` (`e.preventDefault()`, store the event in a ref/state), call `.prompt()` on click. If the event never fires (already installed, or a browser that doesn't support it, e.g. iOS Safari), hide this row entirely rather than showing a button that does nothing.
- Signed-out state: render the restyled `Login` form in place of the identity block and both groups, per the handoff.

- [ ] **Step 2: Restyle `Login.tsx`**

Apply section 7's closing note (labels 12px `--color-neutral-700`, pill inputs, accent CTA button) — CSS/JSX-wrapper only, no changes to the email/password state or `signInWithPassword` call.

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`

Manually: view `/meg` both signed in and signed out; confirm the stat numbers are correct against your actual data; confirm the offline-storage count changes after you've browsed a few recipes (revisit `/meg` after loading some recipe images); confirm "Legg til på hjemskjerm" either prompts or is absent depending on your browser/install state; confirm "Logg ut" works.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProfilPage.tsx src/components/Login.tsx src/App.css
git commit -m "Implementer Profil-skjermen"
```

---

## Task 7: Migrasjon + Hjem sitt samlings-grid (tags) + Samling(tag)-siden

**Files:**
- Create: `supabase/migration_recipe_header_fields.sql`
- Modify: `src/pages/HjemPage.tsx` (full implementation)
- Modify: `src/pages/SamlingPage.tsx` (full implementation)
- Modify: `src/App.css` (home + collection/tag screen styles)
- Delete: `src/components/RecipeList.tsx` (once nothing references it — see Step 4)

**Interfaces:**
- Consumes: `useApp()` (everything — `session`, `recipes`, `profiles`, `loading`, `availableTags`, `cookingSession`).

- [ ] **Step 1: Create the migration file**

Create `supabase/migration_recipe_header_fields.sql`:

```sql
-- Kokeboka — valgfrie felt i oppskriftshodet (beskrivelse, tid, porsjoner).
-- Kjør i Supabase Dashboard -> SQL Editor -> New query.
-- Trygt å kjøre på nytt (idempotent), i samme stil som supabase/schema.sql.
--
-- NB: dette er en egen, mindre fil enn design/handoff/migration_collections.sql
-- med hensikt - vi bruker det eksisterende tag-systemet (recipes.tags) for
-- "Samlinger" i stedet for handoff-ens foreslåtte collections/collection_recipes
-- -tabeller, så de opprettes ikke.

alter table recipes add column if not exists description text;
alter table recipes add column if not exists total_minutes int;
alter table recipes add column if not exists servings int;
```

This task does not require you to actually run it against the live database — the user runs it manually, same as every prior schema change in this project. The frontend code in this task must work whether or not it's been run (see Global Constraints).

- [ ] **Step 2: Implement `HjemPage`**

Follow section 1, with the tag-based collections deviation:
- Greeting: time-of-day logic (`God morgen` before 11, `God dag` 11–17, `God kveld` after 17, using `new Date().getHours()`), name from `profiles.find(p => p.id === session?.user.id)?.display_name`. When signed out, omit the kicker line, show only `Kokeboka`.
- Search field navigates to `/sok` on click/focus (a `readOnly` input that navigates on click is simplest and matches "tapping navigates" — don't build a second live-search here).
- "Sist brukt" card: reads `cookingSession` from context; find the matching recipe by `cookingSession.recipeId`; hide the whole card when `cookingSession` is null or the recipe can't be found. `Fortsett` navigates to `/oppskrift/${cookingSession.recipeId}/kok`.
- Collection grid: compute the tag list exactly as `tagsWithRecipes` does in today's `RecipeList.tsx` (tags from `availableTags` that have at least one recipe), map each to `{ tag, count: recipes.filter(r => r.tags.includes(tag)).length }`. Render as the two-column grid from section 1.5, dot color cycling `--color-accent-100` / `--color-accent-2-100` / `--color-neutral-300` by index modulo 3. Each card links to `/samling/${encodeURIComponent(tag)}`. Do NOT render a "Ny samling" card (per Global Constraints deviation #3 from the user).
- Floating "+" only when `session` is truthy, navigates to `/ny`.
- Empty state (`recipes.length === 0`): keep header + search field, replace the grid with the existing copy.

- [ ] **Step 3: Implement `SamlingPage`**

Follow section 2, with the tag deviation:
- Get the tag via `useParams<{ tag: string }>()` (remember to `decodeURIComponent` it, since `HjemPage`/search link to it URL-encoded).
- Filter recipes: `recipes.filter(r => r.tags.includes(tag))`.
- Header: title = the tag itself; dot color = derive the same index-modulo-3 color this tag got in `HjemPage`'s grid (recompute the same `tagsWithRecipes` list and find this tag's index, so the color is consistent between the two screens) — do not invent a separate color mapping. There is no per-tag "description" anywhere in this app (that was a `collections.description` column we're not creating) — omit the description line entirely; the handoff's `max-width:280px` description paragraph simply never renders for tags.
- **Drop the sharing row entirely** (avatars + "X deler denne") per the user's explicit deviation #4 — there's no membership concept for a tag. Do not render any placeholder in its place.
- Recipe list rows: title + `total_minutes` (only when non-null, else omit that meta line — same null-tolerant pattern as everywhere else in this plan) + an optional right-aligned tag pill. For the optional tag pill: show the first tag on that recipe that isn't the current route tag, if any exist; omit the pill if the recipe has no other tags. Each row links to `/oppskrift/${recipe.id}` and MUST pass `state={{ fromTag: tag }}` so `OppskriftPage`'s back link (Task 3) shows the tag name instead of "Kokeboka".
- Footer "Kopier lenke til samlingen": copy `${window.location.origin}/samling/${encodeURIComponent(tag)}`, same copy-confirmation pattern as `OppskriftPage`'s "Del".
- Nav bar `Del` button: same link-copy behavior as the footer button (the handoff lists both — implement once and reuse, e.g. a small local function both buttons call).

- [ ] **Step 4: Delete `RecipeList.tsx`**

By this point nothing should import `RecipeList.tsx` (Task 3 removed its inline-edit role from active use, and this task's `HjemPage`/`SamlingPage` now own the card/list rendering it used to do). Grep for `RecipeList` across `src/` to confirm zero remaining imports, then delete the file. If something still imports it, that's a signal a prior task's cleanup step was skipped — fix the actual remaining usage rather than leaving the file in place "just in case."

- [ ] **Step 5: Verify**

Run: `npm run build && npm run lint`

Manually, at 390×844: check `Hjem`'s greeting changes sensibly (you can temporarily fake the hour in devtools console via `new Date().getHours()` mental math, or just check it's plausible for the current time), confirm the collection grid shows real tags with correct counts, click into a couple of tags and confirm `/samling/:tag` filters correctly and the dot color matches between the two screens, confirm clicking a recipe row and then the back link returns you correctly labeled. Compare against `design/handoff/Kokeboka - 1b.dc.html`'s "Hjem" and "Samling" panels.

If you're able to run the migration yourself against a test/dev Supabase project, do so and confirm `description`/`total_minutes`/`servings` show up correctly on `OppskriftPage`/`SamlingPage` once populated; if not, note in the report that this remains user-verified only.

- [ ] **Step 6: Commit**

```bash
git add supabase/migration_recipe_header_fields.sql src/pages/HjemPage.tsx src/pages/SamlingPage.tsx src/App.css
git rm src/components/RecipeList.tsx
git commit -m "Kjør migrasjon for oppskriftsfelt og implementer Hjem sitt samlings-grid (tags) og Samling-siden"
```

---

## Self-Review Notes

- **Spec coverage:** all seven screens (Oppskrift/Ny oppskrift in Task 3, Kokemodus in Task 4, Søk in Task 5, Profil in Task 6, Hjem/Samling in Task 7) map to a task; tokens/router/context (Tasks 1–2) are the foundation both depend on. The tag-vs-collections deviation is threaded through every task that touches it (Task 3's `RecipeForm` tag picker was already correct and untouched; Task 6's stat count; Task 7's grid/page). The migration is scoped to exactly the three columns the user approved, in its own file.
- **Placeholder scan:** no task says "add appropriate styling" without pointing at the specific README section; every genuinely unspecified behavior (not-found recipe, search's pre-query state, Avbryt's reset-vs-navigate choice, which entry-card path "Fra bilde" takes) is called out explicitly as a judgment call the implementer makes and reports, not silently invented.
- **Type/interface consistency:** `AppContextValue` defined once in Task 2 is the single shape every later task consumes; `RecipeFormValues`/`RecipeForm` props are explicitly unchanged throughout (Tasks 3 and 6 restyle `RecipeForm.tsx`/`Login.tsx` without touching their exported prop types).
- **Known open risk carried into the plan:** Task 2's icon-name verification step (checking `lucide-react`'s actual exports) and Task 1's font-loading are the two places most likely to need a small correction once a real install happens — both are called out as things to verify against the installed package/browser rather than assumed correct from memory.
