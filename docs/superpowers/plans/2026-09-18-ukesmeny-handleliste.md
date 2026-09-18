# Ukesmeny og Handleliste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new screens (Ukesmeny, Handleliste) with family/personal scoping, matching the existing `collections` pattern, plus Hjem cards for both.

**Architecture:** Three new Postgres tables (`menu_days`, `shopping_checked_items`, `manual_shopping_items`) mirroring `collections`'s family-vs-personal scoping and RLS. Two new lib modules (`menuDays.ts`, `shoppingList.ts`) for data access + pure aggregation logic. Two new pages (`UkesmenyPage`, `HandlelistePage`) styled per `design/handoff-ukesmeny/`. Handleliste has no stored ingredient rows — it's a live view computed from `menu_days` + `recipes.ingredients`, with only checked-state and manual items persisted.

**Tech Stack:** React 19 + react-router-dom 7, Supabase (Postgres + RLS, no new RPCs needed), TypeScript, vitest-less `node --test` for pure-logic unit tests (see `src/lib/recipePermissions.test.ts` for the existing pattern).

**Spec:** The full Norwegian functional spec was given directly in chat (not a file) — this plan is written to satisfy it in full; ask the user if anything here appears to contradict it. Visual spec: `design/handoff-ukesmeny/README.md` and `design/handoff-ukesmeny/Kokeboka - 1b.dc.html` (screens "Ukesmeny", "Bekreft ny ukesmeny", "Handleliste").

## Global Constraints

- Never commit or push to `main` directly — all work happens on `feature/ukesmeny-handleliste` (already created from up-to-date `main`).
- Do not merge or push — the user merges manually.
- Family scoping must exactly mirror `collections`: `family_id` NULL = personal (scoped by `owner_id`/`created_by`), set = shared read/write by all family members (no admin-only restriction). Use the same two-partial-unique-index pattern as `collections_family_name_key` / `collections_personal_owner_name_key`.
- No new RPCs/security-definer functions — plain RLS like `collections`, not like `family_shares`.
- Only one active menu + shopping list per scope; no history, no week picker.
- Handleliste has no "generate" action — always a live computed view.
- `npm run build` must succeed before each commit that touches TypeScript.

---

### Task 1: Migration SQL — tables, indexes, RLS

**Files:**
- Create: `supabase/migration_ukesmeny_handleliste.sql`

**Interfaces:**
- Produces: tables `menu_days`, `shopping_checked_items`, `manual_shopping_items` with columns exactly as below — later tasks' lib code depends on these names/types.

- [ ] **Step 1: Write the migration file**

```sql
-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- schema.sql, migration_recipe_header_fields.sql og migration_family_groups.sql.
-- Trygt å kjøre på nytt (idempotent).

create table if not exists menu_days (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),      -- NULL = personlig
  owner_id uuid not null references auth.users(id) default auth.uid(),
  weekday smallint not null check (weekday between 0 and 6), -- 0 = mandag ... 6 = søndag
  entry_type text check (entry_type in ('recipe', 'freetext')),
  recipe_id uuid references recipes(id) on delete set null,
  freetext text,
  updated_at timestamptz not null default now(),
  constraint menu_days_entry_matches_type check (
    (entry_type = 'recipe' and recipe_id is not null and freetext is null)
    or (entry_type = 'freetext' and freetext is not null and trim(freetext) <> '' and recipe_id is null)
    or (entry_type is null and recipe_id is null and freetext is null)
  )
);

create unique index if not exists menu_days_family_weekday_key
  on menu_days (family_id, weekday) where family_id is not null;

create unique index if not exists menu_days_personal_owner_weekday_key
  on menu_days (owner_id, weekday) where family_id is null;

create table if not exists shopping_checked_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),      -- NULL = personlig
  owner_id uuid not null references auth.users(id) default auth.uid(),
  normalized_name text not null,
  unit text not null,
  checked_at timestamptz not null default now()
);

create unique index if not exists shopping_checked_family_key
  on shopping_checked_items (family_id, normalized_name, unit) where family_id is not null;

create unique index if not exists shopping_checked_personal_key
  on shopping_checked_items (owner_id, normalized_name, unit) where family_id is null;

create table if not exists manual_shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),      -- NULL = personlig
  owner_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table menu_days enable row level security;
alter table shopping_checked_items enable row level security;
alter table manual_shopping_items enable row level security;

-- menu_days: speiler collections-policyene (se migration_family_groups.sql)
drop policy if exists "Familie eller eier kan se menu_days" on menu_days;
create policy "Familie eller eier kan se menu_days"
  on menu_days for select
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier administrerer menu_days" on menu_days;
create policy "Familie eller eier administrerer menu_days"
  on menu_days for all
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  )
  with check (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier kan se shopping_checked_items" on shopping_checked_items;
create policy "Familie eller eier kan se shopping_checked_items"
  on shopping_checked_items for select
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier administrerer shopping_checked_items" on shopping_checked_items;
create policy "Familie eller eier administrerer shopping_checked_items"
  on shopping_checked_items for all
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  )
  with check (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier kan se manual_shopping_items" on manual_shopping_items;
create policy "Familie eller eier kan se manual_shopping_items"
  on manual_shopping_items for select
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier administrerer manual_shopping_items" on manual_shopping_items;
create policy "Familie eller eier administrerer manual_shopping_items"
  on manual_shopping_items for all
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  )
  with check (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );
```

- [ ] **Step 2: Ask the user to run this migration against their Supabase project** (this repo has no local Supabase stack — migrations are applied manually via the SQL Editor, per existing convention for `migration_family_groups.sql`). Note in the PR description that this step is required before the feature works.

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_ukesmeny_handleliste.sql
git commit -m "feat: add menu_days, shopping_checked_items, manual_shopping_items schema + RLS"
```

---

### Task 2: Types + `lib/menuDays.ts`

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/menuDays.ts`

**Interfaces:**
- Consumes: `supabase` client from `./supabaseClient`.
- Produces:
  - `type MenuEntryType = 'recipe' | 'freetext'`
  - `interface MenuDay { id: string; family_id: string | null; owner_id: string; weekday: number; entry_type: MenuEntryType | null; recipe_id: string | null; freetext: string | null; updated_at: string }`
  - `listMenuDays(familyId: string | null): Promise<MenuDay[]>`
  - `setMenuDayRecipe(familyId: string | null, weekday: number, recipeId: string): Promise<void>`
  - `setMenuDayFreetext(familyId: string | null, weekday: number, freetext: string): Promise<void>`
  - `clearMenuDay(familyId: string | null, weekday: number): Promise<void>`
  - `resetMenu(familyId: string | null): Promise<void>` — deletes all `menu_days` AND all `shopping_checked_items` for the scope (per spec: "Opprett ny ukesmeny" clears both).

- [ ] **Step 1: Add types to `src/types.ts`**

Add after the `Collection` interface:

```typescript
export type MenuEntryType = 'recipe' | 'freetext'

export interface MenuDay {
  id: string
  family_id: string | null
  owner_id: string
  weekday: number
  entry_type: MenuEntryType | null
  recipe_id: string | null
  freetext: string | null
  updated_at: string
}
```

- [ ] **Step 2: Write `src/lib/menuDays.ts`**

```typescript
import { supabase } from './supabaseClient'
import type { MenuDay } from '../types'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('Ikke innlogget.')
  return userId
}

// Familiens ukesmeny når familyId er satt, ellers den innloggede brukerens
// egen personlige ukesmeny (family_id NULL, scopet på owner_id) — speiler
// listCollections i src/lib/collections.ts.
export async function listMenuDays(familyId: string | null): Promise<MenuDay[]> {
  if (familyId) {
    const { data, error } = await supabase
      .from('menu_days')
      .select('*')
      .eq('family_id', familyId)
      .order('weekday', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('menu_days')
    .select('*')
    .is('family_id', null)
    .eq('owner_id', userId)
    .order('weekday', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function upsertDay(
  familyId: string | null,
  weekday: number,
  patch: Partial<Pick<MenuDay, 'entry_type' | 'recipe_id' | 'freetext'>>
): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('menu_days')
    .upsert(
      {
        family_id: familyId,
        owner_id: userId,
        weekday,
        entry_type: null,
        recipe_id: null,
        freetext: null,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: familyId ? 'family_id,weekday' : 'owner_id,weekday' }
    )
  if (error) throw error
}

export async function setMenuDayRecipe(
  familyId: string | null,
  weekday: number,
  recipeId: string
): Promise<void> {
  await upsertDay(familyId, weekday, { entry_type: 'recipe', recipe_id: recipeId, freetext: null })
}

export async function setMenuDayFreetext(
  familyId: string | null,
  weekday: number,
  freetext: string
): Promise<void> {
  await upsertDay(familyId, weekday, { entry_type: 'freetext', freetext, recipe_id: null })
}

export async function clearMenuDay(familyId: string | null, weekday: number): Promise<void> {
  await upsertDay(familyId, weekday, { entry_type: null, recipe_id: null, freetext: null })
}

export async function resetMenu(familyId: string | null): Promise<void> {
  const userId = await currentUserId()
  if (familyId) {
    const [a, b] = await Promise.all([
      supabase.from('menu_days').delete().eq('family_id', familyId),
      supabase.from('shopping_checked_items').delete().eq('family_id', familyId),
    ])
    if (a.error) throw a.error
    if (b.error) throw b.error
    return
  }
  const [a, b] = await Promise.all([
    supabase.from('menu_days').delete().is('family_id', null).eq('owner_id', userId),
    supabase.from('shopping_checked_items').delete().is('family_id', null).eq('owner_id', userId),
  ])
  if (a.error) throw a.error
  if (b.error) throw b.error
}
```

Note: Supabase's `upsert` `onConflict` needs the exact constraint columns; since we have two *partial* unique indexes (not a single composite unique constraint), `onConflict: 'family_id,weekday'` / `'owner_id,weekday'` targets those partial indexes by column list, which PostgREST supports as long as a matching unique index exists — this is the same mechanism `sync_recipe_tags_to_collections` relies on via `on conflict (family_id, name) where family_id is not null` in raw SQL. If upsert conflict targeting misbehaves in manual testing (Task 4 verification), fall back to a manual read-then-insert-or-update inside `upsertDay` instead of trusting `onConflict` — flag this to the user if so.

- [ ] **Step 3: `npm run build` to confirm no type errors, then commit**

```bash
git add src/types.ts src/lib/menuDays.ts
git commit -m "feat: add menu_days data access layer"
```

---

### Task 3: `lib/shoppingList.ts` — aggregation + checked/manual items (with unit test)

**Files:**
- Create: `src/lib/shoppingList.ts`
- Create: `src/lib/shoppingList.test.ts`

**Interfaces:**
- Consumes: `MenuDay` from `../types`, `Recipe`/`IngredientItem` from `../types`, `supabase`.
- Produces:
  - `interface AggregatedIngredient { normalizedName: string; displayName: string; unit: string; amount: number | null }`
  - `aggregateIngredients(menuDays: MenuDay[], recipes: Recipe[]): AggregatedIngredient[]` — pure function, unit-tested.
  - `interface CheckedItem { normalized_name: string; unit: string }`
  - `listCheckedItems(familyId: string | null): Promise<CheckedItem[]>`
  - `setItemChecked(familyId: string | null, normalizedName: string, unit: string): Promise<void>`
  - `setItemUnchecked(familyId: string | null, normalizedName: string, unit: string): Promise<void>`
  - `clearCheckedItems(familyId: string | null): Promise<void>` — "Tøm huket av".
  - `interface ManualItem { id: string; name: string }`
  - `listManualItems(familyId: string | null): Promise<ManualItem[]>`
  - `addManualItem(familyId: string | null, name: string): Promise<void>`
  - `removeManualItem(id: string): Promise<void>`

- [ ] **Step 1: Write the failing test for `aggregateIngredients`**

```typescript
// src/lib/shoppingList.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregateIngredients } from './shoppingList.ts'
import type { MenuDay, Recipe } from '../types.ts'

function recipe(id: string, ingredients: Recipe['ingredients']): Recipe {
  return {
    id,
    created_at: '',
    title: id,
    ingredients,
    steps: [],
    image_url: null,
    owner_id: 'u1',
    family_id: null,
    tags: [],
  }
}

function menuDay(weekday: number, recipeId: string): MenuDay {
  return {
    id: `d${weekday}`,
    family_id: null,
    owner_id: 'u1',
    weekday,
    entry_type: 'recipe',
    recipe_id: recipeId,
    freetext: null,
    updated_at: '',
  }
}

test('sums same normalized name + unit across recipes', () => {
  const recipes = [
    recipe('r1', [{ amount: 2, unit: 'dl', name: 'Melk' }]),
    recipe('r2', [{ amount: 1, unit: 'dl', name: ' melk ' }]),
  ]
  const days = [menuDay(0, 'r1'), menuDay(1, 'r2')]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 1)
  assert.equal(result[0].amount, 3)
  assert.equal(result[0].unit, 'dl')
  assert.equal(result[0].normalizedName, 'melk')
})

test('keeps different units as separate rows', () => {
  const recipes = [
    recipe('r1', [{ amount: 2, unit: 'dl', name: 'Melk' }]),
    recipe('r2', [{ amount: 3, unit: 'ss', name: 'Melk' }]),
  ]
  const days = [menuDay(0, 'r1'), menuDay(1, 'r2')]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 2)
})

test('treats differently-worded names as separate rows', () => {
  const recipes = [
    recipe('r1', [{ amount: 1, unit: 'stk', name: 'Paprika' }]),
    recipe('r2', [{ amount: 1, unit: 'stk', name: 'Rød paprika' }]),
  ]
  const days = [menuDay(0, 'r1'), menuDay(1, 'r2')]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 2)
})

test('excludes heading rows and freetext days', () => {
  const recipes = [
    recipe('r1', [
      { amount: null, unit: '', name: 'Til sausen', isHeading: true },
      { amount: 1, unit: 'stk', name: 'Løk' },
    ]),
  ]
  const days: MenuDay[] = [
    menuDay(0, 'r1'),
    {
      id: 'd1',
      family_id: null,
      owner_id: 'u1',
      weekday: 1,
      entry_type: 'freetext',
      recipe_id: null,
      freetext: 'Taco',
      updated_at: '',
    },
  ]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 1)
  assert.equal(result[0].normalizedName, 'løk')
})

test('same recipe on multiple days is counted once per day (not deduplicated)', () => {
  const recipes = [recipe('r1', [{ amount: 1, unit: 'stk', name: 'Løk' }])]
  const days = [menuDay(0, 'r1'), menuDay(2, 'r1')]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 1)
  assert.equal(result[0].amount, 2)
})
```

- [ ] **Step 2: Run test to verify it fails (module doesn't exist yet)**

Run: `npm test`
Expected: FAIL — cannot find module `./shoppingList.ts` or similar.

- [ ] **Step 3: Write `src/lib/shoppingList.ts`**

```typescript
import { supabase } from './supabaseClient'
import type { MenuDay, Recipe } from '../types'

export interface AggregatedIngredient {
  normalizedName: string
  displayName: string
  unit: string
  amount: number | null
}

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

// Summerer ingredienser fra alle oppskrift-dager i menuDays (kun
// entry_type 'recipe' — fritekst-dager bidrar ikke). Matcher kun rader med
// samme normalisert navn OG samme enhet; isHeading-rader ekskluderes.
// Ingen porsjons-skalering — mengder brukes as-is uansett recipes.servings.
export function aggregateIngredients(menuDays: MenuDay[], recipes: Recipe[]): AggregatedIngredient[] {
  const recipesById = new Map(recipes.map((r) => [r.id, r]))
  const byKey = new Map<string, AggregatedIngredient>()

  for (const day of menuDays) {
    if (day.entry_type !== 'recipe' || !day.recipe_id) continue
    const recipe = recipesById.get(day.recipe_id)
    if (!recipe) continue

    for (const ingredient of recipe.ingredients) {
      if (ingredient.isHeading) continue
      const normalizedName = normalize(ingredient.name)
      const unit = ingredient.unit
      const key = `${normalizedName} ${unit}`
      const existing = byKey.get(key)
      if (existing) {
        if (existing.amount !== null && ingredient.amount !== null) {
          existing.amount += ingredient.amount
        } else if (ingredient.amount !== null) {
          existing.amount = ingredient.amount
        }
      } else {
        byKey.set(key, {
          normalizedName,
          displayName: ingredient.name.trim(),
          unit,
          amount: ingredient.amount,
        })
      }
    }
  }

  return [...byKey.values()]
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('Ikke innlogget.')
  return userId
}

export interface CheckedItem {
  normalized_name: string
  unit: string
}

export async function listCheckedItems(familyId: string | null): Promise<CheckedItem[]> {
  const query = supabase.from('shopping_checked_items').select('normalized_name, unit')
  const { data, error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
  return data ?? []
}

export async function setItemChecked(
  familyId: string | null,
  normalizedName: string,
  unit: string
): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('shopping_checked_items')
    .upsert(
      { family_id: familyId, owner_id: userId, normalized_name: normalizedName, unit },
      { onConflict: familyId ? 'family_id,normalized_name,unit' : 'owner_id,normalized_name,unit' }
    )
  if (error) throw error
}

export async function setItemUnchecked(
  familyId: string | null,
  normalizedName: string,
  unit: string
): Promise<void> {
  const query = supabase
    .from('shopping_checked_items')
    .delete()
    .eq('normalized_name', normalizedName)
    .eq('unit', unit)
  const { error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
}

export async function clearCheckedItems(familyId: string | null): Promise<void> {
  const query = supabase.from('shopping_checked_items').delete()
  const { error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
}

export interface ManualItem {
  id: string
  name: string
}

export async function listManualItems(familyId: string | null): Promise<ManualItem[]> {
  const query = supabase.from('manual_shopping_items').select('id, name').order('created_at', { ascending: true })
  const { data, error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
  return data ?? []
}

export async function addManualItem(familyId: string | null, name: string): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('manual_shopping_items')
    .insert({ family_id: familyId, owner_id: userId, name: name.trim() })
  if (error) throw error
}

export async function removeManualItem(id: string): Promise<void> {
  const { error } = await supabase.from('manual_shopping_items').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all 5 `aggregateIngredients` tests).

- [ ] **Step 5: `npm run build` to confirm no type errors, then commit**

```bash
git add src/lib/shoppingList.ts src/lib/shoppingList.test.ts
git commit -m "feat: add shopping list aggregation and checked/manual item data access"
```

---

### Task 4: `UkesmenyPage` + route + day components + Hjem card

**Files:**
- Create: `src/pages/UkesmenyPage.tsx`
- Create: `src/components/RecipePickerDialog.tsx` (bottom-sheet recipe search/select, reused nowhere else yet but factored out for readability)
- Modify: `src/App.tsx` (add `/ukesmeny` route)
- Modify: `src/pages/HjemPage.tsx` (add Ukesmeny + Handleliste cards above/near Samlinger — Handleliste card wired in Task 6)
- Modify: `src/App.css` (styles matching `design/handoff-ukesmeny/styles.css` tokens — this repo already defines `--color-*`/`--radius-lg`/`.k-card`/`.cta-button` etc. in `src/theme.css`/`src/App.css`; add only the new classes: `.ukesmeny-day`, `.ukesmeny-day-empty`, `.ukesmeny-day-abbr`, `.ukesmeny-day-title`, `.ukesmeny-day-freetext-tag`, `.ukesmeny-day-chevron`, `.ukesmeny-confirm-backdrop`, `.ukesmeny-confirm-sheet`, and Hjem card class `.hjem-menu-card`)

**Interfaces:**
- Consumes: `listMenuDays`, `setMenuDayRecipe`, `setMenuDayFreetext`, `clearMenuDay`, `resetMenu` from `../lib/menuDays`; `useApp()` for `family`, `familyLoading`, `recipes`, `session`.
- Produces: route `/ukesmeny`; nothing consumed by later tasks except the Hjem card pattern reused for Handleliste.

- [ ] **Step 1: Check existing CSS tokens before writing new classes**

Run a read of `src/theme.css` and `src/App.css` to confirm `--color-accent`, `--color-neutral-400/500/600/700`, `--color-divider`, `--radius-lg`, `.k-card`, `.cta-button`, `.nav-bar`, `.nav-link`, `.oppskrift-title` already exist (they do, per `SamlingerPage`/`FamiliePage` usage above) — reuse them rather than redefining.

- [ ] **Step 2: Write `src/components/RecipePickerDialog.tsx`**

```typescript
import { useState } from 'react'
import type { Recipe } from '../types'

interface Props {
  recipes: Recipe[]
  onPick: (recipeId: string) => void
  onFreetext: (text: string) => void
  onClear?: () => void
  onClose: () => void
}

export function RecipePickerDialog({ recipes, onPick, onFreetext, onClear, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [freetext, setFreetext] = useState('')

  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="del-dialog-backdrop" onClick={onClose}>
      <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="del-dialog-title">Velg for dagen</h2>
        <input
          type="text"
          className="del-dialog-input"
          placeholder="Søk etter oppskrift"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="samling-recipe-list" style={{ maxHeight: 200, overflowY: 'auto' }}>
          {filtered.map((recipe) => (
            <button
              type="button"
              key={recipe.id}
              className="samling-recipe-row"
              onClick={() => onPick(recipe.id)}
            >
              <span className="samling-recipe-title">{recipe.title}</span>
            </button>
          ))}
        </div>
        <p className="del-dialog-body" style={{ marginTop: 12 }}>
          Eller skriv noe fritt (teller ikke med i handlelisten):
        </p>
        <input
          type="text"
          className="del-dialog-input"
          placeholder="F.eks. Taco, Rester"
          value={freetext}
          onChange={(e) => setFreetext(e.target.value)}
        />
        <div className="del-dialog-actions">
          <button type="button" className="del-dialog-cancel" onClick={onClose}>
            Avbryt
          </button>
          <button
            type="button"
            className="del-dialog-submit"
            disabled={!freetext.trim()}
            onClick={() => freetext.trim() && onFreetext(freetext.trim())}
          >
            Bruk fritekst
          </button>
        </div>
        {onClear && (
          <button type="button" className="familie-leave-button" style={{ marginTop: 10 }} onClick={onClear}>
            Tøm dagen
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/pages/UkesmenyPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { listMenuDays, setMenuDayRecipe, setMenuDayFreetext, clearMenuDay, resetMenu } from '../lib/menuDays'
import { RecipePickerDialog } from '../components/RecipePickerDialog'
import type { MenuDay } from '../types'

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

export function UkesmenyPage() {
  const navigate = useNavigate()
  const { family, familyLoading, recipes } = useApp()
  const [days, setDays] = useState<MenuDay[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWeekday, setEditingWeekday] = useState<number | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const familyId = family?.id ?? null

  useEffect(() => {
    if (familyLoading) return
    listMenuDays(familyId).then((rows) => {
      setDays(rows)
      setLoading(false)
    })
  }, [familyId, familyLoading])

  function dayFor(weekday: number): MenuDay | undefined {
    return days.find((d) => d.weekday === weekday)
  }

  async function reload() {
    setDays(await listMenuDays(familyId))
  }

  async function handlePick(recipeId: string) {
    if (editingWeekday === null) return
    setBusy(true)
    try {
      await setMenuDayRecipe(familyId, editingWeekday, recipeId)
      await reload()
      setEditingWeekday(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleFreetext(text: string) {
    if (editingWeekday === null) return
    setBusy(true)
    try {
      await setMenuDayFreetext(familyId, editingWeekday, text)
      await reload()
      setEditingWeekday(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleClearDay() {
    if (editingWeekday === null) return
    setBusy(true)
    try {
      await clearMenuDay(familyId, editingWeekday)
      await reload()
      setEditingWeekday(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleResetMenu() {
    setBusy(true)
    try {
      await resetMenu(familyId)
      await reload()
      setShowConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page ukesmeny-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/')}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Kokeboka
        </button>
      </nav>

      <h1 className="oppskrift-title">Ukesmeny</h1>

      {loading ? (
        <p className="status-message">Laster ukesmeny...</p>
      ) : (
        <div className="ukesmeny-days">
          {WEEKDAY_LABELS.map((label, weekday) => {
            const day = dayFor(weekday)
            if (!day || !day.entry_type) {
              return (
                <button
                  type="button"
                  key={weekday}
                  className="ukesmeny-day ukesmeny-day-empty"
                  onClick={() => setEditingWeekday(weekday)}
                >
                  <span className="ukesmeny-day-abbr">{label}</span>
                  <span className="ukesmeny-day-empty-text">Legg til oppskrift eller skriv noe</span>
                  <span aria-hidden="true">+</span>
                </button>
              )
            }
            if (day.entry_type === 'freetext') {
              return (
                <button
                  type="button"
                  key={weekday}
                  className="ukesmeny-day"
                  onClick={() => setEditingWeekday(weekday)}
                >
                  <span className="ukesmeny-day-abbr">{label}</span>
                  <span className="ukesmeny-day-title">{day.freetext}</span>
                  <span className="ukesmeny-day-freetext-tag">fritekst</span>
                </button>
              )
            }
            const recipe = recipes.find((r) => r.id === day.recipe_id)
            return (
              <button
                type="button"
                key={weekday}
                className="ukesmeny-day"
                onClick={() => setEditingWeekday(weekday)}
              >
                <span className="ukesmeny-day-abbr">{label}</span>
                <span className="ukesmeny-day-title">{recipe?.title ?? 'Slettet oppskrift'}</span>
                <span className="ukesmeny-day-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!loading && (
        <div className="fade">
          <button type="button" className="cta-button" onClick={() => setShowConfirm(true)}>
            Opprett ny ukesmeny
          </button>
        </div>
      )}

      {editingWeekday !== null && (
        <RecipePickerDialog
          recipes={recipes}
          onPick={handlePick}
          onFreetext={handleFreetext}
          onClear={dayFor(editingWeekday)?.entry_type ? handleClearDay : undefined}
          onClose={() => !busy && setEditingWeekday(null)}
        />
      )}

      {showConfirm && (
        <div className="ukesmeny-confirm-backdrop" onClick={() => !busy && setShowConfirm(false)}>
          <div className="ukesmeny-confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="del-dialog-title">Ny ukesmeny?</h2>
            <p className="del-dialog-body">
              Dette tømmer alle dagene og handlelisten. Egne varer blir stående. Du kan ikke angre.
            </p>
            <div className="del-dialog-actions">
              <button type="button" className="del-dialog-cancel" onClick={() => setShowConfirm(false)} disabled={busy}>
                Avbryt
              </button>
              <button type="button" className="del-dialog-submit" onClick={handleResetMenu} disabled={busy}>
                {busy ? 'Tømmer...' : 'Tøm og start ny'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add route in `src/App.tsx`**

```typescript
import { UkesmenyPage } from './pages/UkesmenyPage'
// ...
<Route path="/ukesmeny" element={<UkesmenyPage />} />
```
(Add the import next to the other page imports, and the route next to `/samlinger`.)

- [ ] **Step 5: Add CSS classes to `src/App.css`**

Append (matching tokens from `design/handoff-ukesmeny/styles.css`, reusing this repo's existing `--color-*`/`--radius-lg` variables already defined in `src/theme.css`):

```css
.ukesmeny-days {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.ukesmeny-day {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: none;
  text-align: left;
  cursor: pointer;
}

.ukesmeny-day-empty {
  background: transparent;
  border: 1px dashed var(--color-neutral-400);
  color: var(--color-neutral-600);
}

.ukesmeny-day-abbr {
  width: 34px;
  text-align: center;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-neutral-700);
  flex: none;
}

.ukesmeny-day-empty .ukesmeny-day-abbr {
  color: var(--color-neutral-600);
}

.ukesmeny-day-title {
  flex: 1;
  font: 400 17px/1.2 var(--font-heading);
}

.ukesmeny-day-empty-text {
  flex: 1;
  font-size: 14px;
}

.ukesmeny-day-freetext-tag {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-neutral-500);
}

.ukesmeny-day-chevron {
  font-size: 11px;
  color: var(--color-neutral-500);
}

.ukesmeny-confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(32, 30, 29, 0.42);
  display: flex;
  align-items: flex-end;
  z-index: 50;
}

.ukesmeny-confirm-sheet {
  width: 100%;
  background: var(--color-bg);
  border-radius: 28px 28px 0 0;
  padding: 26px 24px 34px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

- [ ] **Step 6: `npm run build`, then manually verify in `npm run dev`**

Open `/ukesmeny` at 390×844, compare against `design/handoff-ukesmeny/Kokeboka - 1b.dc.html`'s "Ukesmeny" and "Bekreft ny ukesmeny" screens. Check: picking a recipe for a day saves and shows immediately; typing freetext shows the "fritekst" tag; clearing a day returns it to the dashed empty state; "Opprett ny ukesmeny" shows the confirm sheet and resets all days on confirm.

- [ ] **Step 7: Commit**

```bash
git add src/pages/UkesmenyPage.tsx src/components/RecipePickerDialog.tsx src/App.tsx src/App.css
git commit -m "feat: add Ukesmeny page with day editing and reset confirmation"
```

---

### Task 5: Hjem "Ukesmeny" card

**Files:**
- Modify: `src/pages/HjemPage.tsx`
- Modify: `src/App.css` (`.hjem-menu-card` — or reuse existing `.k-card`-derived class if one already exists for small home cards; check `App.css` first)

**Interfaces:**
- Consumes: `listMenuDays` from `../lib/menuDays`, `family`/`familyLoading`/`recipes` from `useApp()`.

- [ ] **Step 1: Check `App.css` for an existing small-card class used on Hjem** (e.g. search for `.hjem-collection-card` styling) and follow the same visual pattern for the new menu/shopping cards, per the design's `k-card` treatment at lines 45–52 of the handoff HTML.

- [ ] **Step 2: Add state + effect to `HjemPage.tsx`**

Add near the top of the component body (after existing `useApp()` destructure, extend it to also pull `family`, `familyLoading`):

```typescript
import { useEffect, useState } from 'react'
import { listMenuDays } from '../lib/menuDays'
import type { MenuDay } from '../types'

// inside component:
const { family, familyLoading } = useApp() // merge into existing destructure
const [todayMenu, setTodayMenu] = useState<MenuDay | null>(null)

useEffect(() => {
  if (familyLoading || !session) return
  const isoWeekday = (new Date().getDay() + 6) % 7 // JS: 0=søn -> 0=man
  listMenuDays(family?.id ?? null).then((rows) => {
    setTodayMenu(rows.find((d) => d.weekday === isoWeekday && d.entry_type) ?? null)
  })
}, [family, familyLoading, session])
```

- [ ] **Step 3: Render the card**, placed next to where a "Handleliste" card will go in Task 6 — put both in a two-up row above the "Samlinger" kicker, only when `session` is truthy:

```typescript
{session && (
  <div className="hjem-menu-row">
    <button type="button" className="hjem-menu-card" onClick={() => navigate('/ukesmeny')}>
      <span className="hjem-menu-card-label">Ukesmeny</span>
      <span className="hjem-menu-card-value">
        {todayMenu
          ? `i kveld: ${todayMenu.entry_type === 'freetext' ? todayMenu.freetext : recipes.find((r) => r.id === todayMenu.recipe_id)?.title ?? 'Slettet oppskrift'}`
          : 'Ingen plan for i dag'}
      </span>
    </button>
    <button type="button" className="hjem-menu-card" onClick={() => navigate('/handleliste')}>
      <span className="hjem-menu-card-label">Handleliste</span>
      <span className="hjem-menu-card-value">{shoppingItemsLeft} varer igjen</span>
    </button>
  </div>
)}
```

(`shoppingItemsLeft` is wired in Task 7 — for this task, stub it as `0` inline or skip rendering the Handleliste half; simplest is to do both cards together in Task 7 instead of splitting HjemPage edits across two tasks. **Revise:** merge this step into Task 7's Step 3 so HjemPage is only edited once. Skip rendering here; this task only adds `todayMenu` state and the Ukesmeny half, done together with Task 7.)

- [ ] **Step 4: Add CSS**

```css
.hjem-menu-row {
  display: flex;
  gap: 12px;
  margin: 16px 0;
}

.hjem-menu-card {
  flex: 1;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: none;
  padding: 14px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hjem-menu-card-label {
  font: 400 16px/1.15 var(--font-heading);
}

.hjem-menu-card-value {
  font-size: 12px;
  color: var(--color-neutral-700);
}
```

- [ ] **Step 5: Defer commit to Task 7** (both Hjem cards land together since they share the row markup) — skip committing HjemPage changes here; stage them alongside Task 7's changes instead.

---

### Task 6: `HandlelistePage` + route

**Files:**
- Create: `src/pages/HandlelistePage.tsx`
- Modify: `src/App.tsx` (add `/handleliste` route)
- Modify: `src/App.css` (shopping list row styles)

**Interfaces:**
- Consumes: `aggregateIngredients`, `listCheckedItems`, `setItemChecked`, `setItemUnchecked`, `clearCheckedItems`, `listManualItems`, `addManualItem`, `removeManualItem` from `../lib/shoppingList`; `listMenuDays` from `../lib/menuDays`; `family`, `familyLoading`, `recipes` from `useApp()`.

- [ ] **Step 1: Write `src/pages/HandlelistePage.tsx`**

```typescript
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { listMenuDays } from '../lib/menuDays'
import {
  aggregateIngredients,
  listCheckedItems,
  setItemChecked,
  setItemUnchecked,
  clearCheckedItems,
  listManualItems,
  addManualItem,
  removeManualItem,
  type AggregatedIngredient,
  type CheckedItem,
  type ManualItem,
} from '../lib/shoppingList'
import type { MenuDay } from '../types'

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

function formatAmount(item: AggregatedIngredient): string {
  if (item.amount === null) return item.unit
  return `${item.amount} ${item.unit}`.trim()
}

export function HandlelistePage() {
  const navigate = useNavigate()
  const { family, familyLoading, recipes } = useApp()
  const familyId = family?.id ?? null

  const [menuDays, setMenuDays] = useState<MenuDay[]>([])
  const [checked, setChecked] = useState<CheckedItem[]>([])
  const [manualItems, setManualItems] = useState<ManualItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (familyLoading) return
    Promise.all([listMenuDays(familyId), listCheckedItems(familyId), listManualItems(familyId)]).then(
      ([days, checkedRows, manual]) => {
        setMenuDays(days)
        setChecked(checkedRows)
        setManualItems(manual)
        setLoading(false)
      }
    )
  }, [familyId, familyLoading])

  const aggregated = useMemo(() => aggregateIngredients(menuDays, recipes), [menuDays, recipes])

  const checkedKeys = useMemo(
    () => new Set(checked.map((c) => `${c.normalized_name} ${c.unit}`)),
    [checked]
  )

  const sortedAggregated = useMemo(() => {
    const isChecked = (item: AggregatedIngredient) => checkedKeys.has(`${item.normalizedName} ${item.unit}`)
    return [...aggregated].sort((a, b) => Number(isChecked(a)) - Number(isChecked(b)))
  }, [aggregated, checkedKeys])

  const uncheckedFromRecipesCount = aggregated.filter(
    (item) => !checkedKeys.has(`${item.normalizedName} ${item.unit}`)
  ).length
  const itemsLeft = uncheckedFromRecipesCount + manualItems.length

  const freetextDays = menuDays.filter((d) => d.entry_type === 'freetext')

  async function toggleChecked(item: AggregatedIngredient) {
    setBusy(true)
    try {
      const key = `${item.normalizedName} ${item.unit}`
      if (checkedKeys.has(key)) {
        await setItemUnchecked(familyId, item.normalizedName, item.unit)
      } else {
        await setItemChecked(familyId, item.normalizedName, item.unit)
      }
      setChecked(await listCheckedItems(familyId))
    } finally {
      setBusy(false)
    }
  }

  async function handleClearChecked() {
    setBusy(true)
    try {
      await clearCheckedItems(familyId)
      setChecked([])
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveManual(id: string) {
    setBusy(true)
    try {
      await removeManualItem(id)
      setManualItems(await listManualItems(familyId))
    } finally {
      setBusy(false)
    }
  }

  async function handleAddManual(event: React.FormEvent) {
    event.preventDefault()
    if (!newItemName.trim()) return
    setBusy(true)
    try {
      await addManualItem(familyId, newItemName.trim())
      setManualItems(await listManualItems(familyId))
      setNewItemName('')
      setShowAdd(false)
    } finally {
      setBusy(false)
    }
  }

  const hasCheckedItems = checked.length > 0

  return (
    <div className="page handleliste-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/')}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Kokeboka
        </button>
        {hasCheckedItems && (
          <button type="button" className="nav-link" onClick={handleClearChecked} disabled={busy}>
            Tøm huket av
          </button>
        )}
      </nav>

      <h1 className="oppskrift-title">Handleliste</h1>
      <p className="oppskrift-description">{itemsLeft} varer igjen</p>

      {loading ? (
        <p className="status-message">Laster handleliste...</p>
      ) : (
        <>
          <h2 className="section-kicker">Fra ukens retter</h2>
          {sortedAggregated.length === 0 ? (
            <p className="status-message">Ingen retter i ukesmenyen enda.</p>
          ) : (
            <div className="handleliste-rows">
              {sortedAggregated.map((item) => {
                const isChecked = checkedKeys.has(`${item.normalizedName} ${item.unit}`)
                return (
                  <button
                    type="button"
                    key={`${item.normalizedName} ${item.unit}`}
                    className="handleliste-row"
                    onClick={() => toggleChecked(item)}
                    disabled={busy}
                  >
                    <span className={`handleliste-checkbox${isChecked ? ' handleliste-checkbox-checked' : ''}`} />
                    <span className={`handleliste-name${isChecked ? ' handleliste-name-checked' : ''}`}>
                      {item.displayName}
                    </span>
                    <span className="handleliste-amount">{formatAmount(item)}</span>
                  </button>
                )
              })}
            </div>
          )}

          <h2 className="section-kicker">Egne varer</h2>
          <p className="handleliste-hint">Ligger til du krysser den av</p>
          <div className="handleliste-rows">
            {manualItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className="handleliste-row"
                onClick={() => handleRemoveManual(item.id)}
                disabled={busy}
              >
                <span className="handleliste-checkbox" />
                <span className="handleliste-name">{item.name}</span>
              </button>
            ))}
          </div>

          {freetextDays.length > 0 && (
            <>
              <h2 className="section-kicker">Ikke dekket av handlelisten</h2>
              <div className="handleliste-freetext-list">
                {freetextDays.map((day) => (
                  <p className="handleliste-freetext-row" key={day.id}>
                    <span className="handleliste-freetext-day">{WEEKDAY_LABELS[day.weekday]}</span> · {day.freetext}
                  </p>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="handleliste-add-footer">
        {showAdd ? (
          <form className="handleliste-add-form" onSubmit={handleAddManual}>
            <input
              type="text"
              autoFocus
              placeholder="Vare"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
            <button type="submit" className="cta-button" disabled={busy || !newItemName.trim()}>
              Legg til
            </button>
          </form>
        ) : (
          <button type="button" className="handleliste-add-pill" onClick={() => setShowAdd(true)}>
            <span className="handleliste-add-icon">+</span>
            Legg til vare
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add route in `src/App.tsx`**

```typescript
import { HandlelistePage } from './pages/HandlelistePage'
// ...
<Route path="/handleliste" element={<HandlelistePage />} />
```

- [ ] **Step 3: Add CSS to `src/App.css`**

```css
.handleliste-rows {
  display: flex;
  flex-direction: column;
  margin-bottom: 22px;
}

.handleliste-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--color-divider);
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  text-align: left;
  cursor: pointer;
  width: 100%;
}

.handleliste-row:last-child {
  border-bottom: none;
}

.handleliste-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--color-neutral-400);
  flex: none;
}

.handleliste-checkbox-checked {
  border: none;
  background: var(--color-accent-2);
}

.handleliste-name {
  flex: 1;
  font-size: 15px;
}

.handleliste-name-checked {
  text-decoration: line-through;
  color: var(--color-neutral-500);
}

.handleliste-amount {
  font-size: 13px;
  color: var(--color-neutral-700);
}

.handleliste-hint {
  font-size: 12px;
  color: var(--color-neutral-700);
  margin: 0 0 10px;
}

.handleliste-freetext-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.handleliste-freetext-row {
  font-size: 13px;
  color: var(--color-neutral-700);
  margin: 0;
}

.handleliste-freetext-day {
  color: var(--color-text);
}

.handleliste-add-footer {
  padding: 14px 0 30px;
}

.handleliste-add-pill {
  display: flex;
  gap: 10px;
  align-items: center;
  background: var(--color-surface);
  border-radius: 999px;
  padding: 10px 18px;
  border: none;
  cursor: pointer;
  width: 100%;
}

.handleliste-add-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-bg);
  display: grid;
  place-items: center;
  font-size: 16px;
  line-height: 1;
}

.handleliste-add-form {
  display: flex;
  gap: 10px;
}

.handleliste-add-form input {
  flex: 1;
}
```

- [ ] **Step 4: `npm run build`, then manually verify in `npm run dev`**

Open `/handleliste` at 390×844, compare against the "Handleliste" screen in the handoff HTML. Check: checking a "Fra ukens retter" row toggles strike-through and sinks it to the bottom of that section but doesn't disappear; reloading the page keeps it checked; checking an "Egne varer" row deletes it immediately; "Tøm huket av" only clears the recipe-ingredient checks; "Ikke dekket" section only shows when there are freetext days.

- [ ] **Step 5: Commit**

```bash
git add src/pages/HandlelistePage.tsx src/App.tsx src/App.css
git commit -m "feat: add Handleliste page with live aggregation, checked and manual items"
```

---

### Task 7: Hjem "Handleliste" card (completes Task 5's row) + reset behavior wiring

**Files:**
- Modify: `src/pages/HjemPage.tsx` (finish the two-up row started in Task 5)
- Modify: `src/App.css` (already added in Task 5 — no new classes needed unless review finds gaps)

**Interfaces:**
- Consumes: `listMenuDays` (Task 2), `aggregateIngredients`/`listCheckedItems`/`listManualItems` (Task 3).

- [ ] **Step 1: Extend `HjemPage.tsx`** to compute both card values in one effect (replacing the partial version sketched in Task 5):

```typescript
import { useEffect, useMemo, useState } from 'react'
import { listMenuDays } from '../lib/menuDays'
import { aggregateIngredients, listCheckedItems, listManualItems } from '../lib/shoppingList'
import type { MenuDay } from '../types'

// inside component, after existing destructure — add family, familyLoading:
const { session, recipes, profiles, loading, availableTags, cookingSession, family, familyLoading } = useApp()

const [todayMenu, setTodayMenu] = useState<MenuDay | null>(null)
const [shoppingItemsLeft, setShoppingItemsLeft] = useState(0)

useEffect(() => {
  if (familyLoading || !session) return
  const familyId = family?.id ?? null
  const isoWeekday = (new Date().getDay() + 6) % 7

  Promise.all([listMenuDays(familyId), listCheckedItems(familyId), listManualItems(familyId)]).then(
    ([days, checkedRows, manualItems]) => {
      setTodayMenu(days.find((d) => d.weekday === isoWeekday && d.entry_type) ?? null)
      const aggregated = aggregateIngredients(days, recipes)
      const checkedKeys = new Set(checkedRows.map((c) => `${c.normalized_name} ${c.unit}`))
      const uncheckedCount = aggregated.filter(
        (item) => !checkedKeys.has(`${item.normalizedName} ${item.unit}`)
      ).length
      setShoppingItemsLeft(uncheckedCount + manualItems.length)
    }
  )
}, [family, familyLoading, session, recipes])
```

- [ ] **Step 2: Render the two-up row** right after the search field and before the "Sist brukt" block:

```typescript
{session && (
  <div className="hjem-menu-row">
    <button type="button" className="hjem-menu-card" onClick={() => navigate('/ukesmeny')}>
      <span className="hjem-menu-card-label">Ukesmeny</span>
      <span className="hjem-menu-card-value">
        {todayMenu
          ? `i kveld: ${
              todayMenu.entry_type === 'freetext'
                ? todayMenu.freetext
                : recipes.find((r) => r.id === todayMenu.recipe_id)?.title ?? 'Slettet oppskrift'
            }`
          : 'Ingen plan for i dag'}
      </span>
    </button>
    <button type="button" className="hjem-menu-card" onClick={() => navigate('/handleliste')}>
      <span className="hjem-menu-card-label">Handleliste</span>
      <span className="hjem-menu-card-value">{shoppingItemsLeft} varer igjen</span>
    </button>
  </div>
)}
```

- [ ] **Step 3: `npm run build`, then manually verify** both cards on `/` update after editing the menu/shopping list.

- [ ] **Step 4: Commit**

```bash
git add src/pages/HjemPage.tsx
git commit -m "feat: add Ukesmeny and Handleliste cards to Hjem"
```

---

### Task 8: Family onboarding — discard personal menu/shopping data

**Files:**
- Modify: `src/pages/FamiliePage.tsx`

**Interfaces:**
- Consumes: `resetMenu` from `../lib/menuDays` (already deletes `menu_days` + `shopping_checked_items` for a scope); new `deleteAllManualItems(familyId: string | null)` needs adding to `src/lib/shoppingList.ts` since `resetMenu` intentionally does not touch manual items (per spec, `manual_shopping_items` normally survives a menu reset, but onboarding into a family is the one case where the user's *personal* manual items must also be discarded).

- [ ] **Step 1: Add `deleteAllManualItems` to `src/lib/shoppingList.ts`**

```typescript
// Kun brukt ved overgang personlig -> familie (se FamiliePage) — vanlig
// resetMenu rører ALDRI Egne varer, men her forkastes hele det personlige
// scopet, inkludert Egne varer, fordi de ikke gir mening å blande inn i
// familiens liste.
export async function deleteAllManualItems(familyId: string | null): Promise<void> {
  const query = supabase.from('manual_shopping_items').delete()
  const { error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
}
```

- [ ] **Step 2: Add a confirmation step before `handleCreateFamily`/`handleJoinFamily` in `FamiliePage.tsx`**

Replace the two onboarding forms' submit handlers to show a warning dialog first when the user has an active personal menu/shopping list. Add state and a check:

```typescript
import { resetMenu, listMenuDays } from '../lib/menuDays'
import { deleteAllManualItems, listManualItems } from '../lib/shoppingList'

// inside component:
const [pendingOnboardingAction, setPendingOnboardingAction] = useState<
  { type: 'create'; name: string } | { type: 'join'; code: string } | null
>(null)
const [hasPersonalMenuData, setHasPersonalMenuData] = useState(false)

async function checkPersonalMenuData(): Promise<boolean> {
  const [days, manual] = await Promise.all([listMenuDays(null), listManualItems(null)])
  return days.length > 0 || manual.length > 0
}

async function runOnboardingAction(action: { type: 'create'; name: string } | { type: 'join'; code: string }) {
  setOnboardingError(null)
  setOnboardingBusy(true)
  try {
    if (action.type === 'create') {
      await createFamily(action.name)
    } else {
      await joinFamilyByCode(action.code)
    }
    await Promise.all([resetMenu(null), deleteAllManualItems(null)])
    reloadFamily()
    reload()
  } catch (err) {
    setOnboardingError(err instanceof Error ? err.message : 'Noe gikk feil.')
  } finally {
    setOnboardingBusy(false)
    setPendingOnboardingAction(null)
  }
}
```

Update `handleCreateFamily`/`handleJoinFamily` to check first and either run immediately or show the warning:

```typescript
async function handleCreateFamily(event: React.FormEvent) {
  event.preventDefault()
  const name = newFamilyName.trim()
  if (await checkPersonalMenuData()) {
    setPendingOnboardingAction({ type: 'create', name })
    return
  }
  await runOnboardingAction({ type: 'create', name })
}

async function handleJoinFamily(event: React.FormEvent) {
  event.preventDefault()
  const code = joinCode.trim()
  if (await checkPersonalMenuData()) {
    setPendingOnboardingAction({ type: 'join', code })
    return
  }
  await runOnboardingAction({ type: 'join', code })
}
```

Add the warning dialog to the onboarding (not-yet-in-a-family) branch's JSX, right before the closing `</div>` of that branch:

```typescript
{pendingOnboardingAction && (
  <div className="del-dialog-backdrop" onClick={() => setPendingOnboardingAction(null)}>
    <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
      <h2 className="del-dialog-title">Forkast personlig ukesmeny?</h2>
      <p className="del-dialog-body">
        Du har en aktiv personlig ukesmeny og/eller handleliste. Å bli med i en familie sletter disse
        (inkludert egne varer) — de erstattes av familiens felles ukesmeny og handleliste. Dette kan
        ikke angres.
      </p>
      <div className="del-dialog-actions">
        <button type="button" className="del-dialog-cancel" onClick={() => setPendingOnboardingAction(null)}>
          Avbryt
        </button>
        <button
          type="button"
          className="del-dialog-submit"
          disabled={onboardingBusy}
          onClick={() => runOnboardingAction(pendingOnboardingAction)}
        >
          {onboardingBusy ? 'Fortsetter...' : 'Fortsett og forkast'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: `npm run build`, then manually verify**: create a personal ukesmeny day + a manual shopping item as a user with no family, then join/create a family — confirm the warning appears, and confirm the personal `menu_days`/`shopping_checked_items`/`manual_shopping_items` rows are gone afterward (check via Supabase dashboard or by logging back out of the family and confirming a fresh empty personal menu).

- [ ] **Step 4: Commit**

```bash
git add src/pages/FamiliePage.tsx src/lib/shoppingList.ts
git commit -m "feat: warn and discard personal menu/shopping data when joining a family"
```

---

## Final Verification

- [ ] `npm run build` passes with zero errors.
- [ ] `npm test` passes (all `aggregateIngredients` cases plus existing `recipePermissions.test.ts`).
- [ ] Manual pass through both screens at 390×844 against `design/handoff-ukesmeny/Kokeboka - 1b.dc.html`.
- [ ] Two family members see and can edit the same menu/list; a third user outside the family sees none of it.
- [ ] Two recipes with the same ingredient name+unit sum into one row; differing units produce two rows.
- [ ] A checked "Fra ukens retter" row survives a page reload; checking an "Egne varer" row deletes it.
- [ ] "Opprett ny ukesmeny" clears menu + recipe-ingredient checks but leaves "Egne varer" untouched.
- [ ] Tell the user the migration in Task 1 still needs to be run against their Supabase project by hand.
