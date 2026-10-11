import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WELCOME_SEEN_KEY, isNewUser, isWelcomeSeen, markWelcomeSeen } from './welcome.ts'

function memoryStore() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

const throwingStore = {
  getItem: () => {
    throw new Error('blokkert')
  },
  setItem: () => {
    throw new Error('blokkert')
  },
}

test('velkomsten er ikke sett før den er markert som sett', () => {
  const store = memoryStore()
  assert.equal(isWelcomeSeen(store), false)
  markWelcomeSeen(store)
  assert.equal(isWelcomeSeen(store), true)
  assert.equal(store.getItem(WELCOME_SEEN_KEY), '1')
})

test('blokkert lagring regnes som sett og krasjer ikke', () => {
  assert.equal(isWelcomeSeen(throwingStore), true)
  assert.doesNotThrow(() => markWelcomeSeen(throwingStore))
})

test('ny bruker er en konto opprettet de siste 14 dagene', () => {
  const now = Date.parse('2026-10-11T12:00:00Z')
  assert.equal(isNewUser('2026-10-11T11:00:00Z', now), true)
  assert.equal(isNewUser('2026-09-28T13:00:00Z', now), true)
  assert.equal(isNewUser('2026-09-27T11:00:00Z', now), false)
  assert.equal(isNewUser('2025-01-01T00:00:00Z', now), false)
})

test('manglende eller ugyldig opprettelsesdato gir ikke velkomst', () => {
  assert.equal(isNewUser(undefined), false)
  assert.equal(isNewUser('ikke en dato'), false)
})
