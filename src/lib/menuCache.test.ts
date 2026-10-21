import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cachedMenuDays, clearMenuCache, rememberMenuDays } from './menuCache.ts'
import type { MenuDay } from '../types'

const day = { weekday: 0 } as MenuDay

test('husker uken per familie og personlig meny hver for seg', () => {
  clearMenuCache()
  rememberMenuDays('fam-1', '2026-10-19', [day])
  assert.deepEqual(cachedMenuDays('fam-1', '2026-10-19'), [day])
  assert.equal(cachedMenuDays(null, '2026-10-19'), undefined)
  assert.equal(cachedMenuDays('fam-1', '2026-10-26'), undefined)
})

test('tømmes helt, så neste bruker ikke ser forrige brukers meny', () => {
  rememberMenuDays(null, '2026-10-19', [day])
  clearMenuCache()
  assert.equal(cachedMenuDays(null, '2026-10-19'), undefined)
})
