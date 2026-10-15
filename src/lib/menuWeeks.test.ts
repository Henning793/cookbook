import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addWeeks,
  copyTargetWeeks,
  currentWeekStart,
  isPastDay,
  parseWeekParam,
  weekNumber,
  weekRangeLabel,
} from './menuWeeks.ts'

test('uken starter på mandag', () => {
  assert.equal(currentWeekStart(new Date(2026, 9, 15)), '2026-10-12') // torsdag
  assert.equal(currentWeekStart(new Date(2026, 9, 12)), '2026-10-12') // mandag
  assert.equal(currentWeekStart(new Date(2026, 9, 18, 23, 30)), '2026-10-12') // søndag kveld
  assert.equal(currentWeekStart(new Date(2027, 0, 2)), '2026-12-28') // over nyttår
})

test('blar uker frem og tilbake, også over sommertid og nyttår', () => {
  assert.equal(addWeeks('2026-10-19', 1), '2026-10-26')
  assert.equal(addWeeks('2026-10-26', 1), '2026-11-02')
  assert.equal(addWeeks('2026-12-28', 1), '2027-01-04')
  assert.equal(addWeeks('2026-10-12', -1), '2026-10-05')
})

test('ukenummer følger ISO', () => {
  assert.equal(weekNumber('2026-10-12'), 42)
  assert.equal(weekNumber('2025-12-29'), 1)
  assert.equal(weekNumber('2026-12-28'), 53)
  assert.equal(weekNumber('2027-01-04'), 1)
})

test('datoer for uken', () => {
  assert.equal(weekRangeLabel('2026-10-12'), '12.–18. oktober')
  assert.equal(weekRangeLabel('2026-10-26'), '26. oktober–1. november')
})

test('?uke må være en gyldig mandag', () => {
  assert.equal(parseWeekParam('2026-10-19'), '2026-10-19')
  assert.equal(parseWeekParam('2026-10-20'), null)
  assert.equal(parseWeekParam('2026-02-30'), null)
  assert.equal(parseWeekParam('tull'), null)
  assert.equal(parseWeekParam(null), null)
})

test('passerte dager', () => {
  const now = new Date(2026, 9, 15, 18, 0)
  assert.equal(isPastDay('2026-10-12', 2, now), true)
  assert.equal(isPastDay('2026-10-12', 3, now), false)
  assert.equal(isPastDay('2026-10-19', 0, now), false)
})

test('kopier til denne og de neste ukene, ikke til samme uke', () => {
  const now = new Date(2026, 9, 15)
  assert.deepEqual(copyTargetWeeks('2026-10-12', now, 3), ['2026-10-19', '2026-10-26', '2026-11-02'])
  assert.deepEqual(copyTargetWeeks('2026-10-26', now, 3), ['2026-10-12', '2026-10-19', '2026-11-02'])
  assert.deepEqual(copyTargetWeeks('2026-10-05', now, 2), ['2026-10-12', '2026-10-19'])
})
