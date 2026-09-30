/**
 * The host service, driven against stand-in seams.
 *
 * These tests exist because the interesting behaviour of this plugin is
 * entirely in how it maps one seam's vocabulary onto a request/response
 * surface — and that mapping is the part no type can check. Everything else
 * (the OAuth protocol, token storage, refresh) belongs to upstream and is not
 * simulated here.
 *
 * A real Cordis context is used rather than a hand-rolled `ctx` object,
 * because one of the things under test is that the nested injects actually
 * deliver the seams.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Context, Service } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { CodexAuthService } from '../lib/index.js'

/** FLOW_KEY as the credential seam renders it. */
const KEY = 'llm-pi-ai/openai-codex'

/**
 * A stand-in for `ctx.authorization`: it records the interaction it was handed
 * and settles only when the test says so, which is what makes the in-flight
 * states observable.
 */
class FakeAuthorization extends Service {
  constructor(ctx) {
    super(ctx, 'authorization')
    this.interaction = null
    this.settle = null
    this.fail = null
    this.begins = 0
    this.cancels = 0
  }

  begin(request) {
    this.begins += 1
    this.interaction = request.interaction
    return new Promise((resolve, reject) => {
      this.settle = (status) => resolve({ status })
      this.fail = (error) => reject(error)
    })
  }

  cancel() {
    this.cancels += 1
    this.settle?.('cancelled')
    return undefined
  }

  describe(key) {
    if (key !== KEY) return undefined
    return { key, label: 'OpenAI (ChatGPT Plus/Pro)', methods: [{ id: 'oauth', label: 'Sign in' }], inFlight: this.settle !== null }
  }

  /** Push one notice, as the flow would. */
  notify(notice) {
    this.interaction.notify(notice)
  }

  /** Ask one question, as the flow would. Attach a handler before awaiting. */
  prompt(prompt) {
    return this.interaction.prompt(prompt)
  }
}

/** A stand-in for `ctx.credentials`, holding at most one record. */
class FakeCredentials extends Service {
  constructor(ctx) {
    super(ctx, 'credentials')
    this.records = new Map()
    this.deleted = []
  }

  async readRecord(key) {
    return this.records.get(key)
  }

  async deleteRecord(key) {
    this.deleted.push(key)
    this.records.delete(key)
  }

  async describeRecord(key) {
    return { configured: this.records.has(key) }
  }
}

/** A stand-in for `ctx.settings`, answering one describe() shape. */
class FakeSettings extends Service {
  constructor(ctx, providers) {
    super(ctx, 'settings')
    this.providers = providers
    this.throws = false
  }

  describe() {
    if (this.throws) throw new Error('settings unavailable')
    return [{
      ns: 'llm-pi-ai',
      value: { providers: this.providers },
    }]
  }
}

/**
 * Assemble a context with the given seams and one constructed service.
 *
 * `service` is deliberately the TRACEABLE PROXY that `ctx.get()` hands out,
 * not the instance the constructor returned. Cordis wraps every service in a
 * proxy before a caller sees it, and a Remote invocation reaches the method
 * through that proxy — where a `#private` member is unreachable and a field
 * assignment lands on the proxy instead of the service. Driving the raw
 * instance would pass while the real path failed, which is exactly the bug the
 * staging probe found.
 *
 * @param options - which seams to mount, and the settings document to answer.
 * @returns the root context, the proxied service, and the stand-in seams.
 */
async function harness(options = {}) {
  const ctx = new Context()
  const authorization = options.authorization === false ? null : new FakeAuthorization(ctx)
  const credentials = options.credentials === false ? null : new FakeCredentials(ctx)
  const settings = options.settings === false
    ? null
    : new FakeSettings(ctx, options.providers ?? { 'openai-codex': {} })
  const instance = new CodexAuthService(ctx)
  // The nested injects run on their own fibers; one turn is enough for the
  // services provided above to reach them.
  await new Promise((resolve) => setTimeout(resolve, 5))
  const service = ctx.get('codexAuth')
  assert.notEqual(service, undefined, 'the service did not register under its key')
  return { ctx, service, instance, authorization, credentials, settings }
}

test('the service exports exactly the Remote methods the client declares', async () => {
  const { ctx, instance } = await harness()
  assert.deepEqual(
    remoteMethods(instance).map((marker) => marker.method),
    ['status', 'signIn', 'answer', 'cancel', 'signOut'],
  )
  assert.equal(instance.typertRemote.serviceKey, 'codexAuth')
  assert.equal(instance.typertRemote.namespace, 'codexAuth')
  await ctx.fiber.dispose()
})

test('every Remote method survives the proxy Cordis hands a caller', async () => {
  // The five methods are what the Gateway reflects over, and it calls them on
  // the traceable proxy. This is the regression guard for the private-field
  // and field-assignment hazards documented on the class.
  const { ctx, service } = await harness()
  const status = await service.status()
  assert.equal(status.ready, true)
  assert.equal((await service.signIn()).phase, 'running')
  assert.equal((await service.cancel()).phase, 'cancelled')
  assert.equal((await service.signOut()).signedIn, false)
  await ctx.fiber.dispose()
})

test('status reports the seams as ready once they arrive', async () => {
  const { ctx, service } = await harness()
  const status = await service.status()
  assert.equal(status.ready, true)
  assert.equal(status.signedIn, false)
  assert.equal(status.routeConfigured, true)
  assert.equal(status.flowAvailable, true)
  assert.equal(status.flowLabel, 'OpenAI (ChatGPT Plus/Pro)')
  assert.equal(status.attempt.phase, 'idle')
  await ctx.fiber.dispose()
})

test('an unmounted seam is reported, not thrown', async () => {
  const noAuth = await harness({ authorization: false })
  assert.equal((await noAuth.service.status()).ready, false)
  assert.equal((await noAuth.service.status()).flowAvailable, false)
  await assert.rejects(() => noAuth.service.signIn(), /授权服务/)
  await noAuth.ctx.fiber.dispose()

  const noStore = await harness({ credentials: false })
  assert.equal((await noStore.service.status()).ready, false)
  await assert.rejects(() => noStore.service.signOut(), /凭证服务/)
  await noStore.ctx.fiber.dispose()
})

test('a missing route is reported as false, and an unreadable one as unknown', async () => {
  const missing = await harness({ providers: {} })
  assert.equal((await missing.service.status()).routeConfigured, false)
  await missing.ctx.fiber.dispose()

  const absent = await harness({ settings: false })
  assert.equal((await absent.service.status()).routeConfigured, null)
  await absent.ctx.fiber.dispose()

  const broken = await harness()
  broken.settings.throws = true
  assert.equal((await broken.service.status()).routeConfigured, null)
  await broken.ctx.fiber.dispose()
})

test('a sign-in carries the flow notice and question through to the caller', async () => {
  const { ctx, service, authorization } = await harness()

  const started = await service.signIn()
  assert.equal(started.phase, 'running')

  authorization.notify({ message: 'Enter this code', url: 'https://example.test/device', code: 'ABCD-EFGH' })
  const pending = authorization.prompt({ kind: 'select', message: 'Pick one', options: [{ id: 'browser', label: 'Browser' }] })
  pending.catch(() => {})

  const waiting = await service.status()
  assert.equal(waiting.attempt.phase, 'running')
  assert.deepEqual(waiting.attempt.notice, {
    message: 'Enter this code',
    url: 'https://example.test/device',
    code: 'ABCD-EFGH',
  })
  assert.deepEqual(waiting.attempt.prompt, {
    kind: 'select',
    message: 'Pick one',
    placeholder: null,
    options: [{ id: 'browser', label: 'Browser', description: null }],
  })

  await service.answer('browser')
  assert.equal(await pending, 'browser')

  authorization.settle('authorized')
  await new Promise((resolve) => setTimeout(resolve, 5))
  const settled = await service.status()
  assert.equal(settled.attempt.phase, 'authorized')
  assert.equal(settled.attempt.prompt, null)
  await ctx.fiber.dispose()
})

test('a second sign-in while one runs reports the live attempt instead of failing', async () => {
  const { ctx, service, authorization } = await harness()
  await service.signIn()
  const again = await service.signIn()
  assert.equal(again.phase, 'running')
  // The seam refuses a second `begin()` for a live key; reaching it would have
  // thrown ALREADY_IN_FLIGHT out to the caller.
  assert.equal(authorization.begins, 1)
  await ctx.fiber.dispose()
})

test('answering with no question pending is an error, not a no-op', async () => {
  const { ctx, service } = await harness()
  await assert.rejects(() => service.answer('anything'), /没有等待回答的问题/)
  await ctx.fiber.dispose()
})

test('cancelling settles the attempt as cancelled and withdraws it upstream', async () => {
  const { ctx, service, authorization } = await harness()
  await service.signIn()
  const state = await service.cancel()
  assert.equal(state.phase, 'cancelled')
  assert.equal(authorization.cancels, 1)
  await ctx.fiber.dispose()
})

test('a flow failure becomes a message on the attempt', async () => {
  const { ctx, service, authorization } = await harness()
  await service.signIn()
  authorization.fail(new Error('Device flow timed out'))
  await new Promise((resolve) => setTimeout(resolve, 5))
  const status = await service.status()
  assert.equal(status.attempt.phase, 'failed')
  assert.equal(status.attempt.error, 'Device flow timed out')
  await ctx.fiber.dispose()
})

test('sign-out deletes the record and re-reads the state', async () => {
  const { ctx, service, credentials } = await harness()
  credentials.records.set(KEY, {
    kind: 'grant',
    payload: { type: 'oauth', access: 'opaque', expires: 1, accountId: 'acct-0123456789abcdef' },
  })
  const before = await service.status()
  assert.equal(before.signedIn, true)
  // The unmasked id must not be what the wire carries.
  assert.equal(before.accountId, 'acct-012…cdef')

  const after = await service.signOut()
  assert.deepEqual(credentials.deleted, [KEY])
  assert.equal(after.signedIn, false)
  await ctx.fiber.dispose()
})

test('unloading the plugin withdraws a running sign-in', async () => {
  const { ctx, service, authorization } = await harness()
  await service.signIn()
  await ctx.fiber.dispose()
  assert.equal(authorization.cancels >= 1, true)
})
