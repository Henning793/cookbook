import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startUpdateChecks, type UpdateCheckEnv } from './swUpdateChecks.ts'

function makeEnv(options: { online?: boolean } = {}) {
  const intervals = new Map<number, () => void>()
  const listeners = new Set<() => void>()
  let nextId = 1
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  const state = { online: options.online ?? true }
  const env = {
    setInterval: (callback: () => void) => {
      const id = nextId++
      intervals.set(id, callback)
      return id
    },
    clearInterval: (id: unknown) => intervals.delete(id as number),
    document: doc,
    isOnline: () => state.online,
  } as unknown as UpdateCheckEnv

  return {
    env,
    doc,
    state,
    tick: () => intervals.forEach((callback) => callback()),
    fireVisibility: (visibility: DocumentVisibilityState) => {
      doc.visibilityState = visibility
      listeners.forEach((listener) => listener())
    },
    intervalCount: () => intervals.size,
    listenerCount: () => listeners.size,
  }
}

function makeRegistration() {
  const registration = {
    calls: 0,
    update: () => {
      registration.calls++
      return Promise.resolve()
    },
  }
  return registration
}

test('checks for updates on every interval tick', () => {
  const fake = makeEnv()
  const registration = makeRegistration()
  startUpdateChecks(registration, 1000, fake.env)

  assert.equal(registration.calls, 0)
  fake.tick()
  fake.tick()
  assert.equal(registration.calls, 2)
})

test('checks for updates when the app comes back to the foreground', () => {
  const fake = makeEnv()
  const registration = makeRegistration()
  startUpdateChecks(registration, 1000, fake.env)

  fake.fireVisibility('hidden')
  assert.equal(registration.calls, 0)
  fake.fireVisibility('visible')
  assert.equal(registration.calls, 1)
})

test('skips checks while offline', () => {
  const fake = makeEnv({ online: false })
  const registration = makeRegistration()
  startUpdateChecks(registration, 1000, fake.env)

  fake.tick()
  fake.fireVisibility('visible')
  assert.equal(registration.calls, 0)

  fake.state.online = true
  fake.tick()
  assert.equal(registration.calls, 1)
})

test('a failed check does not throw', async () => {
  const fake = makeEnv()
  startUpdateChecks({ update: () => Promise.reject(new Error('network')) }, 1000, fake.env)

  assert.doesNotThrow(() => fake.tick())
  // Let the rejected promise settle; an unhandled rejection would fail the test run.
  await new Promise((resolve) => setImmediate(resolve))
})

test('stop() removes the interval and the visibility listener', () => {
  const fake = makeEnv()
  const registration = makeRegistration()
  const stop = startUpdateChecks(registration, 1000, fake.env)

  assert.equal(fake.intervalCount(), 1)
  assert.equal(fake.listenerCount(), 1)
  stop()
  assert.equal(fake.intervalCount(), 0)
  assert.equal(fake.listenerCount(), 0)
})
