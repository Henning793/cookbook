import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cookingSessionKey, readCookingSession, writeCookingSession } from './cookingSession.ts'

function memoryStore() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

const throwingStore = {
  getItem: () => {
    throw new Error('blokkert')
  },
  setItem: () => {
    throw new Error('blokkert')
  },
  removeItem: () => {
    throw new Error('blokkert')
  },
}

test('kokeøkten leses tilbake for samme bruker', () => {
  const store = memoryStore()
  writeCookingSession(store, 'anna', { recipeId: 'r1', stepIndex: 2, servings: 6 })
  assert.deepEqual(readCookingSession(store, 'anna'), { recipeId: 'r1', stepIndex: 2, servings: 6 })
})

test('en annen bruker i samme nettleser ser ikke kokeøkten', () => {
  const store = memoryStore()
  writeCookingSession(store, 'anna', { recipeId: 'r1', stepIndex: 2 })
  assert.equal(readCookingSession(store, 'berit'), null)
  assert.equal(readCookingSession(store, null), null)
})

test('hver bruker har sin egen kokeøkt', () => {
  const store = memoryStore()
  writeCookingSession(store, 'anna', { recipeId: 'r1', stepIndex: 2 })
  writeCookingSession(store, 'berit', { recipeId: 'r2', stepIndex: 0 })
  writeCookingSession(store, 'berit', null)
  assert.deepEqual(readCookingSession(store, 'anna'), { recipeId: 'r1', stepIndex: 2 })
  assert.equal(readCookingSession(store, 'berit'), null)
})

test('kokeøkt lagret før den ble knyttet til bruker vises ikke for innloggede', () => {
  const store = memoryStore()
  store.setItem(cookingSessionKey(null), JSON.stringify({ recipeId: 'r1', stepIndex: 3 }))
  assert.equal(readCookingSession(store, 'anna'), null)
  assert.deepEqual(readCookingSession(store, null), { recipeId: 'r1', stepIndex: 3 })
})

test('ugyldig innhold og blokkert lagring gir ingen kokeøkt og krasjer ikke', () => {
  const store = memoryStore()
  store.setItem(cookingSessionKey('anna'), 'ikke json')
  assert.equal(readCookingSession(store, 'anna'), null)
  store.setItem(cookingSessionKey('anna'), JSON.stringify({ stepIndex: 1 }))
  assert.equal(readCookingSession(store, 'anna'), null)
  assert.equal(readCookingSession(throwingStore, 'anna'), null)
  assert.doesNotThrow(() => writeCookingSession(throwingStore, 'anna', { recipeId: 'r1', stepIndex: 0 }))
})
