import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WELCOME_SEEN_KEY, isWelcomeSeen, markWelcomeSeen } from './welcome.ts'

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
