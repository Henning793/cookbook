import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  adjustTimer,
  cookingModeTimers,
  markDue,
  parseStoredTimers,
  pauseTimer,
  remainingMs,
  resumeTimer,
  startTimer,
  timerLabel,
  timerSummary,
} from './cookingTimers.ts'

const MIN = 60_000
const base = {
  id: 'a',
  recipeId: 'r1',
  recipeTitle: 'Brød',
  stepIndex: 2,
  stepText: 'La hvile i 20–30 min.',
  durationMs: 20 * MIN,
}

test('a running timer counts down from its end time', () => {
  const timer = startTimer(base, 1_000)
  assert.equal(timer.endsAt, 1_000 + 20 * MIN)
  assert.equal(remainingMs(timer, 1_000 + 5 * MIN), 15 * MIN)
  assert.equal(remainingMs(timer, 1_000 + 25 * MIN), 0)
})

test('pause keeps the remaining time and resume sets a new end time', () => {
  const paused = pauseTimer(startTimer(base, 0), 5 * MIN)
  assert.equal(paused.endsAt, null)
  assert.equal(remainingMs(paused, 50 * MIN), 15 * MIN)

  const resumed = resumeTimer(paused, 50 * MIN)
  assert.equal(resumed.endsAt, 65 * MIN)
})

test('adjust adds and removes time, never below zero', () => {
  const timer = startTimer(base, 0)
  assert.equal(remainingMs(adjustTimer(timer, MIN, 0), 0), 21 * MIN)
  assert.equal(remainingMs(adjustTimer(timer, -MIN, 0), 0), 19 * MIN)
  assert.equal(remainingMs(adjustTimer(timer, -30 * MIN, 0), 0), 0)

  const paused = pauseTimer(timer, 10 * MIN)
  assert.equal(adjustTimer(paused, MIN, 99 * MIN).remainingMs, 11 * MIN)
})

test('adding time to a ringing timer restarts it', () => {
  const { timers } = markDue([startTimer(base, 0)], 20 * MIN)
  const snoozed = adjustTimer(timers[0], MIN, 20 * MIN)
  assert.equal(snoozed.ringing, false)
  assert.equal(snoozed.endsAt, 21 * MIN)
  assert.equal(adjustTimer(timers[0], -MIN, 20 * MIN), timers[0])
})

test('markDue rings only running timers that have ended', () => {
  const ended = startTimer(base, 0)
  const later = startTimer({ ...base, id: 'b', durationMs: 40 * MIN }, 0)
  const paused = pauseTimer(startTimer({ ...base, id: 'c' }, 0), MIN)

  const first = markDue([ended, later, paused], 20 * MIN)
  assert.deepEqual(first.due.map((t) => t.id), ['a'])
  assert.equal(first.timers[0].ringing, true)
  assert.equal(first.timers[2].ringing, false)

  const again = markDue(first.timers, 21 * MIN)
  assert.equal(again.due.length, 0)
  assert.equal(again.timers, first.timers)
})

test('timerLabel names the step so it is clear which timer rings', () => {
  assert.equal(timerLabel(base), 'Steg 3: La hvile i 20–30 min.')
  assert.equal(timerLabel({ stepIndex: 0, stepText: '' }), 'Steg 1')
  const long = timerLabel({ stepIndex: 0, stepText: 'x'.repeat(80) })
  assert.ok(long.endsWith('…'))
  assert.ok(long.length < 60)
})

test('parseStoredTimers tolerates junk', () => {
  const timer = startTimer(base, 0)
  assert.deepEqual(parseStoredTimers(JSON.stringify([timer, { id: 1 }, null])), [timer])
  assert.deepEqual(parseStoredTimers('ikke json'), [])
  assert.deepEqual(parseStoredTimers(null), [])
})

test('the timer button summary counts timers and finds the one ending first', () => {
  const long = startTimer({ ...base, id: 'long', durationMs: 30 * MIN }, 0)
  const short = startTimer({ ...base, id: 'short', stepIndex: 0, durationMs: 2 * MIN }, 0)
  const paused = pauseTimer(startTimer({ ...base, id: 'paused', durationMs: MIN }, 0), 0)
  const summary = timerSummary([long, short, paused], 10_000)
  assert.equal(summary.count, 3)
  assert.equal(summary.next?.id, 'short')
  assert.deepEqual(summary.ringing, [])
})

test('the timer button summary lists ringing timers by name', () => {
  const short = startTimer({ ...base, id: 'short', stepIndex: 0, stepText: 'Fres løk', durationMs: MIN }, 0)
  const long = startTimer({ ...base, id: 'long', durationMs: 30 * MIN }, 0)
  const { timers } = markDue([short, long], 2 * MIN)
  const summary = timerSummary(timers, 2 * MIN)
  assert.deepEqual(summary.ringing.map(timerLabel), ['Steg 1: Fres løk'])
  assert.equal(summary.next?.id, 'long')
})

test('the timer button summary is empty without timers', () => {
  assert.deepEqual(timerSummary([], 0), { count: 0, ringing: [], next: null })
})

test('cooking mode shows a pill only when a timer has a minute or less left', () => {
  const far = startTimer({ ...base, id: 'far', durationMs: 19 * MIN }, 0)
  const close = startTimer({ ...base, id: 'close', stepIndex: 1, durationMs: 90_000 }, 0)
  const closer = startTimer({ ...base, id: 'closer', stepIndex: 0, durationMs: 70_000 }, 0)
  const result = cookingModeTimers([far, close, closer], 40_000)
  assert.deepEqual(result.soon.map((t) => t.id), ['closer', 'close'])
  assert.deepEqual(result.inBell.map((t) => t.id), ['far', 'close', 'closer'])
  assert.deepEqual(result.ringing, [])
})

test('cooking mode moves a ringing timer out of the bell and into its own card', () => {
  const short = startTimer({ ...base, id: 'short', durationMs: MIN }, 0)
  const long = startTimer({ ...base, id: 'long', durationMs: 30 * MIN }, 0)
  const { timers } = markDue([short, long], 2 * MIN)
  const result = cookingModeTimers(timers, 2 * MIN)
  assert.deepEqual(result.ringing.map((t) => t.id), ['short'])
  assert.deepEqual(result.inBell.map((t) => t.id), ['long'])
  assert.deepEqual(result.soon, [])
})

test('cooking mode keeps paused timers in the bell but never as a pill', () => {
  const paused = pauseTimer(startTimer({ ...base, id: 'paused', durationMs: 30_000 }, 0), 0)
  const result = cookingModeTimers([paused], 5_000)
  assert.deepEqual(result.soon, [])
  assert.deepEqual(result.inBell.map((t) => t.id), ['paused'])
})
