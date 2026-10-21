import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scrollAction } from './scrollPosition.ts'

test('ny side starter øverst', () => {
  assert.deepEqual(scrollAction('PUSH', '/', '/oppskrift/r1', undefined), { kind: 'top' })
  assert.deepEqual(scrollAction('PUSH', '/samling/Middag', '/oppskrift/r1', 800), { kind: 'top' })
  assert.deepEqual(scrollAction('REPLACE', '/oppskrift/r1/kok', '/oppskrift/r1', 500), { kind: 'top' })
})

test('tilbake henter frem forrige posisjon', () => {
  assert.deepEqual(scrollAction('POP', '/oppskrift/r1', '/', 1200), { kind: 'restore', y: 1200 })
})

test('tilbake uten lagret posisjon starter øverst', () => {
  assert.deepEqual(scrollAction('POP', '/oppskrift/r1', '/', undefined), { kind: 'top' })
})

test('bare søkeparameteren endres: blir stående', () => {
  assert.deepEqual(scrollAction('REPLACE', '/ukesmeny/dag/2', '/ukesmeny/dag/2', 300), { kind: 'keep' })
  assert.deepEqual(scrollAction('REPLACE', '/ukesmeny', '/ukesmeny', 0), { kind: 'keep' })
})
