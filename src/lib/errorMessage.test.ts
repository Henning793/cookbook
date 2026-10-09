import { test } from 'node:test'
import assert from 'node:assert/strict'
import { errorMessage } from './errorMessage.ts'

test('henter meldingen fra Error og fra Supabase sine feilobjekter', () => {
  assert.equal(errorMessage(new Error('Lenken er utløpt.')), 'Lenken er utløpt.')
  assert.equal(errorMessage({ message: 'Fant ikke funksjonen', code: 'PGRST202' }), 'Fant ikke funksjonen')
})

test('faller tilbake når det ikke finnes noen melding', () => {
  assert.equal(errorMessage(null), 'Noe gikk feil.')
  assert.equal(errorMessage('tull'), 'Noe gikk feil.')
  assert.equal(errorMessage({ message: '' }), 'Noe gikk feil.')
  assert.equal(errorMessage({}, 'Prøv igjen.'), 'Prøv igjen.')
})
