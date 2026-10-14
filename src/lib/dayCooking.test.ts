import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dayKokemodusPath,
  dishTimerLabel,
  dayStartStep,
  dishProgress,
  finishDayDish,
  parseWeekdayParam,
  selectedDish,
  timerPath,
  withDayStep,
} from './dayCooking.ts'

test('adressen til kokemodus for en rett på dagen', () => {
  assert.equal(dayKokemodusPath('r1', 5, 8), '/oppskrift/r1/kok?dag=5&porsjoner=8')
  assert.equal(dayKokemodusPath('r1', 0, null), '/oppskrift/r1/kok?dag=0')
})

test('?dag tar bare ukedager 0-6', () => {
  assert.equal(parseWeekdayParam('5'), 5)
  assert.equal(parseWeekdayParam('0'), 0)
  assert.equal(parseWeekdayParam('7'), null)
  assert.equal(parseWeekdayParam('1.5'), null)
  assert.equal(parseWeekdayParam(''), null)
  assert.equal(parseWeekdayParam(null), null)
})

test('hver rett husker sitt eget steg', () => {
  let session = withDayStep(null, 5, 'kjott', 2, 8)
  session = withDayStep(session, 5, 'saus', 1, 12)
  assert.equal(dayStartStep(session, 5, 'kjott'), 2)
  assert.equal(dayStartStep(session, 5, 'saus'), 1)
  assert.equal(dayStartStep(session, 5, 'grateng'), 0)
  assert.equal(session.recipeId, 'saus')
  assert.equal(session.servings, 12)
  assert.deepEqual(dishProgress(session, 5, 'grateng'), null)
})

test('en annen dag eller en vanlig oppskrift erstattes', () => {
  const other = withDayStep(null, 2, 'kjott', 3, null)
  const session = withDayStep(other, 5, 'saus', 1, null)
  assert.deepEqual(session.dishSteps, { saus: 1 })
  assert.equal(dayStartStep(session, 5, 'kjott'), 0)
  const plain = { recipeId: 'kjott', stepIndex: 4 }
  assert.deepEqual(withDayStep(plain, 5, 'kjott', 0, null).dishSteps, { kjott: 0 })
  assert.equal(dayStartStep(plain, 5, 'kjott'), 0)
})

test('ferdig med en rett: de andre fortsetter, og retten vises som ferdig', () => {
  let session = withDayStep(null, 5, 'kjott', 2, null)
  session = withDayStep(session, 5, 'saus', 4, null)
  const after = finishDayDish(session, 5, 'saus')
  assert.ok(after)
  assert.equal(after.recipeId, 'kjott')
  assert.equal(after.stepIndex, 2)
  assert.deepEqual(dishProgress(after, 5, 'saus'), { kind: 'done' })
  assert.equal(dayStartStep(after, 5, 'saus'), 0)
  // Starter man retten igjen, er den ikke lenger ferdig.
  const again = withDayStep(after, 5, 'saus', 0, null)
  assert.deepEqual(dishProgress(again, 5, 'saus'), { kind: 'step', stepIndex: 0 })
})

test('ferdig med siste rett i gang: økten er over', () => {
  const session = withDayStep(null, 5, 'kjott', 2, null)
  assert.equal(finishDayDish(session, 5, 'kjott'), null)
  assert.equal(finishDayDish(null, 5, 'kjott'), null)
})

test('fanen som vises på dagssiden', () => {
  const ids = ['kjott', 'saus', 'grateng']
  const session = withDayStep(null, 5, 'saus', 1, null)
  assert.equal(selectedDish(ids, 'grateng', session, 5), 'grateng')
  assert.equal(selectedDish(ids, null, session, 5), 'saus')
  assert.equal(selectedDish(ids, 'slettet', session, 5), 'saus')
  assert.equal(selectedDish(ids, null, session, 4), 'kjott')
  assert.equal(selectedDish([], null, null, 5), null)
})

test('nedtellingen som vises på en rett', () => {
  const base = { recipeTitle: 'X', stepIndex: 0, stepText: '', durationMs: 60_000 }
  const timers = [
    { ...base, id: 'a', recipeId: 'grateng', endsAt: 1_000 + 120_000, remainingMs: 120_000, ringing: false },
    { ...base, id: 'b', recipeId: 'grateng', endsAt: 1_000 + 30_000, remainingMs: 30_000, ringing: false },
    { ...base, id: 'c', recipeId: 'saus', endsAt: null, remainingMs: 0, ringing: true },
  ]
  assert.equal(dishTimerLabel(timers, 'grateng', 1_000), '0:30')
  assert.equal(dishTimerLabel(timers, 'saus', 1_000), 'Ringer')
  assert.equal(dishTimerLabel(timers, 'kjott', 1_000), null)
})

test('alarmen åpner dagens kokemodus når klokka ble startet fra en dag', () => {
  assert.equal(timerPath({ recipeId: 'lasagne', weekday: 2, servings: 6 }), '/oppskrift/lasagne/kok?dag=2&porsjoner=6')
  assert.equal(timerPath({ recipeId: 'lasagne', weekday: 0 }), '/oppskrift/lasagne/kok?dag=0')
  assert.equal(timerPath({ recipeId: 'lasagne' }), '/oppskrift/lasagne/kok')
})

test('steget i hver rett huskes når man bytter fane og kommer tilbake', () => {
  let session = withDayStep(null, 2, 'lasagne', 4, 6)
  session = withDayStep(session, 2, 'salat', 0, 6)
  session = withDayStep(session, 2, 'salat', 1, 6)
  assert.equal(dayStartStep(session, 2, 'lasagne'), 4)
  assert.equal(dayStartStep(session, 2, 'salat'), 1)
})
