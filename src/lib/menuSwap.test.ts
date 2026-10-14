import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayContent, swapDaysLocal, swapMessage } from './menuSwap.ts'
import type { MenuDay } from '../types'

function day(weekday: number, patch: Partial<MenuDay>): MenuDay {
  return {
    id: `id-${weekday}`,
    family_id: 'fam',
    owner_id: 'meg',
    weekday,
    entry_type: null,
    recipe_id: null,
    freetext: null,
    servings: null,
    updated_at: '2026-10-13T00:00:00Z',
    ...patch,
  }
}

const week = () => [
  day(1, { entry_type: 'recipe', recipe_id: 'lasagne', servings: 6, main_servings: 8, extra_dishes: [{ recipe_id: 'salat', servings: null }] }),
  day(2, { entry_type: 'freetext', freetext: 'Taco' }),
  day(3, { entry_type: 'recipe', recipe_id: 'fiskegrateng' }),
]

test('bytter retter og porsjoner mellom to dager', () => {
  const result = swapDaysLocal(week(), 1, 3)
  assert.deepEqual(dayContent(result.find((d) => d.weekday === 1)), {
    entry_type: 'recipe', recipe_id: 'fiskegrateng', freetext: null, servings: null, extra_dishes: [], main_servings: null,
  })
  assert.deepEqual(dayContent(result.find((d) => d.weekday === 3)), {
    entry_type: 'recipe', recipe_id: 'lasagne', freetext: null, servings: 6,
    extra_dishes: [{ recipe_id: 'salat', servings: null }], main_servings: 8,
  })
  // Radene beholder sin egen id, så ukedagen står i ro.
  assert.equal(result.find((d) => d.weekday === 1)?.id, 'id-1')
})

test('fritekst følger med', () => {
  const result = swapDaysLocal(week(), 2, 1)
  assert.equal(result.find((d) => d.weekday === 1)?.freetext, 'Taco')
  assert.equal(result.find((d) => d.weekday === 2)?.recipe_id, 'lasagne')
})

test('slipp på en dag uten rad flytter retten dit og tømmer den gamle', () => {
  const result = swapDaysLocal(week(), 1, 4)
  assert.equal(result.find((d) => d.weekday === 4)?.recipe_id, 'lasagne')
  assert.equal(result.find((d) => d.weekday === 4)?.servings, 6)
  assert.equal(result.find((d) => d.weekday === 1)?.entry_type, null)
  assert.deepEqual(result.map((d) => d.weekday), [1, 2, 3, 4])
})

test('to bytter av samme par gir tilbake det opprinnelige', () => {
  const original = week()
  const back = swapDaysLocal(swapDaysLocal(original, 1, 3), 1, 3)
  assert.deepEqual(back.map(dayContent), original.map(dayContent))
})

test('melding sier byttet eller flyttet', () => {
  assert.equal(swapMessage(week(), 3, 1), 'Byttet tirsdag og torsdag')
  assert.equal(swapMessage(week(), 1, 4), 'Flyttet til fredag')
  assert.equal(swapMessage([...week(), day(5, {})], 1, 5), 'Flyttet til lørdag')
})
