/**
 * The browser bundle, loaded the way the page loads it.
 *
 * The bundle is a closure-factory artifact, not an ES module, so the test has
 * to stand up the loader facade and call the factory itself. What is worth
 * testing here is the WIRING — which slot the card claims, under which key,
 * and what it does with a row that is not Codex — because every one of those
 * is invisible until a user opens the Models page and either sees the card or
 * does not.
 *
 * Rendering is out of scope: the components need a React reconciler, and the
 * failure this suite guards against happens before the first render.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = join(root, 'client/client.js')

/**
 * Load the built bundle and hand back its factory, exactly as the page does.
 *
 * The host module table is stood in for using the bundle's OWN list of required
 * primitives, so the two can never drift — the first version of this file
 * restated the list, and adding one icon to the card broke three cases here
 * while the card itself was fine.
 *
 * @param options - `omit` drops one primitive, to exercise the gate.
 * @returns the registration, the module face, and the required member names.
 */
async function loadFace(options = {}) {
  let registration
  globalThis.window = {
    __ModuleLoader__: {
      load(value) {
        registration = value
      },
    },
  }
  // A fresh URL per load keeps the module cache from serving a previous test's
  // execution; the bundle registers itself as a side effect.
  await import(`${pathToFileURL(BUNDLE).href}?t=${String(Date.now())}${String(Math.random())}`)
  assert.ok(registration !== undefined, 'the bundle did not call window.__ModuleLoader__.load')
  // One probe execution with an empty host, only to read the list the bundle
  // declares; a factory call is a pure re-evaluation, so the real face is built
  // straight after. Reading it this way keeps the answer independent of the
  // order node:test happens to run these cases in.
  const required = [...registration.factory(makeRequire([])).REQUIRED_PRIMITIVES]
  const face = registration.factory(makeRequire(required.filter((member) => member !== options.omit)))
  return { registration, face, required, omit: options.omit }
}

/**
 * A `require` answering the three specifiers the bundle reaches for.
 * @param members - which primitive names the stand-in host exports.
 * @returns the require function a factory receives.
 */
function makeRequire(members) {
  const primitives = {}
  for (const member of members) primitives[member] = function Stub() {}
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Component: class Component {},
    useState: (value) => [value, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
    useRef: (value) => ({ current: value }),
  }
  return (specifier) => {
    if (specifier === 'react') return react
    if (specifier === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' }
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error(`the bundle required an unexpected module: ${specifier}`)
  }
}

/** A recording client context, with the injections kept for the test to fire. */
function makeContext() {
  const record = {
    slots: [],
    dictionaries: [],
    injections: [],
    mounted: null,
    warnings: [],
    api: {},
  }
  const slots = {
    inject(slot, register) {
      record.injections.push({ slot, register })
    },
    register(options, component) {
      record.slots.push({ options, component })
      return () => {}
    },
  }
  const locale = {
    register(namespace, dictionaries) {
      record.dictionaries.push({ namespace, dictionaries })
      return () => {}
    },
    bind() {
      return (key) => key
    },
  }
  const remote = {
    $mount(contribution) {
      record.mounted = contribution
      return Promise.resolve(async () => {})
    },
  }
  const ctx = {
    effect(callback) {
      callback()
    },
    inject(services, callback) {
      record.injections.push({ services, callback })
    },
    get(service) {
      return service === 'remote.codexAuth' ? record.api : undefined
    },
    locale,
    slots,
    remote,
  }
  return { ctx, record }
}

test('the bundle registers under its own id and exports a plugin face', async () => {
  const { registration, face, required } = await loadFace()
  assert.equal(Array.isArray(required) && required.length > 0, true, 'the bundle published no required-primitive list')
  assert.equal(registration.id, 'dsh-codex-oauth')
  assert.equal(typeof face.apply, 'function')
  assert.equal(face.name, 'codex-oauth')
  assert.deepEqual(face.inject, ['slots', 'locale', 'remote'])
})

test('the mounted contribution declares the five host methods', async () => {
  const { face } = await loadFace()
  const { ctx, record } = makeContext()
  face.apply(ctx)
  assert.equal(record.mounted.package, 'dsh-codex-oauth')
  assert.deepEqual(record.mounted.descriptors.map((descriptor) => descriptor.method), [
    'status', 'signIn', 'answer', 'cancel', 'signOut',
  ])
  // `answer` is the one method with an argument, and its wire field has to be
  // the host method's own parameter name.
  const answer = record.mounted.descriptors.find((descriptor) => descriptor.method === 'answer')
  // The wire field has to be the host method's own parameter name. The rest of
  // the codec — which the reflection registry also inspects — is the subject of
  // tests/descriptors.test.mjs, which runs it against the real registry.
  assert.deepEqual(answer.parameters.map((parameter) => [parameter.name, parameter.wire, parameter.source]), [['value', 'value', 'json']])
  for (const descriptor of record.mounted.descriptors) {
    for (const parameter of descriptor.parameters) assert.equal(parameter.codec.mode, 'strict')
  }
})

/**
 * Drive `apply` through both injections the host would fire: the Remote
 * namespace appearing, then the Models page declaring the slot.
 * @param face - the bundle's exported plugin face.
 * @returns the recording context and the registered card component.
 */
async function wire(face) {
  const { ctx, record } = makeContext()
  face.apply(ctx)

  const slotInject = record.injections.find((entry) => entry.slot === 'settings.section')
  assert.ok(slotInject !== undefined, 'the bundle never claimed the settings.section slot')
  // The fake's `inject` runs the callback the way the host runs it once the
  // declaring plugin registers — which is also the proof that registration no
  // longer waits for the Remote namespace.
  const disposer = slotInject.register()
  assert.equal(typeof disposer, 'function', 'the slot claim returned no disposer')
  return { record, component: record.slots[0].component }
}

test('the card takes its own settings section', async () => {
  const { face } = await loadFace()
  const { record } = await wire(face)
  const registered = record.slots[0]
  // A list slot entry: addressed by id and ordered, with a label thunk so a
  // locale switch re-reads the sidebar text.
  assert.equal(registered.options.name, 'settings.section')
  assert.equal(registered.options.id, 'codex-oauth')
  assert.equal(typeof registered.options.order, 'number')
  assert.equal(registered.options.locale, 'codex-oauth')
  assert.equal(typeof registered.options.label, 'function')
  assert.equal(typeof registered.options.inject, 'function')
})

test('the section component renders the card inside the error boundary', async () => {
  const { face } = await loadFace()
  const { record, component } = await wire(face)

  const element = component({})
  assert.notEqual(element, undefined)
  // The element is the boundary wrapping the card, so a render throw stays
  // inside this row.
  assert.equal(element.props.labels.title, 'failed')
  assert.equal(element.props.children[0].type.name, 'CodexSignIn')
  // The namespace is handed over as a getter, so the card can be registered
  // before the mount resolves and still notice it arriving.
  assert.equal(typeof element.props.children[0].props.getApi, 'function')
  assert.equal(element.props.children[0].props.getApi(), record.api)
})

test('a host missing a primitive disables the card instead of blanking the dialog', async () => {
  const { face } = await loadFace({ omit: 'Button' })

  const { ctx, record } = makeContext()
  const warnings = []
  const original = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))
  try {
    face.apply(ctx)
  } finally {
    console.warn = original
  }
  assert.deepEqual(record.slots, [])
  assert.equal(warnings.some((line) => line.includes('Button')), true)
  assert.deepEqual(face.missingPrimitives({}, ['Button']), ['Button'])
})

test('the committed bundle is the one the build produces', async () => {
  // The artifact is committed because an install may block build scripts, so a
  // stale bundle is a real failure mode. `npm run check` rebuilds before
  // asserting; here the shape is asserted so a hand-edited bundle is caught.
  const bundle = await readFile(BUNDLE, 'utf8')
  assert.match(bundle, /^window\.__ModuleLoader__\.load\(/)
  assert.match(bundle, /id: "dsh-codex-oauth"/)
  assert.match(bundle, /exports\.apply = apply/)
})
