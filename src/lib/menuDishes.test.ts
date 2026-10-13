import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  draftDishes,
  extraDishes,
  freetextEntries,
  linkedSuggestions,
  menuDayItems,
  plannedDishes,
  sharedServings,
  toMenuDayDishes,
} from './menuDishes.ts'
import { aggregateIngredients } from './shoppingAggregate.ts'
import type { MenuDay, Recipe } from '../types.ts'

function recipe(id: string, servings: number | undefined, extra: Partial<Recipe> = {}): Recipe {
  return {
    id,
    created_at: '',
    title: id,
    ingredients: { loose: [{ amount: 100, unit: 'g', name: 'Smør' }], components: [] },
    steps: [],
    image_url: null,
    owner_id: 'u1',
    family_id: null,
    tags: [],
    kind: 'recipe',
    servings,
    ...extra,
  }
}

function day(patch: Partial<MenuDay>): MenuDay {
  return {
    id: 'd5',
    family_id: null,
    owner_id: 'u1',
    weekday: 5,
    entry_type: 'recipe',
    recipe_id: 'Indrefilet',
    freetext: null,
    servings: null,
    updated_at: '',
    ...patch,
  }
}

const recipes = [
  recipe('Indrefilet', 2, { description: 'Server med @Rødvinssaus og @Potetgrateng.' }),
  recipe('Rødvinssaus', 4),
  recipe('Potetgrateng', 6),
  recipe('Bearnaise', undefined),
]

test('hver rett regnes om fra sitt eget antall til dagens antall', () => {
  const dishes = plannedDishes(
    day({
      servings: 8,
      extra_dishes: [
        { recipe_id: 'Rødvinssaus', servings: null },
        { recipe_id: 'Potetgrateng', servings: null },
      ],
    }),
    recipes
  )
  assert.deepEqual(
    dishes.map((d) => [d.recipe.id, d.servings, d.base, d.own]),
    [
      ['Indrefilet', 8, 2, false],
      ['Rødvinssaus', 8, 4, false],
      ['Potetgrateng', 8, 6, false],
    ]
  )
})

test('uten eget antall følger tilbehøret hovedrettens antall', () => {
  const d = day({ extra_dishes: [{ recipe_id: 'Rødvinssaus', servings: null }] })
  assert.equal(sharedServings(d, recipes), 2)
  assert.equal(plannedDishes(d, recipes)[1].servings, 2)
})

test('en rett med eget antall står i ro', () => {
  const dishes = plannedDishes(day({ servings: 8, extra_dishes: [{ recipe_id: 'Rødvinssaus', servings: 12 }] }), recipes)
  assert.equal(dishes[1].servings, 12)
  assert.equal(dishes[1].own, true)
})

test('slettede oppskrifter og fritekst gir ingen retter', () => {
  assert.equal(plannedDishes(day({ extra_dishes: [{ recipe_id: 'borte', servings: null }] }), recipes).length, 1)
  assert.deepEqual(plannedDishes(day({ entry_type: 'freetext', recipe_id: null, freetext: 'Taco' }), recipes), [])
})

test('extra_dishes mangler før migreringen', () => {
  assert.deepEqual(extraDishes(day({})), [])
  assert.deepEqual(extraDishes(day({ extra_dishes: null })), [])
})

test('handlelisten summerer alle rettene, hver ganget for seg', () => {
  const items = aggregateIngredients(
    [
      day({
        servings: 8,
        extra_dishes: [
          { recipe_id: 'Rødvinssaus', servings: 12 },
          { recipe_id: 'Potetgrateng', servings: null },
        ],
      }),
    ],
    recipes
  )
  const smor = items.find((i) => i.normalizedName === 'smør')
  // 100 g × 8/2 + 100 g × 12/4 + 100 g × 8/6
  assert.equal(smor?.amount, Math.round((400 + 300 + 800 / 6) * 10) / 10)
  assert.deepEqual(
    smor?.sources.map((s) => [s.recipeTitle, s.servings]),
    [
      ['Indrefilet', 8],
      ['Rødvinssaus', 12],
      ['Potetgrateng', 8],
    ]
  )
})

test('forslag fra @-lenker i beskrivelsen, uten de som allerede er med', () => {
  assert.deepEqual(
    linkedSuggestions(['Indrefilet', 'Rødvinssaus'], recipes).map((r) => r.id),
    ['Potetgrateng']
  )
})

test('lagring: dagens antall er null når det er hovedrettens eget', () => {
  assert.deepEqual(
    toMenuDayDishes(
      [
        { recipeId: 'Indrefilet', servings: null },
        { recipeId: 'Rødvinssaus', servings: 12 },
        { recipeId: 'Potetgrateng', servings: 2 },
      ],
      2,
      recipes
    ),
    {
      entry_type: 'recipe',
      recipe_id: 'Indrefilet',
      freetext: null,
      servings: null,
      extra_dishes: [
        { recipe_id: 'Rødvinssaus', servings: 12 },
        // Samme som dagen: følger dagen.
        { recipe_id: 'Potetgrateng', servings: null },
      ],
    }
  )
  assert.equal(toMenuDayDishes([], 4, recipes), null)
})

test('fritekst kan være en av rettene og teller ikke på handlelisten', () => {
  const d = day({
    servings: 8,
    extra_dishes: [
      { recipe_id: null, freetext: 'Salat', servings: null },
      { recipe_id: 'Rødvinssaus', servings: null },
    ],
  })
  assert.deepEqual(
    menuDayItems(d, recipes).map((i) => [i.title, i.dish?.servings ?? null]),
    [
      ['Indrefilet', 8],
      ['Salat', null],
      ['Rødvinssaus', 8],
    ]
  )
  assert.deepEqual(freetextEntries([d]), [{ weekday: 5, text: 'Salat' }])
  assert.equal(plannedDishes(d, recipes).length, 2)
})

test('fritekst som hovedrett med oppskrifter i tillegg', () => {
  const saved = toMenuDayDishes([{ freetext: 'Taco' }, { recipeId: 'Rødvinssaus', servings: null }], 4, recipes)
  assert.deepEqual(saved, {
    entry_type: 'freetext',
    recipe_id: null,
    freetext: 'Taco',
    // 4 er sausens eget antall, så det lagres som null.
    servings: null,
    extra_dishes: [{ recipe_id: 'Rødvinssaus', servings: null }],
  })
  const d = day({ ...saved!, extra_dishes: saved!.extra_dishes })
  assert.equal(sharedServings(d, recipes), 4)
  assert.deepEqual(draftDishes(d), [{ freetext: 'Taco' }, { recipeId: 'Rødvinssaus', servings: null }])
  assert.deepEqual(freetextEntries([d]), [{ weekday: 5, text: 'Taco' }])
})

test('bare fritekst gir ikke noe antall', () => {
  assert.deepEqual(toMenuDayDishes([{ freetext: 'Rester' }], 1, recipes)?.servings, null)
})
