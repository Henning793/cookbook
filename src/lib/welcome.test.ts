import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NEWS_SEEN_KEY, WELCOME_SEEN_KEY, isWelcomeSeen, markNewsSeen, markWelcomeSeen, unseenNews } from './welcome.ts'

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

test('nyheter vises ikke før hele velkomsten er sett, og den markerer dem som sett', () => {
  const store = memoryStore()
  assert.deepEqual(unseenNews(store, ['a']), [])
  markWelcomeSeen(store, ['a'])
  assert.deepEqual(unseenNews(store, ['a']), [])
})

test('den som har sett velkomsten før, får bare nyhetene én gang', () => {
  const store = memoryStore()
  store.setItem(WELCOME_SEEN_KEY, '1')
  assert.deepEqual(unseenNews(store, ['a', 'b']), ['a', 'b'])
  markNewsSeen(store, ['a'])
  assert.deepEqual(unseenNews(store, ['a', 'b']), ['b'])
  markNewsSeen(store, ['b'])
  assert.deepEqual(unseenNews(store, ['a', 'b']), [])
})

test('ødelagt eller blokkert lagring gir ingen nyheter og krasjer ikke', () => {
  const store = memoryStore()
  store.setItem(WELCOME_SEEN_KEY, '1')
  store.setItem(NEWS_SEEN_KEY, '{ikke json')
  assert.deepEqual(unseenNews(store, ['a']), [])
  markNewsSeen(store, ['a'])
  assert.equal(store.getItem(NEWS_SEEN_KEY), '["a"]')
  assert.deepEqual(unseenNews(throwingStore, ['a']), [])
  assert.doesNotThrow(() => markNewsSeen(throwingStore, ['a']))
})
