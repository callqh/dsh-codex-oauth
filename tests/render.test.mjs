/**
 * Render the sign-in card for real.
 *
 * `tests/client.test.mjs` covers the wiring — which slot, which key, which
 * descriptors — and stops before the first render. That leaves the largest
 * remaining risk uncovered: the card is rendered by the host's own React tree,
 * so a throw anywhere in these components surfaces as a blank settings dialog
 * for the user. The card's error boundary contains the blast radius, but a
 * contained crash is still a card that does not work.
 *
 * Two deliberate choices about fidelity:
 *
 * - **Real React and a real DOM.** Components are mounted with `react-dom` into
 *   jsdom, so hooks, effects and event handlers run the way they will in a
 *   browser, and the assertions are made against rendered text.
 * - **Stubbed primitives, not the host's.** The host's atoms cannot be imported
 *   outside the page's bundler — the published package statically pulls in
 *   shiki, katex and CSS Modules, all of which the harness inlines into its own
 *   bundle. What is under test here is this plugin's component, not the host's
 *   word for "button", so the stubs render plain elements and forward the props
 *   that carry meaning (`onClick`, `disabled`, `children`). The gate that guards
 *   against a host missing a primitive is covered separately in
 *   `client.test.mjs`.
 *
 * Nothing in the bundle is mocked: `client/client.js` is loaded through a
 * stand-in `window.__ModuleLoader__`, exactly as the page loads it.
 */
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = join(root, 'client/client.js')

/** The DOM the components render into, installed as globals for React. */
// No `pretendToBeVisual`: its requestAnimationFrame loop keeps the process
// alive forever, and the test run then hangs instead of failing.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1/' })
// Assigned with defineProperty: recent Node versions expose `navigator` as a
// getter-only global, and a bare assignment throws before any test runs.
for (const [name, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true })
}

// Imported AFTER the DOM exists, and that ordering is load-bearing: React
// decides at module-evaluation time whether it is in a browser, and a copy that
// loaded before `document` existed renders but never wires up its event system —
// `onChange` and `onSubmit` then silently never fire.
const React = await import('react')
const { Fragment, jsx, jsxs } = await import('react/jsx-runtime')
const { createRoot } = await import('react-dom/client')
const act = React.act ?? (await import('react-dom/test-utils')).act

/**
 * Stand-ins for the host's atoms: plain elements that pass through the props
 * the card's behaviour depends on.
 * @returns the module the bundle's `require` answers with.
 */
function makePrimitives(names) {
  // Void elements take no children; handing React one is a hard error, which is
  // exactly what a naive passthrough does to <input>.
  const VOID = new Set(['input', 'img', 'br', 'hr'])
  const passthrough = (tag) => function Primitive({ children, icon, ...rest }) {
    if (VOID.has(tag)) return React.createElement(tag, rest)
    return React.createElement(tag, rest, icon ?? null, children)
  }
  const glyph = (name) => function Icon(props) {
    return React.createElement('span', { 'data-icon': name, ...props })
  }
  const primitives = {
    Button: passthrough('button'),
    Input: passthrough('input'),
    StateDot: (props) => React.createElement('span', { 'data-state': props.state }),
  }
  // Every icon the card names is built from the list it publishes, and they must
  // be OWN properties: the bundle wraps this module with `__toESM`, which copies
  // own enumerable keys into a fresh namespace object, so a lazy Proxy — whose
  // `ownKeys` forwards to an empty target — would hand the card `undefined`.
  // Only the icons; Button/Input/StateDot are already the real stand-ins above.
  for (const name of names) if (!(name in primitives)) primitives[name] = glyph(name)
  return primitives
}

/**
 * Load the built bundle the way the page does.
 * @returns the plugin face it exported.
 */
async function loadFace() {
  let registration
  globalThis.window.__ModuleLoader__ = {
    load(value) {
      registration = value
    },
  }
  await import(`${pathToFileURL(BUNDLE).href}?render=${String(Date.now())}`)
  const host = (names) => (specifier) => {
    if (specifier === 'react') return React
    if (specifier === 'react/jsx-runtime') return { Fragment, jsx, jsxs }
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return makePrimitives(names)
    throw new Error(`unexpected require: ${specifier}`)
  }
  // A probe execution with an empty host, only to read the list the card
  // publishes; a factory call is a pure re-evaluation, so the real face is built
  // straight after. Restating the list here is what the first version did, and
  // adding one icon to the card broke this lane until it was synced.
  const names = registration.factory(host([])).REQUIRED_PRIMITIVES
  return registration.factory(host(names))
}

/**
 * Wire the plugin face up to a stand-in context and produce a card element.
 *
 * `get` is how the card reaches the Remote namespace, and returning `undefined`
 * from it stands in for a mount that never resolved — the failure this suite has
 * to be able to see, because in the app it is otherwise invisible.
 *
 * @param api - what the card's Remote calls should answer, or undefined.
 * @returns the card element for the Codex provider row.
 */
async function mountCard(api) {
  const face = await loadFace()
  const slots = []
  const ctx = {
    effect(callback) { callback() },
    inject() {},
    get(service) { return service === 'remote.codexAuth' ? api : undefined },
    locale: { register: () => () => {}, bind: () => (key) => key },
    slots: {
      inject(_slot, register) { register() },
      register(options, component) { slots.push({ options, component }); return () => {} },
    },
    remote: { $mount: () => Promise.resolve(async () => {}) },
  }
  face.apply(ctx)
  assert.equal(slots.length, 1, 'the card was not registered into the settings.section slot')
  return slots[0].component({})
}

/** Every mounted root, so the run can unmount them and let the process exit. */
const mounted = []

// The card polls while an attempt is running; without an explicit unmount those
// timers outlive the test file and hold the event loop open.
after(async () => {
  for (const reactRoot of mounted) {
    await act(async () => {
      reactRoot.unmount()
    })
  }
  dom.window.close()
})

/**
 * Render a node into a fresh container and return its text.
 * @param node - the React element.
 * @returns the container and a `text()` reader.
 */
async function render(node) {
  const container = document.createElement('div')
  document.body.append(container)
  const reactRoot = createRoot(container)
  mounted.push(reactRoot)
  await act(async () => {
    reactRoot.render(node)
  })
  return {
    container,
    text: () => container.textContent ?? '',
    html: () => container.innerHTML,
    buttons: () => [...container.querySelectorAll('button')],
    async click(button) {
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
    },
  }
}

/** A status the host could answer with, overridable per case. */
function status(overrides = {}) {
  return {
    ready: true,
    signedIn: false,
    accountId: null,
    planType: null,
    expiresAt: null,
    routeConfigured: true,
    flowAvailable: true,
    flowLabel: 'OpenAI Codex',
    attempt: { phase: 'idle', notice: null, prompt: null, error: null },
    ...overrides,
  }
}

/** A Remote stand-in answering `status()` and nothing else. */
function apiReturning(value) {
  return {
    status: async () => ({ ok: true, value }),
    signIn: async () => ({ ok: true, value: status().attempt }),
    answer: async () => ({ ok: true, value: status().attempt }),
    cancel: async () => ({ ok: true, value: status().attempt }),
    signOut: async () => ({ ok: true, value: status() }),
  }
}

test('the card renders a sign-in button when signed out', async () => {
  const view = await render(await mountCard(apiReturning(status())))
  const text = view.text()
  // The stand-in locale returns the message key, so these assertions name which
  // message is on screen and are independent of the wording.
  assert.match(text, /title/)
  assert.match(text, /signedOut/)
  assert.match(text, /signIn/)
  assert.match(text, /signInHint/)
  assert.equal(view.buttons().length >= 1, true)
  // The route warning is for a missing route only.
  assert.doesNotMatch(text, /routeMissing/)
})

test('the card renders a device code with a copy button while signing in', async () => {
  const view = await render(await mountCard(apiReturning(status({
    attempt: {
      phase: 'running',
      notice: { message: 'Enter this code', url: 'https://example.test/device', code: 'ABCD-EFGH' },
      prompt: null,
      error: null,
    },
  }))))
  const text = view.text()
  assert.match(text, /ABCD-EFGH/)
  // The address must be readable, not merely clickable: this is the headless
  // path, where the reader may not have a browser on this machine.
  assert.match(text, /https:\/\/example\.test\/device/)
  assert.equal(view.container.querySelector('a')?.getAttribute('href'), 'https://example.test/device')
  assert.match(text, /copyCode/)
  assert.match(text, /cancel/)
})

test('the browser-login notice opens the page, offers the link, and tells the truth', async () => {
  // pi-ai never opens a browser but its message says one should open. The card
  // opens it and must not repeat that line.
  const opened = []
  const originalOpen = dom.window.open
  dom.window.open = (url) => {
    opened.push(url)
    return null
  }
  const api = apiReturning(status())
  api.status = async () => ({
    ok: true,
    value: status({
      attempt: {
        phase: 'running',
        notice: { message: 'A browser window should open. Complete login to finish.', url: 'https://auth.example.test/authorize?x=1', code: null },
        prompt: null,
        error: null,
      },
    }),
  })
  try {
    const view = await render(await mountCard(api))
    const text = view.text()
    assert.match(text, /browserOpening/)
    // The upstream line is replaced by one that is true in this embedding.
    assert.doesNotMatch(text, /A browser window should open/)
    assert.match(text, /copyLink/)
    const link = view.container.querySelector('a')
    assert.equal(link?.getAttribute('href'), 'https://auth.example.test/authorize?x=1')
    assert.deepEqual(opened, ['https://auth.example.test/authorize?x=1'])
  } finally {
    dom.window.open = originalOpen
  }
})

test('a copy button puts the thing on the clipboard', async () => {
  const written = []
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    value: { writeText: async (value) => { written.push(value) } },
    configurable: true,
  })
  const api = apiReturning(status())
  api.status = async () => ({
    ok: true,
    value: status({
      attempt: {
        phase: 'running',
        notice: { message: 'Enter this code', url: 'https://example.test/device', code: 'ABCD-EFGH' },
        prompt: null,
        error: null,
      },
    }),
  })
  const view = await render(await mountCard(api))
  const copyButton = view.buttons().find((button) => (button.textContent ?? '').includes('copyCode'))
  assert.notEqual(copyButton, undefined)
  await view.click(copyButton)
  assert.deepEqual(written, ['ABCD-EFGH'])
})

test('a select prompt renders as choices rather than a text field', async () => {
  // This is the shape pi-ai asks first: browser login or device code. Rendering
  // it as a text field was the previous implementation's defect.
  const view = await render(await mountCard(apiReturning(status({
    attempt: {
      phase: 'running',
      notice: null,
      prompt: {
        kind: 'select',
        message: 'Select OpenAI Codex login method:',
        placeholder: null,
        options: [
          { id: 'browser', label: 'Browser login (default)', description: null },
          { id: 'device_code', label: 'Device code login (headless)', description: null },
        ],
      },
      error: null,
    },
  }))))
  const text = view.text()
  assert.match(text, /Select OpenAI Codex login method/)
  assert.match(text, /Browser login/)
  assert.match(text, /Device code login/)
  // Two choices plus cancel — and no text input anywhere.
  assert.equal(view.container.querySelectorAll('input').length, 0)
  assert.equal(view.buttons().length, 3)
})

test('choosing a login method answers the flow with that option id', async () => {
  // The flow's first question on every sign-in, and the one the previous
  // implementation answered with a free-text field instead of a choice.
  const answers = []
  const api = apiReturning(status())
  api.status = async () => ({
    ok: true,
    value: status({
      attempt: {
        phase: 'running',
        notice: null,
        prompt: {
          kind: 'select',
          message: 'Select OpenAI Codex login method:',
          placeholder: null,
          options: [
            { id: 'browser', label: 'Browser login (default)', description: null },
            { id: 'device_code', label: 'Device code login (headless)', description: null },
          ],
        },
        error: null,
      },
    }),
  })
  api.answer = async (value) => {
    answers.push(value)
    return { ok: true, value: status().attempt }
  }
  const view = await render(await mountCard(api))
  const deviceCode = view.buttons().find((button) => (button.textContent ?? '').includes('Device code login'))
  assert.notEqual(deviceCode, undefined, 'the device-code choice was not rendered as a button')
  await view.click(deviceCode)
  assert.deepEqual(answers, ['device_code'])
})

test('a text prompt renders an input and submits the typed answer', async () => {
  const answers = []
  const api = apiReturning(status())
  api.answer = async (value) => {
    answers.push(value)
    return { ok: true, value: status().attempt }
  }
  api.status = async () => ({
    ok: true,
    value: status({
      attempt: {
        phase: 'running',
        notice: null,
        prompt: { kind: 'text', message: 'Paste the code', placeholder: 'http://localhost:1455/…', options: null },
        error: null,
      },
    }),
  })
  const view = await render(await mountCard(api))
  assert.match(view.text(), /Paste the code/)
  assert.equal(view.container.querySelector('input')?.getAttribute('placeholder'), 'http://localhost:1455/…')

  const input = view.container.querySelector('input')
  assert.notEqual(input, null)
  // React tracks a controlled input's value; writing through the prototype
  // setter is what makes it see the change rather than swallow it.
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'the-code')
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
  assert.equal(input.value, 'the-code', 'the controlled input did not take the typed value')

  // The form is submitted rather than the button clicked: jsdom implements no
  // default action for a submit button, so a click would never raise `submit`.
  const form = view.container.querySelector('form')
  assert.notEqual(form, null, 'the text prompt has no form')
  await act(async () => {
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  })
  assert.deepEqual(answers, ['the-code'])
})

test('an unrecognised plan tier is formatted rather than printed raw', async () => {
  // The claim is an internal identifier — `self_serve_business_prolite` is a
  // real one, and printing it verbatim makes a working card look broken.
  const view = await render(await mountCard(apiReturning(status({
    signedIn: true,
    accountId: 'acct-012…cdef',
    planType: 'self_serve_business_prolite',
    expiresAt: Date.UTC(2026, 9, 10, 9, 4, 32),
  }))))
  const text = view.text()
  assert.match(text, /Self Serve Business Prolite/)
  assert.doesNotMatch(text, /self_serve_business_prolite/)
})

test('the card renders the signed-in facts and a sign-out control', async () => {
  const view = await render(await mountCard(apiReturning(status({
    signedIn: true,
    accountId: 'acct-012…cdef',
    planType: 'plus',
    expiresAt: Date.UTC(2026, 0, 2, 3, 4, 5),
  }))))
  const text = view.text()
  assert.match(text, /acct-012…cdef/)
  assert.match(text, /planPlus/)
  assert.match(text, /signedIn/)
  assert.doesNotMatch(text, /unknown/)
})

test('an unmounted seam and a missing route each say what to do', async () => {
  const noSeam = await render(await mountCard(apiReturning(status({ ready: false }))))
  assert.match(noSeam.text(), /seamsMissing/)

  const noFlow = await render(await mountCard(apiReturning(status({ flowAvailable: false }))))
  assert.match(noFlow.text(), /flowMissing/)

  const noRoute = await render(await mountCard(apiReturning(status({ routeConfigured: false }))))
  assert.match(noRoute.text(), /routeMissingTitle/)
  // The route notice must not disable sign-in: the login itself still works.
  assert.match(noRoute.text(), /signIn/)
})

test('a failed attempt shows the flow’s own message', async () => {
  const view = await render(await mountCard(apiReturning(status({
    attempt: { phase: 'failed', notice: null, prompt: null, error: 'Device flow timed out' },
  }))))
  assert.match(view.text(), /Device flow timed out/)
})

test('a card whose host interface never appears says so instead of staying blank', async () => {
  // Mount that never resolved. The card must reach a visible failure rather than
  // sitting on "connecting" — silence is what made the first version of this
  // plugin indistinguishable from "not installed".
  const view = await render(await mountCard(undefined))
  assert.match(view.text(), /connecting/)
  const deadline = Date.now() + 6000
  while (Date.now() < deadline && !/namespaceMissing/.test(view.text())) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
    })
  }
  assert.match(view.text(), /namespaceMissing/)
  // And no sign-in control, because there is nothing behind it.
  assert.equal(view.buttons().length, 0)
})

test('a card whose host call throws renders the failure instead of blanking', async () => {
  const api = apiReturning(status())
  api.status = async () => ({ ok: false, error: { message: 'transport down' } })
  const view = await render(await mountCard(api))
  assert.match(view.text(), /transport down/)
})

test('the section claims one cell and the card is its whole content', async () => {
  const face = await loadFace()
  const slots = []
  const ctx = {
    effect(callback) { callback() },
    inject(services, callback) {
      if (services[0] === 'remote.codexAuth') callback({ ...ctx, remote: { codexAuth: apiReturning(status()), $mount: ctx.remote.$mount } })
    },
    locale: { register: () => () => {}, bind: () => (key) => key },
    slots: {
      inject(_slot, register) { register() },
      register(options, component) { slots.push({ options, component }); return () => {} },
    },
    remote: { $mount: () => Promise.resolve(async () => {}) },
  }
  face.apply(ctx)
  const component = slots[0].component
  // No provider filter any more: the section is this plugin's own page, not a
  // cell shared with every pi-ai route.
  const element = component({})
  assert.notEqual(element, undefined)
  // Real React does not array-wrap a single child.
  const child = Array.isArray(element.props.children) ? element.props.children[0] : element.props.children
  assert.equal(child.type.name, 'CodexSignIn')
})
