import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatClock,
  formatDuration,
  guessStepSeconds,
  stepTimerSeconds,
  stripTimerMarker,
  timerOverride,
  withTimerOverride,
} from './stepTimer.ts'

const min = (n: number) => n * 60

test('guessStepSeconds reads common Norwegian durations', () => {
  assert.equal(guessStepSeconds('La hvile i 20 min.'), min(20))
  assert.equal(guessStepSeconds('Stek i 45 minutter'), min(45))
  assert.equal(guessStepSeconds('Kok i 1 minutt'), min(1))
  assert.equal(guessStepSeconds('La heve i 1 time'), min(60))
  assert.equal(guessStepSeconds('Marinér i 2 timer'), min(120))
  assert.equal(guessStepSeconds('Stek 1,5 time'), min(90))
  assert.equal(guessStepSeconds('Rør i 30 sekunder'), 30)
  assert.equal(guessStepSeconds('Stek ca. 2 t på 150 grader'), min(120))
})

test('guessStepSeconds uses the lowest number of a range', () => {
  assert.equal(guessStepSeconds('La hvile i 20–30 min.'), min(20))
  assert.equal(guessStepSeconds('La hvile i 20-30 min'), min(20))
  assert.equal(guessStepSeconds('Stek i 10 - 12 minutter'), min(10))
  assert.equal(guessStepSeconds('Kok 2 til 3 timer'), min(120))
})

test('guessStepSeconds understands number words and fixed phrases', () => {
  assert.equal(guessStepSeconds('La det stå en time'), min(60))
  assert.equal(guessStepSeconds('Kok i fem minutter'), min(5))
  assert.equal(guessStepSeconds('La hvile et kvarter'), min(15))
  assert.equal(guessStepSeconds('Stek i tre kvarter'), min(45))
  assert.equal(guessStepSeconds('Stek en halv time'), min(30))
  assert.equal(guessStepSeconds('La heve halvannen time'), min(90))
})

test('guessStepSeconds adds hours and minutes written together', () => {
  assert.equal(guessStepSeconds('Stek i 1 time og 15 min'), min(75))
  assert.equal(guessStepSeconds('Stek 1 t 30 min'), min(90))
})

test('guessStepSeconds picks the first duration and ignores other numbers', () => {
  assert.equal(guessStepSeconds('Stek i 10 min, snu og stek 5 min til'), min(10))
  assert.equal(guessStepSeconds('Stek på 200 grader i 25 min'), min(25))
  assert.equal(guessStepSeconds('Tilsett 2 ts salt og 3 ss olje'), null)
  assert.equal(guessStepSeconds('Bland alt godt'), null)
  assert.equal(guessStepSeconds('Bruk 2 tomater'), null)
  assert.equal(guessStepSeconds('Rør inn @Saus'), null)
})

test('timer override is stored as a hidden marker in the step text', () => {
  const step = 'La hvile i 20–30 min.'
  assert.equal(timerOverride(step), undefined)

  const set = withTimerOverride(step, 25)
  assert.equal(set, 'La hvile i 20–30 min. {tid:25}')
  assert.equal(timerOverride(set), 25)
  assert.equal(stripTimerMarker(set), step)
  assert.equal(stepTimerSeconds(set), min(25))

  const none = withTimerOverride(set, null)
  assert.equal(none, 'La hvile i 20–30 min. {tid:0}')
  assert.equal(timerOverride(none), null)
  assert.equal(stepTimerSeconds(none), null)

  assert.equal(withTimerOverride(none, undefined), step)
  assert.equal(stepTimerSeconds(step), min(20))
})

test('timer override works on steps without a time in the text', () => {
  const step = withTimerOverride('Sett i kjøleskapet', 90)
  assert.equal(stepTimerSeconds(step), min(90))
  assert.equal(guessStepSeconds(step), null)
})

test('formatDuration and formatClock', () => {
  assert.equal(formatDuration(min(20)), '20 min')
  assert.equal(formatDuration(min(90)), '1 t 30 min')
  assert.equal(formatDuration(min(120)), '2 t')
  assert.equal(formatDuration(45), '45 sek')
  assert.equal(formatClock(min(20) * 1000), '20:00')
  assert.equal(formatClock(1199_001), '20:00')
  assert.equal(formatClock(1000), '0:01')
  assert.equal(formatClock(0), '0:00')
  assert.equal(formatClock(min(65) * 1000), '1:05:00')
})
