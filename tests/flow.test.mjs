/**
 * The grant projection: what this plugin is willing to believe about a stored
 * credential, and what it refuses to.
 *
 * These cases matter because the payload is written by pi-ai and owned by
 * pi-ai — this plugin is a reader of somebody else's format. An unrecognised
 * shape has to read as "signed out" rather than throw, or a settings page dies
 * on a format change it was never promised.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { grantFacts, maskAccountId } from '../lib/flow.js'

/**
 * Build a JWT with the claims Codex actually writes, unsigned.
 * @param claims - the `https://api.openai.com/auth` claim body.
 * @returns a three-segment compact token.
 */
function jwt(claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ 'https://api.openai.com/auth': claims })}.signature`
}

test('an absent record is signed out', () => {
  assert.deepEqual(grantFacts(undefined), {
    signedIn: false,
    accountId: null,
    planType: null,
    expiresAt: null,
  })
})

test('an api-key record is signed out, not an error', () => {
  const facts = grantFacts({ kind: 'api-key', key: 'sk-not-ours' })
  assert.equal(facts.signedIn, false)
  assert.equal(facts.accountId, null)
})

test('a grant without an access token is signed out', () => {
  assert.equal(grantFacts({ kind: 'grant', payload: { type: 'oauth', refresh: 'r' } }).signedIn, false)
})

test('a pi-ai oauth grant reports account, plan and expiry', () => {
  const expires = Date.UTC(2025, 0, 2, 3, 4, 5)
  const facts = grantFacts({
    kind: 'grant',
    payload: {
      type: 'oauth',
      access: jwt({ chatgpt_account_id: 'acct-0123456789abcdef', chatgpt_plan_type: 'plus' }),
      refresh: 'refresh-token',
      expires,
      accountId: 'acct-0123456789abcdef',
    },
  })
  assert.equal(facts.signedIn, true)
  assert.equal(facts.accountId, 'acct-0123456789abcdef')
  assert.equal(facts.planType, 'plus')
  assert.equal(facts.expiresAt, expires)
})

test('the plan claim is read from the token, not invented', () => {
  const access = jwt({ chatgpt_account_id: 'a' })
  const facts = grantFacts({ kind: 'grant', payload: { type: 'oauth', access, expires: 1, accountId: 'a' } })
  assert.equal(facts.planType, null)
})

test('a non-JWT access token still signs in, with no plan', () => {
  const facts = grantFacts({
    kind: 'grant',
    payload: { type: 'oauth', access: 'opaque-token', expires: 42, accountId: 'acct' },
  })
  assert.equal(facts.signedIn, true)
  assert.equal(facts.planType, null)
  assert.equal(facts.accountId, 'acct')
  assert.equal(facts.expiresAt, 42)
})

test('a non-numeric expiry reads as unknown rather than as a date', () => {
  const facts = grantFacts({ kind: 'grant', payload: { type: 'oauth', access: 'x', expires: 'soon' } })
  assert.equal(facts.expiresAt, null)
})

test('an account id is masked to its ends', () => {
  assert.equal(maskAccountId('acct-0123456789abcdef'), 'acct-012…cdef')
  assert.equal(maskAccountId('short'), 'short')
  assert.equal(maskAccountId(''), null)
  assert.equal(maskAccountId(null), null)
})
