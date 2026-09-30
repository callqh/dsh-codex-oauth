#!/usr/bin/env node
/**
 * Boot this plugin in a THROWAWAY profile before letting it near a real one.
 *
 * The failure this exists to prevent is not a broken card. A bundle listed in a
 * profile's `dsh.profile.bundles` is boot-required: if the loader cannot resolve
 * it, or the entry never activates, the whole application fails to start — and
 * the application's own recovery rewrites the user's patch layer, which is how
 * unrelated settings get lost. That has already happened once on this machine.
 *
 * So this script builds a profile that mirrors the one you are about to change
 * (its `cordis.patch.yml` is copied verbatim), adds this package to its bundles,
 * boots it, and asserts the four things a real boot would have to get right:
 *
 *   1. the host entry resolves and imports — i.e. the patch's `name:` spelling
 *      resolves against the installed package;
 *   2. the entry ACTIVATES (no "did not activate" in the boot audit);
 *   3. the client bundle reaches the page's module graph;
 *   4. `/api/codexAuth/status` answers `ready: true` and `flowAvailable: true`,
 *      which is the whole Remote path — descriptor, SRC host derivation,
 *      argument marshalling, and all three nested seam injects.
 *
 * It never touches the profile it mirrors, and it removes the staging profile on
 * the way out.
 *
 * Usage:
 *   node scripts/stage-verify.mjs --dsh <path to @deepseek-ai/dsh/lib/bin.js>
 *
 * A packaged Desktop keeps that payload inside `app.asar`, which Node cannot
 * import from. Extract it once:
 *
 *   npx @electron/asar extract \
 *     "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar" /tmp/dsh-asar
 *
 * Options:
 *   --dsh <path>       dsh CLI entry point (or DSH_BIN). Required.
 *   --source <name>    profile whose patch layer is mirrored. Default: desktop.
 *   --name <name>      staging profile name. Default: codex-staging.
 *   --keep             leave the staging profile in place for inspection.
 *   --timeout <ms>     how long to wait for the boot banner. Default: 120000.
 */
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir, tmpdir } from 'node:os'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Parse the flags this script understands. */
function parseArgs(argv) {
  const options = { source: 'desktop', name: 'codex-staging', keep: false, timeout: 120_000 }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (flag === '--dsh') { options.dsh = value; index += 1 } else if (flag === '--source') { options.source = value; index += 1 } else if (flag === '--name') { options.name = value; index += 1 } else if (flag === '--timeout') { options.timeout = Number(value); index += 1 } else if (flag === '--keep') { options.keep = true } else if (flag === '--help' || flag === '-h') { options.help = true } else throw new Error(`unknown argument ${JSON.stringify(flag)}`)
  }
  options.dsh ??= process.env.DSH_BIN
  return options
}

/** Print the usage block from this file's own header. */
async function usage() {
  const source = await readFile(fileURLToPath(import.meta.url), 'utf8')
  process.stdout.write(`${source.slice(source.indexOf('/**') + 3, source.indexOf('*/')).replace(/^ \* ?/gm, '').trim()}\n`)
}

/**
 * Ask the OS for a port nothing is listening on, then release it.
 * @returns the port number.
 */
async function freePort() {
  const server = createServer()
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  await new Promise((done) => server.close(done))
  return port
}

/**
 * Run a command to completion, streaming its output.
 * @param command - the executable.
 * @param args - its arguments.
 * @param options - `cwd` for the child.
 * @returns the exit code.
 */
function run(command, args, options = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.on('error', fail)
    child.on('exit', (code) => done(code ?? 1))
  })
}

/**
 * Wait for the boot banner and return its URL.
 * @param child - the spawned dsh process.
 * @param timeoutMs - how long to wait.
 * @returns the `http://127.0.0.1:<port>/?token=…` URL.
 */
function waitForBanner(child, timeoutMs) {
  return new Promise((done, fail) => {
    let buffered = ''
    const timer = setTimeout(() => fail(new Error(`no boot banner within ${String(timeoutMs)}ms\n--- output ---\n${buffered}`)), timeoutMs)
    const stop = () => {
      clearTimeout(timer)
      child.stdout.off('data', onData)
      child.stderr.off('data', onData)
    }
    const onData = (chunk) => {
      buffered += String(chunk)
      const match = /http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/.exec(buffered)
      if (match === null) return
      stop()
      done({ url: match[0], output: buffered })
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => {
      stop()
      fail(new Error(`dsh exited with ${String(code)} before booting\n--- output ---\n${buffered}`))
    })
  })
}

/**
 * Exchange the boot token for the auth cookie, then fetch the page.
 *
 * The banner URL carries a one-shot token; the request answers 303 with the
 * session cookie the rest of the conversation uses.
 * @param url - the banner URL.
 * @returns the page HTML and the cookie to carry.
 */
async function openSession(url) {
  const base = new URL(url)
  const first = await fetch(url, { redirect: 'manual' })
  const cookie = first.headers.getSetCookie?.()[0]?.split(';')[0] ?? first.headers.get('set-cookie')?.split(';')[0]
  const headers = cookie === undefined ? {} : { cookie }
  const page = await fetch(new URL('/', base), { headers })
  if (!page.ok) throw new Error(`the staging page answered HTTP ${String(page.status)}`)
  return { html: await page.text(), cookie }
}

/**
 * Call one Remote endpoint exactly as the browser carrier does.
 * @param url - the banner URL.
 * @param cookie - the session cookie from {@link openSession}.
 * @param endpoint - `<namespace>/<method>`.
 * @param args - the method's named arguments.
 * @returns the decoded result envelope.
 */
async function callRemote(url, cookie, endpoint, args = {}) {
  const base = new URL(url)
  const response = await fetch(new URL(`/api/${endpoint}`, base), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...cookie === undefined ? {} : { cookie },
    },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `stage-${String(Date.now())}`,
      method: endpoint,
      payload: { args },
    }),
  })
  if (!response.ok) throw new Error(`${endpoint} answered HTTP ${String(response.status)}`)
  const body = await response.json()
  return body.result
}

/**
 * Start a real sign-in, read the first question back, then withdraw it.
 *
 * Bounded and reversible by construction: `cancel()` is called on every path,
 * including the failure paths, and the probe gives up after a few seconds rather
 * than leaving an attempt running.
 *
 * @param url - the banner URL.
 * @param cookie - the session cookie.
 * @param check - the assertion recorder.
 */
async function signInProbe(url, cookie, check) {
  const started = await callRemote(url, cookie, 'codexAuth/signIn')
  if (started?.ok !== true) {
    check('codexAuth/signIn starts a real attempt', false, JSON.stringify(started?.error ?? null))
    return
  }
  let prompt = null
  let phase = started.value?.phase ?? null
  const deadline = Date.now() + 15_000
  try {
    while (Date.now() < deadline) {
      await new Promise((done) => setTimeout(done, 400))
      const current = await callRemote(url, cookie, 'codexAuth/status')
      phase = current?.value?.attempt?.phase ?? phase
      prompt = current?.value?.attempt?.prompt ?? null
      if (prompt !== null || phase !== 'running') break
    }
    check('codexAuth/signIn starts a real attempt', phase === 'running', String(phase))
    check('the flow\'s first question is relayed as a select', prompt?.kind === 'select', JSON.stringify(prompt))
    const ids = Array.isArray(prompt?.options) ? prompt.options.map((option) => option.id) : []
    check('the login-method choices survive the relay', ids.includes('browser') && ids.includes('device_code'), JSON.stringify(ids))
  } finally {
    // Always withdrawn: a cancelled attempt commits nothing and leaves no
    // half-finished authorization behind.
    const cancelled = await callRemote(url, cookie, 'codexAuth/cancel')
    check('withdrawing the probe attempt settles it as cancelled', cancelled?.value?.phase === 'cancelled', JSON.stringify(cancelled?.value ?? cancelled?.error ?? null))
  }
}

/**
 * Take the browser-login branch, which is the default and the more interesting
 * half: it starts pi-ai's loopback callback server and then asks a second,
 * differently-shaped question.
 *
 * Still no outbound traffic. `createAuthorizationFlow` builds the authorize URL
 * entirely from local PKCE material, and `startLocalOAuthServer` binds
 * `127.0.0.1:1455` — so what this exercises is the two things a user meets on
 * the default path and nothing that leaves the machine.
 *
 * Three things are asserted that the select probe cannot reach:
 *
 * 1. the `auth_url` notice is relayed with its URL and no code;
 * 2. the callback server really is listening — proven by its own "State
 *    mismatch" answer, which only pi-ai's server produces;
 * 3. the `manual_code` question arrives as a `text` prompt, the second of the
 *    two prompt shapes, and the one the card renders as an input;
 * 4. cancelling releases the port. A listener leaked per attempt would be a real
 *    bug and is invisible from the UI.
 *
 * @param url - the banner URL.
 * @param cookie - the session cookie.
 * @param check - the assertion recorder.
 */
async function browserLoginProbe(url, cookie, check) {
  const started = await callRemote(url, cookie, 'codexAuth/signIn')
  if (started?.ok !== true) {
    check('the browser branch starts', false, JSON.stringify(started?.error ?? null))
    return
  }
  let notice = null
  let prompt = null
  const deadline = Date.now() + 20_000
  try {
    // Wait for the first question, then answer it.
    while (Date.now() < deadline) {
      await new Promise((done) => setTimeout(done, 300))
      const current = await callRemote(url, cookie, 'codexAuth/status')
      if (current?.value?.attempt?.prompt?.kind === 'select') break
    }
    const answered = await callRemote(url, cookie, 'codexAuth/answer', { value: 'browser' })
    check('answering the login-method question is accepted', answered?.ok === true, JSON.stringify(answered?.error ?? null))

    while (Date.now() < deadline) {
      await new Promise((done) => setTimeout(done, 300))
      const current = await callRemote(url, cookie, 'codexAuth/status')
      const attempt = current?.value?.attempt ?? {}
      notice = attempt.notice ?? notice
      prompt = attempt.prompt ?? prompt
      if (prompt !== null || attempt.phase !== 'running') break
    }

    check(
      'the authorize URL is relayed as a notice with no code',
      typeof notice?.url === 'string' && notice.url.startsWith('https://auth.openai.com/oauth/authorize') && notice.code === null,
      JSON.stringify(notice),
    )
    check(
      'the follow-up question arrives as a text prompt',
      prompt?.kind === 'text' && /authorization code|redirect URL/i.test(prompt.message ?? ''),
      JSON.stringify(prompt),
    )

    // The server's own answer, which is what distinguishes it from a squatter.
    let callbackStatus = null
    let callbackBody = ''
    try {
      const response = await fetch('http://127.0.0.1:1455/auth/callback?state=not-our-state')
      callbackStatus = response.status
      callbackBody = await response.text()
    } catch (error) {
      callbackBody = String(error)
    }
    check(
      'the loopback callback server is listening',
      callbackStatus === 400 && callbackBody.includes('State mismatch'),
      `HTTP ${String(callbackStatus)} ${callbackBody.slice(0, 80)}`,
    )
  } finally {
    const cancelled = await callRemote(url, cookie, 'codexAuth/cancel')
    check('the browser-branch attempt is withdrawn', cancelled?.value?.phase === 'cancelled', JSON.stringify(cancelled?.value ?? cancelled?.error ?? null))
    await new Promise((done) => setTimeout(done, 700))
    let released = false
    try {
      await fetch('http://127.0.0.1:1455/auth/callback?state=not-our-state')
    } catch {
      released = true
    }
    check('cancelling releases the callback port', released, 'the loopback port is still answering')
  }
}

const options = parseArgs(process.argv.slice(2))
if (options.help === true) {
  await usage()
  process.exit(0)
}
if (typeof options.dsh !== 'string' || options.dsh.length === 0) {
  process.stderr.write('stage-verify: --dsh <path to @deepseek-ai/dsh/lib/bin.js> is required (see the header)\n')
  process.exit(2)
}

// Two homes, on purpose. The SOURCE home is read and never written — it is the
// profile whose composition is being mirrored. The STAGE home is a fresh
// temporary directory the booted process gets as its own `DSH_HOME`, so a smoke
// run cannot leave a session, a storage document or a credential behind in the
// home the user actually uses. Before this split the tool booted against the
// real home and cleaned up only the profile directory, which made its central
// promise — "it never touches your profile" — true and incomplete at once.
const sourceHome = options.sourceHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh')
const sourceDir = join(sourceHome, 'profiles', options.source)
const stageHome = await mkdtemp(join(tmpdir(), 'dsh-stage-verify-'))
const stageDir = join(stageHome, 'profiles', options.name)
const failures = []

/** Record one assertion. */
function check(label, ok, detail) {
  process.stdout.write(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || detail === undefined ? '' : ` — ${detail}`}\n`)
  if (!ok) failures.push(label)
}

process.stdout.write(`stage-verify: mirroring profile ${JSON.stringify(options.source)} from ${sourceHome}\n`)
process.stdout.write(`stage-verify: staging in ${stageHome}\n`)
const sourcePatch = await readFile(join(sourceDir, 'cordis.patch.yml'), 'utf8')
// The bundle's own patch supplies the row, so a profile that lists the bundle
// needs no insert of its own. A profile that carries an explicit row WOULD get
// the insert twice, and the loader rejects that.
if (/^\s*-\s*id:\s*codex-oauth\s*$/m.test(sourcePatch)) {
  process.stderr.write(`stage-verify: ${JSON.stringify(options.source)} already inserts the codex-oauth row; mirror a profile that does not\n`)
  process.exit(2)
}

await mkdir(stageDir, { recursive: true })
await cp(join(sourceDir, 'pnpm-workspace.yaml'), join(stageDir, 'pnpm-workspace.yaml'))
await writeFile(join(stageDir, 'cordis.yml'), '# staging profile; the tree is composed as patches\n[]\n')
await writeFile(join(stageDir, 'package.json'), `${JSON.stringify({
  name: `dsh-profile-${options.name}`,
  private: true,
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-codex-oauth'] } },
  dependencies: { 'dsh-codex-oauth': `link:${root}` },
}, null, 2)}\n`)
// The route the card needs is part of the mirror too: without it the probe
// reports `routeConfigured: false` and the sign-in would not make Codex usable.
const patch = sourcePatch.trimEnd().includes('id: llm-pi-ai')
  ? sourcePatch
  : `${sourcePatch.trimEnd()}\n- id: llm-pi-ai\n  name: "@deepseek-ai/dsh-llm-pi-ai"\n  config:\n    providers:\n      openai-codex: {}\n`
await writeFile(join(stageDir, 'cordis.patch.yml'), patch)

process.stdout.write('stage-verify: installing the staging profile\n')
const installed = await run('pnpm', ['install'], { cwd: stageDir })
if (installed !== 0) {
  process.stderr.write('stage-verify: pnpm install failed\n')
  process.exit(1)
}

const port = await freePort()
process.stdout.write(`stage-verify: booting ${JSON.stringify(options.name)} on port ${String(port)}\n`)
const child = spawn(process.execPath, [options.dsh, '--profile', options.name, '--no-open', '--port', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, DSH_HOME: stageHome },
})

let url
try {
  const banner = await waitForBanner(child, options.timeout)
  url = banner.url
  check('the profile boots with this bundle in it', true)
  // The audit line is what the launcher prints for an entry that never
  // activated; its absence is the assertion.
  const audit = /did not activate|: failed\b/.exec(banner.output)
  check('no entry failed to activate', audit === null, audit?.[0])

  const session = await openSession(url)
  const row = /\{"id":"dsh-codex-oauth"[^}]*\}/.exec(session.html)?.[0]
  check('the client bundle is in the page module graph', row !== undefined, 'no graph row for dsh-codex-oauth')

  const status = await callRemote(url, session.cookie, 'codexAuth/status')
  check('codexAuth/status answers', status?.ok === true, JSON.stringify(status?.error ?? null))
  const value = status?.value ?? {}
  check('the one host call reports ready', value.ready === true, JSON.stringify(value))
  check('the llm-pi-ai flow is registered for openai-codex', value.flowAvailable === true, JSON.stringify(value))
  check('the profile declares the codex route', value.routeConfigured === true, JSON.stringify(value))

  // The one method with an argument: this is what proves the wire field the
  // client declares matches the host method's own parameter name.
  const answered = await callRemote(url, session.cookie, 'codexAuth/answer', { value: 'browser' })
  check(
    'codexAuth/answer reaches the host method with its argument',
    answered?.ok === false && /没有等待回答的问题/.test(answered?.error?.message ?? ''),
    JSON.stringify(answered?.error ?? answered?.value ?? null),
  )

  // The route as the MODELS page sees it. The card no longer lives in a
  // provider row, but the row still has to exist and be addressable, because it
  // is what makes the route configurable — and a route the page cannot show is
  // a route the user cannot fix.
  const directory = await callRemote(url, session.cookie, 'llm/listConfigurableProviders')
  const codexRow = Array.isArray(directory?.value)
    ? directory.value.find((entry) => entry?.provider === 'openai-codex')
    : undefined
  check('the Models page lists the openai-codex row', codexRow !== undefined, JSON.stringify(directory?.value ?? directory?.error ?? null))
  check(
    'the row is addressable in the profile config',
    Array.isArray(codexRow?.settingsPath)
      && codexRow.settingsPath.join('.') === 'providers.openai-codex'
      && codexRow.settingsNs === 'llm-pi-ai',
    `settingsNs=${JSON.stringify(codexRow?.settingsNs)} path=${JSON.stringify(codexRow?.settingsPath)}`,
  )

  // The prompt relay, against the REAL flow.
  //
  // pi-ai's `openaiCodexOAuth.login()` asks which login method to use before it
  // does anything else, so starting a sign-in and withdrawing it at that first
  // question makes no network call and commits no credential — while exercising
  // the one interaction a user cannot avoid and the one the previous
  // implementation got wrong (it rendered this choice as a free-text field).
  await signInProbe(url, session.cookie, check)
  await browserLoginProbe(url, session.cookie, check)
} finally {
  child.kill('SIGTERM')
  await new Promise((done) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); done() }, 5000)
    child.on('exit', () => { clearTimeout(timer); done() })
  })
  // A failed run keeps its home: the state that produced the failure is the
  // evidence, and deleting it would delete the only copy.
  if (options.keep === true || failures.length > 0) {
    process.stdout.write(`stage-verify: kept ${stageHome}\n`)
  } else {
    await rm(stageHome, { recursive: true, force: true })
  }
}

if (failures.length > 0) {
  process.stderr.write(`\nstage-verify: ${String(failures.length)} check(s) failed: ${failures.join(', ')}\n`)
  process.exit(1)
}
process.stdout.write('\nstage-verify: this build installs and activates cleanly\n')
