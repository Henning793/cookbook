import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isUrlAllowed } from './urlSafety.mjs'

test('tillater vanlige https-URL-er', () => {
  assert.equal(isUrlAllowed('https://www.example.com/oppskrift'), true)
})

test('tillater http-URL-er', () => {
  assert.equal(isUrlAllowed('http://example.com'), true)
})

test('avviser localhost', () => {
  assert.equal(isUrlAllowed('http://localhost:3000'), false)
})

test('avviser 127.0.0.1', () => {
  assert.equal(isUrlAllowed('http://127.0.0.1'), false)
})

test('avviser private 192.168.x.x', () => {
  assert.equal(isUrlAllowed('http://192.168.1.5'), false)
})

test('avviser private 10.x.x.x', () => {
  assert.equal(isUrlAllowed('http://10.0.0.1'), false)
})

test('avviser private 172.16-31.x.x', () => {
  assert.equal(isUrlAllowed('http://172.20.0.1'), false)
})

test('tillater 172.15.x.x (utenfor privat rekke)', () => {
  assert.equal(isUrlAllowed('http://172.15.0.1'), true)
})

test('avviser 169.254.x.x (cloud metadata)', () => {
  assert.equal(isUrlAllowed('http://169.254.169.254'), false)
})

test('avviser ikke-http(s)-skjema', () => {
  assert.equal(isUrlAllowed('file:///etc/passwd'), false)
})

test('avviser ugyldig URL', () => {
  assert.equal(isUrlAllowed('ikke en url'), false)
})
