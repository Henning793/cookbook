import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLinkPath, linkPath, linkUrl } from './inviteLinks.ts'

const TOKEN = '0123456789abcdef0123456789abcdef'

test('lenker til invitasjon og deling', () => {
  assert.equal(linkPath('invite', TOKEN), `/bli-med/${TOKEN}`)
  assert.equal(linkPath('share', TOKEN), `/del/${TOKEN}`)
  assert.equal(linkUrl('invite', TOKEN, 'https://kokeboka.example'), `https://kokeboka.example/bli-med/${TOKEN}`)
})

test('bare invitasjons- og delingsstier huskes', () => {
  assert.equal(isLinkPath(linkPath('invite', TOKEN)), true)
  assert.equal(isLinkPath(linkPath('share', TOKEN)), true)
  assert.equal(isLinkPath('/familie'), false)
  assert.equal(isLinkPath('/bli-med/'), false)
  assert.equal(isLinkPath('/bli-med/kort'), false)
  assert.equal(isLinkPath(`https://annet.example/bli-med/${TOKEN}`), false)
  assert.equal(isLinkPath(`/del/${TOKEN}/../../meg`), false)
  assert.equal(isLinkPath(null), false)
})
