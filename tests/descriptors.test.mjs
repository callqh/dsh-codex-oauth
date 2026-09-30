/**
 * The descriptor contract, checked against the code that enforces it.
 *
 * This lane exists because of a real failure. The first version of this bundle
 * declared every codec as `{ mode: 'strict' }` — which passed the gateway's
 * check, and which is what the harness's own gateway documents — and then threw
 * from inside the reflection registry, which additionally requires a strict
 * codec to carry a `typeSymbol` and a `create()` factory. The two gates
 * disagree about what "strict" means. The throw happened inside `$mount`, the
 * plugin caught it and logged a warning, and the result was a plugin that
 * loaded, activated, claimed its slot correctly, and then had nothing to show:
 * indistinguishable from "not installed".
 *
 * So this file does NOT restate the rules. It loads the REAL
 * `@deepseek-ai/dsh-typert-registry` browser bundle — the same artifact the page
 * loads — and hands it the plugin's real contribution. If a future release
 * changes what a codec must carry, this lane fails here rather than in a user's
 * settings dialog.
 *
 * The gateway's half of the contract (`requireStrictInputs`, which demands
 * `mode: 'strict'` on every PARAMETER codec) cannot be reached without a
 * connection and a full page, so it is asserted directly from the gateway's own
 * rule: nothing here may leave a parameter codec non-strict.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = join(root, 'client/client.js')
const require = createRequire(import.meta.url)

/**
 * Load one `__ModuleLoader__` factory artifact the way the page loads it.
 * @param path - absolute path of the bundle.
 * @param externals - what its `require` should answer.
 * @returns the module face the factory exported.
 */
async function loadFactory(path, externals) {
  let registration
  globalThis.window = { __ModuleLoader__: { load(value) { registration = value } } }
  await import(`${pathToFileURL(path).href}?t=${String(Date.now())}${String(Math.random())}`)
  assert.notEqual(registration, undefined, `${path} never registered itself`)
  return registration.factory((specifier) => {
    if (specifier in externals) return externals[specifier]
    throw new Error(`${path} required an unexpected module: ${specifier}`)
  })
}

/**
 * Load this plugin's committed client bundle and read its contribution.
 *
 * The stub host answers every primitive name so the gate passes; this lane is
 * about descriptors, not about rendering.
 * @returns the contribution the bundle declares.
 */
async function contributionOf() {
  const react = await import('react')
  const jsxRuntime = await import('react/jsx-runtime')

  /**
   * A host module table carrying exactly the names the bundle asks for.
   *
   * Materialised as OWN properties on purpose: the bundle wraps this module
   * with `__toESM`, which copies own enumerable keys into a fresh namespace
   * object, so a lazily-answering Proxy would hand the card `undefined`.
   * @param names - the member names to provide.
   * @returns the stub module.
   */
  const primitivesFor = (names) => {
    const stub = {}
    for (const name of names) stub[name] = () => null
    return stub
  }
  const host = (names) => (specifier) => {
    if (specifier === 'react') return react
    if (specifier === 'react/jsx-runtime') return jsxRuntime
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitivesFor(names)
    throw new Error(`unexpected require: ${specifier}`)
  }

  // Probe once with an empty host to read the list the bundle publishes, then
  // build the real face from it — the same order-independence trick the other
  // client lanes use.
  let registration
  globalThis.window = { __ModuleLoader__: { load(value) { registration = value } } }
  await import(`${pathToFileURL(BUNDLE).href}?d=${String(Date.now())}`)
  const names = registration.factory(host([])).REQUIRED_PRIMITIVES
  const face = registration.factory(host(names))
  let captured = null
  const slots = []
  const ctx = {
    effect(callback) { callback() },
    inject() {},
    get() { return undefined },
    locale: { register: () => () => {}, bind: () => (key) => key },
    slots: {
      inject(_slot, register) { register() },
      register(options, component) { slots.push({ options, component }); return () => {} },
    },
    remote: {
      $mount(contribution) {
        captured = contribution
        return Promise.resolve(async () => {})
      },
    },
  }
  face.apply(ctx)
  assert.notEqual(captured, null, 'the bundle never called remote.$mount')
  return captured
}

test('the real reflection registry accepts the contribution', async () => {
  // The registry's own browser bundle, mounted on a real Cordis context, so
  // `ctx.typert.remotes.register` is the exact function the page calls.
  const registryPath = join(dirname(require.resolve('@deepseek-ai/dsh-typert-registry/package.json')), 'lib/client.js')
  const cordis = await import('@deepseek-ai/cordis')
  const registry = await loadFactory(registryPath, { '@deepseek-ai/cordis': cordis })
  const ctx = new Context()
  try {
    registry.apply(ctx)
    assert.notEqual(ctx.typert, undefined, 'the registry did not provide ctx.typert')
    const contribution = await contributionOf()
    // Throws with the registry's own message when a codec is incomplete.
    ctx.typert.remotes.register(contribution)
    // And the endpoint really is readable back, which is what the mount needs.
    assert.notEqual(ctx.typert.remotes.get('codexAuth/status'), undefined)
    assert.notEqual(ctx.typert.remotes.get('codexAuth/answer'), undefined)
  } finally {
    await ctx.fiber.dispose()
  }
})

test('every parameter codec is strict and every result codec is not', async () => {
  const contribution = await contributionOf()
  assert.equal(contribution.package, 'dsh-codex-oauth')
  for (const descriptor of contribution.descriptors) {
    // The gateway refuses to mount a contribution whose parameter codec is not
    // `strict`; the registry refuses one whose strict codec has no factory.
    for (const parameter of descriptor.parameters) {
      assert.equal(parameter.codec.mode, 'strict', `${descriptor.method}.${parameter.name}`)
      assert.equal(typeof parameter.codec.typeSymbol, 'string', `${descriptor.method}.${parameter.name}`)
      assert.notEqual(parameter.codec.typeSymbol.length, 0)
      assert.equal(typeof parameter.codec.create, 'function', `${descriptor.method}.${parameter.name}`)
    }
    // A result is plain JSON the host owns; `src-json` says so and is the one
    // mode the registry exempts, while the gateway never inspects results.
    assert.equal(descriptor.result.mode, 'src-json', descriptor.method)
  }
})

test('the declared methods match the host service', async () => {
  const contribution = await contributionOf()
  assert.deepEqual(
    contribution.descriptors.map((descriptor) => descriptor.method),
    ['status', 'signIn', 'answer', 'cancel', 'signOut'],
  )
  // The one method with an argument: its wire field has to be the host
  // method's own parameter name, which the SRC descriptor derives from the
  // signature.
  const answer = contribution.descriptors.find((descriptor) => descriptor.method === 'answer')
  assert.deepEqual(answer.parameters.map((parameter) => parameter.wire), ['value'])
  for (const descriptor of contribution.descriptors) {
    assert.equal(descriptor.namespace, 'codexAuth')
    assert.equal(descriptor.service, 'codexAuth')
    assert.equal(descriptor.invocation.kind, 'direct')
  }
})

test('the bundle the page loads is the one this lane measured', async () => {
  // The artifact is committed, so a hand-edited or stale bundle is a real
  // possibility; `npm run check` rebuilds before this runs.
  const bundle = await readFile(BUNDLE, 'utf8')
  assert.match(bundle, /create: \(\) => TEXT_SCHEMA/)
  assert.match(bundle, /mode: "src-json"/)
})
