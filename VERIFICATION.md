# VERIFICATION

Target runtime: **the local DeepSeek Harness `0.2.0-rc.2` Desktop, profile `desktop`.**
Nothing here aims at any other version.

The list is split by who can do it. Everything in part 1 was run and is
reproducible. Part 2 needs a human and a real ChatGPT account, and is the only
thing standing between this build and "done".

---

## 1. Done, on this machine

Reproduce everything below with:

```bash
cd <this checkout>
npm run check && npm test
node scripts/stage-verify.mjs --dsh /tmp/dsh-asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js
```

### 1.1 Build and static checks — `npm run check`

```
ok   dsh.bundle.patch names the patch file
ok   dsh.client.platform is web
ok   exports["./client"] points at the bundle
ok   exports["."] default points at lib/index.js
ok   main points at lib/index.js
ok   peer @deepseek-ai/cordis admits the pinned ^4.0.4
ok   peer @deepseek-ai/dsh-authorization admits the pinned 0.2.0-rc.2
ok   peer @deepseek-ai/dsh-credentials admits the pinned 0.2.0-rc.2
ok   peer @deepseek-ai/dsh-typert-protocol admits the pinned 0.2.0-rc.2
ok   the patch inserts exactly one row
ok   the patch row id is codex-oauth
ok   the patch row names a relative built entry
ok   lib/index.js exists
ok   the host entry default-exports a class
ok   the host entry declares no static inject
ok   runtime dependency @deepseek-ai/dsh-authorization resolves
ok   runtime dependency @deepseek-ai/dsh-credentials resolves
ok   runtime dependency @deepseek-ai/dsh-typert-protocol resolves
ok   client/client.js exists
ok   the bundle registers itself through the page module loader
ok   the factory returns a CommonJS face
ok   the bundle exports apply/inject/name
ok   every client require is a platform seed word
ok   the stylesheet is inlined into the bundle
preflight: all checks passed
```

`@deepseek-ai/dsh-llm` and `@deepseek-ai/dsh-invariants` are declared as runtime
**dependencies**, not peers, because `dsh-authorization`'s own import graph
reaches them: with `autoInstallPeers: false` a missing one is an
`ERR_MODULE_NOT_FOUND` at plugin import — i.e. a failed boot.

### 1.2 Tests — `npm test` (43 cases, five lanes)

- `tests/flow.test.mjs` — the grant projection: an absent record, an api-key
  record, a grant with no access token, a real pi-ai grant, a missing plan claim,
  a non-JWT access token, a non-numeric expiry, and account masking.
- `tests/host.test.mjs` — the service against stand-in seams in a real Cordis
  context: the five Remote markers, **every method driven through the traceable
  proxy `ctx.get()` returns**, seam readiness, an unmounted seam, the route probe
  (declared / missing / unreadable), notice and prompt relay, the second-sign-in
  case, answering with nothing pending, cancel, a flow failure, sign-out, and
  unload withdrawing a running attempt.
- `tests/client.test.mjs` — the built bundle loaded through a stand-in
  `window.__ModuleLoader__`: the five descriptors and their wire names, the keyed
  slot registration (`settings.models.provider-card`, key `llm-pi-ai`), the Codex
  row filter, and the missing-primitive gate.
- `tests/descriptors.test.mjs` — the Remote descriptors against the **real**
  `@deepseek-ai/dsh-typert-registry` browser bundle, mounted on a real Cordis
  context, so `ctx.typert.remotes.register` is the exact function the page calls.
  This lane exists because of a real failure: the first version declared every
  codec as `{ mode: 'strict' }`, which satisfies the gateway and is what the
  gateway's own docs describe, and which the reflection registry additionally
  requires to carry a `typeSymbol` and a `create()` factory. The throw happened
  inside `$mount`, the plugin caught it and logged a warning, and the user got a
  plugin that loaded, activated, claimed its seat correctly — and showed nothing.
  The lane does not restate the rules; it runs them.
- `tests/render.test.mjs` — the card **actually rendered**: jsdom, real React,
  real `react-dom`, and the real committed bundle. Twelve states and
  interactions —
  signed out, device code with copy, the browser-login notice (which must open
  the page and must NOT repeat upstream's false claim), the clipboard, the
  login-method choice, a typed answer reaching the host, signed in, an unmounted
  seam, a missing route (which must not disable sign-in), a failed flow, a
  throwing host call, and a non-Codex row rendering nothing.

  The host's atoms are stubbed with plain elements here, deliberately: the
  published primitives package statically pulls in shiki, katex and CSS Modules,
  which only resolve inside the page's bundler. What is under test is this
  plugin's component, and the gate around a host missing an atom is covered in
  the previous lane.

  Three real defects were found by this lane and fixed:
  - a `text`/`secret` prompt rendered a bare input with the question carried only
    on `aria-label`, so a sighted user saw a field with no idea what to type;
  - a device-code notice rendered its address only as a link's `href`. Device
    code is what the flow offers when the browser is somewhere else, so the
    address has to be readable text;
  - the browser-login notice repeated pi-ai's line *"A browser window should
    open. Complete login to finish."* Nothing in the harness opens one — that
    text is written for the Codex CLI, which does. The card opens the tab itself
    (once per URL, best effort), offers a copy-link beside the link, and says
    what to do if the tab did not open. The substitute is deliberate and is
    commented at the call site.

  It also cost two harness lessons worth keeping: React must be imported *after*
  the jsdom globals exist (a copy loaded earlier renders but never wires its
  event system, so `onChange`/`onSubmit` silently never fire), and jsdom
  implements no default action for a submit button, so the form has to be
  submitted directly.

### 1.3 Staging boot — `scripts/stage-verify.mjs`

A throwaway profile is built from the **real `desktop` profile's patch layer**,
given this bundle, and booted:

```
stage-verify: mirroring profile "desktop" from <DSH_HOME>
stage-verify: staging in /var/folders/…/dsh-stage-verify-XXXXXX
stage-verify: booting "codex-staging" on port 53262
  ok   the profile boots with this bundle in it
  ok   no entry failed to activate
  ok   the client bundle is in the page module graph
  ok   codexAuth/status answers
  ok   the one host call reports ready
  ok   the llm-pi-ai flow is registered for openai-codex
  ok   the profile declares the codex route
  ok   codexAuth/answer reaches the host method with its argument
  ok   codexAuth/signIn starts a real attempt
  ok   the flow's first question is relayed as a select
  ok   the login-method choices survive the relay
  ok   withdrawing the probe attempt settles it as cancelled
  ok   answering the login-method question is accepted
  ok   the authorize URL is relayed as a notice with no code
  ok   the follow-up question arrives as a text prompt
  ok   the loopback callback server is listening
  ok   the browser-branch attempt is withdrawn
  ok   cancelling releases the callback port
stage-verify: this build installs and activates cleanly
```

It boots with its **own `DSH_HOME`**, a fresh temporary directory, and mirrors
the profile it is told to mirror from the real one read-only. Before that split
the tool booted against the real home: it cleaned up the profile directory but
still wrote a session, a storage document and (on a signed-in run) a credential
there. The central promise — *it never touches your profile* — was true and
incomplete at the same time. A failed run now keeps its home and prints the path,
because the state that produced the failure is the evidence.

The last ten checks drive a **real** sign-in against the **real** flow, both
branches of it, and withdraw each one. That is safe by construction: everything
before the human acts is local. `openaiCodexOAuth.login()` asks which login
method you want before it does anything else; `createAuthorizationFlow()` builds
the authorize URL from locally generated PKCE and a locally generated state; and
the browser branch's callback server binds `127.0.0.1:1455`. **No request leaves
the machine** on either branch, and the device-code branch — the one that would
make a real request to `auth.openai.com` — is deliberately not driven.

What the probes buy is the whole interaction up to the point a human has to click
something:

- the first question reaches the wire as `kind: 'select'`, with the option ids
  `browser` and `device_code` intact — the shape the previous implementation
  rendered as a free-text field;
- answering it is accepted, and the browser branch then relays its authorize URL
  as a `url` notice with no `code`;
- the follow-up question arrives as a `kind: 'text'` prompt — the second of the
  two prompt shapes the card has to render, and otherwise untouched until a real
  login reaches it;
- the loopback callback server is genuinely listening, proven by its own
  `State mismatch` answer rather than by the port merely being open;
- cancelling settles the attempt as `cancelled` **and releases the port**. A
  listener leaked per attempt would be invisible from the UI and would break the
  second sign-in in the same session.

`codexAuth/status` answered, verbatim:

```json
{"ready":true,"signedIn":false,"accountId":null,"planType":null,"expiresAt":null,
 "routeConfigured":true,"flowAvailable":true,"flowLabel":"OpenAI Codex",
 "attempt":{"phase":"idle","notice":null,"prompt":null,"error":null}}
```

`flowLabel: "OpenAI Codex"` is read out of the flow `llm-pi-ai` registered — it is
not a string this plugin contains. Its presence is the proof that the plugin and
the built-in flow are talking about the same key.

The composed tree resolves the patch row to a real URL, which is what the
`./lib/index.js` spelling exists for:

```
# == dsh-codex-oauth
- id: codex-oauth
  name: >-
    file://<DSH_HOME>/profiles/<profile>/node_modules/dsh-codex-oauth/lib/index.js
```

### 1.4 Installed into `desktop`

- `~/.dsh/profiles/<profile>/package.json` — `dsh.profile.bundles` gained
  `dsh-codex-oauth`; the `link:` dependency was repointed at this directory.
- `~/.dsh/profiles/<profile>/cordis.patch.yml` — gained the `llm-pi-ai` row with a
  **keyless** `providers: { openai-codex: {} }`.
- Both files were backed up beside themselves as `*.bak-<epoch-ms>` before the
  edit.

**The application has not been restarted**, so this edit is not yet live. A
profile's `bundles` is composed at process start.

---

## 2. Needs a human

### 2.0 Restart, then look

- [ ] Quit and reopen DeepSeek Harness (a profile edit is not hot-reloadable).
- [ ] It starts normally — no "application failed to start" dialog. If it does
      not start, see §3.
- [ ] Settings → **Models** → the `openai-codex` row now carries the Codex card.

### 2.1 The card (INTENT criteria 1, 2, 6)

- [ ] The card shows **Not signed in**.
- [ ] It does **not** show the red "route is not declared" notice.
- [ ] Clicking **Sign in with ChatGPT** immediately shows the flow's first
      question — *Select OpenAI Codex login method* — as two buttons. No page
      refresh is needed.
- [ ] Choosing **Browser login** opens a browser and shows the authorization
      page; choosing **Device code login** shows a `XXXX-XXXX` code with a copy
      button and the verification URL.
- [ ] Completing the browser step flips the card to **Signed in** within about a
      second, showing a masked account, a plan tier, and an expiry — with no page
      refresh.
- [ ] DevTools → Network: the `/api` responses contain no `access`, `refresh`, or
      full account id. DevTools → Application: no token in storage.
- [ ] Cancelling mid-flow returns the card to Not signed in.

### 2.2 A real request (INTENT criterion 3 — the deciding one)

- [ ] In the model picker, choose a Codex model (provider `openai-codex`).
- [ ] Send a message and **get a normal reply** — not 401/403, not "route is not
      authenticated".
- [ ] Send a second one, to rule out a one-off.

Installation succeeding, the card rendering, and `status()` answering are all
necessary conditions. **This is the one that decides.**

### 2.3 Refresh and sign-out (INTENT criteria 4, 5)

- [ ] After a Harness restart, a Codex request still succeeds (proxy evidence for
      refresh; a real wait for expiry is too slow to be practical, and must be
      labelled as proxy evidence if used).
- [ ] **Sign out** on the card returns it to Not signed in.
- [ ] A Codex request afterwards fails as unauthenticated rather than succeeding.
- [ ] The `llm-pi-ai/openai-codex` credential record is gone (check via the
      credentials surface — do not print token material).

### 2.4 Regression

- [ ] No other profile is touched: it has no codex rows.
- [ ] `~/.dsh/profiles/<profile>/cordis.patch.yml` differs from the backup only by
      the `llm-pi-ai` row; `package.json` only by the bundle line and the link.
- [ ] Light and dark themes both render the card legibly.
- [ ] No `slot entry crashed` in the browser console.

---

## 3. Rollback

If the application will not start after the restart, the bundle is the cause —
an unimportable bundle in `dsh.profile.bundles` fails the whole boot.

**From the dialog.** The failure dialog offers "disable third-party plugins,
back up the profile patch and restart". That restores the default bundles.

⚠️ That recovery rewrites `cordis.patch.yml` from the entries the running
instance had loaded, so rows that never loaded are lost. It writes a
`cordis.patch.yml.bak-<epoch-ms>` first — merge by id (backup as the base, keep
the newer UI values from the current file) rather than overwriting.

**By hand, which is surgical.** Edit `~/.dsh/profiles/<profile>/package.json` and
drop `"dsh-codex-oauth"` from `dsh.dsh.profile.bundles`. Leave the `link:`
dependency (harmless). Restart. Also available:

```
~/.dsh/profiles/<profile>/package.json.bak-<epoch-ms>
~/.dsh/profiles/<profile>/cordis.patch.yml.bak-<epoch-ms>
```

---

## 4. Known limits and open assumptions

1. **Upstream identifiers.** The flow key `llm-pi-ai/openai-codex`, the `oauth`
   method id, and pi-ai's grant shape are not public contracts. A change affects
   sign-in only; an already signed-in record keeps working, because the request
   path reads the payload through pi-ai.
2. **The card's seat is keyed.** It registers under `llm-pi-ai`, the loader entry
   id the bundled base composition declares, because that is the key the Models
   page passes down. A profile that renames that row loses the card.
3. **The device-code endpoints and `client_id`** belong to the official Codex CLI.
   Availability is upstream's.
4. **Shared OAuth session with the Codex CLI**, as above.
5. **The client descriptors are hand-written.** The Typert compiler is not
   present in this deployment, so `remote.$mount` is given descriptors and the
   host reflects the real contract from the Service signatures. The client gate
   only asserts `mode: 'strict'` markers on parameters; a future release that
   genuinely validates schemas would need generated descriptors instead. The
   symptom would be the card disappearing, and `scripts/stage-verify.mjs` is what
   catches it.
6. **Cordis hands a service to its caller through a traceable Proxy.** A
   `#private` field is unreachable through it and a plain field assignment lands
   on the proxy, not the service. This build uses readonly containers whose
   contents are mutated; `tests/host.test.mjs` drives every Remote method through
   `ctx.get()` so a regression here fails in CI rather than at boot.
7. **An attempt does not survive a reload.** Refreshing the page drops a sign-in
   in flight — a limitation of driving a request/response surface.
8. **The browser bundle must find own properties on the host module table.**
   tsdown wraps each external in `__toESM`, which copies own enumerable keys into
   a fresh namespace object. A stand-in that answers lazily — a `Proxy` with only
   a `get` trap — therefore hands the card `undefined`, because `ownKeys`
   forwards to an empty target. Test stand-ins must materialise the names, which
   is why both client lanes read the list the bundle publishes instead of
   restating it.
