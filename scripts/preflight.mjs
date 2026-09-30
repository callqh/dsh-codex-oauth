#!/usr/bin/env node
/**
 * Preflight: everything that has to be true before this package is allowed
 * near a profile.
 *
 * The failure this exists to prevent is not a broken card — it is a broken
 * application. This package installs into `dsh.profile.bundles`, where an
 * entry the loader cannot import or activate fails the whole boot, and the
 * recovery path rewrites the user's own patch layer. So the checks below are
 * about IMPORTABILITY and SHAPE, not about behaviour: a wrong `name` in the
 * patch, a client bundle that reaches for a module the page cannot answer, or
 * a `require()` outside the platform's seed table are all boot failures, and
 * all of them are cheap to catch here.
 *
 * Run with `npm run check`, or on its own once `lib/` and `client/` are built.
 */
import { readFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Shapes that only ever appear in a path from the machine that ran the build:
 * a POSIX home directory, a macOS private temp dir, or a Windows drive path.
 */
const HOST_PATH_PATTERNS = [
  /\/(?:Users|home)\/[A-Za-z0-9._-]+\//,
  /\/private\/var\/folders\//,
  /[A-Za-z]:\\+[Uu]sers\\/,
  /\/tmp\/dsh-[a-z-]+/,
]

/**
 * The page's platform seed table, read from the web frontend's boot code on
 * 0.2.0-rc.2 (`staticModules`). These are the only specifiers a plugin bundle
 * may leave external; everything else it imports has to be inlined by tsdown.
 */
const PLATFORM_SEED = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

/**
 * Resolve the installed version of each named package.
 * @param names - the package names to look up.
 * @returns name to version, omitting anything that does not resolve.
 */
async function resolvedVersions(names) {
  const found = new Map()
  for (const name of names) {
    try {
      const manifest = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8'))
      if (typeof manifest.version === 'string') found.set(name, manifest.version)
    } catch {
      // Absent is reported as "does not admit", which is the useful failure.
    }
  }
  return found
}

/**
 * Whether one semver range admits a version.
 *
 * Hand-rolled on purpose: pulling a full semver implementation into a preflight
 * would be a dependency for one assertion. It implements exactly the parts the
 * declarations use — `||`, whitespace-separated comparators, `>= <= > <`, `^`,
 * and precedence including prereleases — and it implements them strictly,
 * because the prerelease rule is the one that bites: numeric identifiers sort
 * below alphanumeric ones, and a prerelease only satisfies a range when a
 * comparator on its own tuple carries a prerelease tag.
 *
 * @param range - the declared range.
 * @param version - the version to test.
 * @returns whether the range admits it.
 */
function admits(range, version) {
  return range.split('||').some((branch) => branch
    .trim()
    .split(/\s+/)
    .filter((comparator) => comparator.length > 0)
    .every((comparator) => satisfies(comparator, version)))
}

/**
 * Whether one comparator admits a version.
 * @param comparator - `>=x`, `<=x`, `>x`, `<x`, `^x`, or an exact version.
 * @param version - the version to test.
 * @returns whether it holds.
 */
function satisfies(comparator, version) {
  if (comparator.startsWith('>=')) return compareVersions(version, comparator.slice(2)) >= 0
  if (comparator.startsWith('<=')) return compareVersions(version, comparator.slice(2)) <= 0
  if (comparator.startsWith('>')) return compareVersions(version, comparator.slice(1)) > 0
  if (comparator.startsWith('<')) return compareVersions(version, comparator.slice(1)) < 0
  if (comparator.startsWith('^')) {
    const floor = comparator.slice(1)
    if (compareVersions(version, floor) < 0) return false
    const [major = '0', minor = '0', patch = '0'] = floor.split('-')[0].split('.')
    // Caret pins the leftmost non-zero field: ^1.2.3 < 2, ^0.2.3 < 0.3, ^0.0.3 < 0.0.4.
    if (major !== '0') return version.split('.')[0] === major
    if (minor !== '0') return version.startsWith(`0.${minor}.`)
    return version.startsWith(`0.0.${patch}`)
  }
  return compareVersions(version, comparator) === 0
}

/**
 * Compare two versions by semver precedence.
 * @param left - the left version.
 * @param right - the right version.
 * @returns a negative number, zero, or a positive number.
 */
function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  for (const field of ['major', 'minor', 'patch']) {
    if (a[field] !== b[field]) return a[field] < b[field] ? -1 : 1
  }
  if (a.pre.length === 0 && b.pre.length === 0) return 0
  // A release outranks its own prerelease: 0.2.0 > 0.2.0-rc.2.
  if (a.pre.length === 0) return 1
  if (b.pre.length === 0) return -1
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index += 1) {
    const x = a.pre[index]
    const y = b.pre[index]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xNumeric = /^\d+$/.test(x)
    const yNumeric = /^\d+$/.test(y)
    if (xNumeric && yNumeric) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1
      continue
    }
    // Numeric identifiers always have lower precedence than alphanumeric ones.
    if (xNumeric) return -1
    if (yNumeric) return 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/**
 * Split a version into its comparable parts.
 * @param text - the version.
 * @returns numeric core fields and prerelease identifiers.
 */
function parseVersion(text) {
  const [core = '0.0.0', pre = ''] = text.split('-', 2)
  const [major = 0, minor = 0, patch = 0] = core.split('.').map((part) => Number.parseInt(part, 10) || 0)
  return { major, minor, patch, pre: pre === '' ? [] : pre.split('.') }
}

const failures = []
const notes = []

/** Record a check's outcome, and fail the run when it did not hold. */
function check(label, ok, detail) {
  if (ok) {
    notes.push(`  ok   ${label}`)
    return
  }
  failures.push(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

/** Read and parse one JSON file under the package root. */
async function readJson(relative) {
  return JSON.parse(await readFile(join(root, relative), 'utf8'))
}

/** Whether a path exists and is a regular file. */
async function isFile(relative) {
  try {
    return (await stat(join(root, relative))).isFile()
  } catch {
    return false
  }
}

const pkg = await readJson('package.json')

// ---------------------------------------------------------------- manifest --
check('dsh.bundle.patch names the patch file', pkg.dsh?.bundle?.patch === './cordis.patch.yml', pkg.dsh?.bundle?.patch)
check('dsh.client.platform is web', pkg.dsh?.client?.platform === 'web', pkg.dsh?.client?.platform)
check('exports["./client"] points at the bundle', pkg.exports?.['./client'] === './client/client.js', pkg.exports?.['./client'])
check('exports["."] default points at lib/index.js', pkg.exports?.['.']?.default === './lib/index.js', pkg.exports?.['.']?.default)
check('main points at lib/index.js', pkg.main === 'lib/index.js', pkg.main)

// The version gate reads peerDependencies, and a range the running line does
// not satisfy is an install rejection — which is how the community plugin this
// one replaces was refused on 0.2.0-rc.2. Each peer is tested against the
// version actually resolved on this machine, so the declaration and reality
// cannot drift apart.
//
// The `||` branches are not decoration. node-semver only lets a prerelease
// satisfy a range when some comparator in that range shares its exact
// major.minor.patch tuple AND carries a prerelease tag itself, so a broad-looking
// `>=0.2.0-rc.2` silently excludes every later line's `-rc`. See the note in
// README.md.
const runtimeVersions = await resolvedVersions([
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-typert-protocol',
])
for (const [dependency, range] of Object.entries(pkg.peerDependencies ?? {})) {
  const version = dependency === '@deepseek-ai/cordis'
    ? runtimeVersions.get('@deepseek-ai/cordis')
    : runtimeVersions.get('@deepseek-ai/dsh-typert-protocol')
  check(
    `peer ${dependency} admits the resolved ${String(version)}`,
    typeof version === 'string' && admits(range, version),
    `${String(range)} vs ${String(version)}`,
  )
}

// ------------------------------------------------------------------- patch --
const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
const rows = [...patch.matchAll(/^\s*-\s*id:\s*(\S+)\s*\n\s*name:\s*(\S+)\s*$/gm)]
  .map((match) => ({ id: match[1], name: match[2] }))
check('the patch inserts exactly one row', rows.length === 1, `found ${String(rows.length)}`)
const row = rows[0]
check('the patch row id is codex-oauth', row?.id === 'codex-oauth', row?.id)
// A bare package name resolves from the loader's own location inside app.asar
// on this packaged Desktop build and fails to import; a `./` specifier is
// resolved against this patch file's directory instead. See the patch's own
// comment, and VERIFICATION.md for the four spellings that were measured.
check('the patch row names a relative built entry', row?.name === './lib/index.js', row?.name)

// -------------------------------------------------------------- host entry --
check('lib/index.js exists', await isFile('lib/index.js'))
if (await isFile('lib/index.js')) {
  const module = await import(pathToFileURL(join(root, 'lib/index.js')).href)
  const exported = module.default
  check('the host entry default-exports a class', typeof exported === 'function' && /^class\s/.test(Function.prototype.toString.call(exported)), typeof exported)
  // A `static inject` here would gate activation on services that a modest
  // composition might not mount, and an entry that never activates fails the
  // boot. The seams are injected inside the constructor instead.
  check('the host entry declares no static inject', exported?.inject === undefined, JSON.stringify(exported?.inject))
  // Importing must not require any @deepseek-ai package to be resolvable from
  // the PROFILE: the linked checkout keeps its own node_modules. Resolving a
  // real instance here proves the chain loads.
  const require = createRequire(join(root, 'lib/index.js'))
  for (const id of ['@deepseek-ai/dsh-authorization', '@deepseek-ai/dsh-credentials', '@deepseek-ai/dsh-typert-protocol']) {
    let resolved = false
    try {
      resolved = require.resolve(id).length > 0
    } catch {
      resolved = false
    }
    check(`runtime dependency ${id} resolves`, resolved)
  }
}

// ------------------------------------------------------------ client bundle --
const CLIENT = 'client/client.js'
check(`${CLIENT} exists`, await isFile(CLIENT))
if (await isFile(CLIENT)) {
  const bundle = await readFile(join(root, CLIENT), 'utf8')
  check(
    'the bundle registers itself through the page module loader',
    /^window\.__ModuleLoader__\.load\(\{[\s\S]{0,40}id:\s*"dsh-codex-oauth"/.test(bundle),
    bundle.slice(0, 80).replace(/\n/g, '⏎'),
  )
  check('the factory returns a CommonJS face', bundle.includes('return module.exports;'))
  check('the bundle exports apply/inject/name', /exports\.apply = apply/.test(bundle) && /exports\.inject = inject/.test(bundle) && /exports\.name = name/.test(bundle))

  // Every specifier the factory reaches for has to be answered by the page's
  // module table. Anything else — including this package's own dependencies —
  // is a `require()` that throws on first render.
  const required = new Set([...bundle.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1]))
  const outside = [...required].filter((spec) => !PLATFORM_SEED.has(spec))
  check('every client require is a platform seed word', outside.length === 0, outside.join(', '))

  // A CSS module that failed to compile leaves the class map empty and the
  // card unstyled; the inlined tag is what proves the plugin ran.
  check('the stylesheet is inlined into the bundle', bundle.includes('data-plugin-css'))
}

// ------------------------------------------------------- published artifacts --
// Both artifacts are committed and therefore published, so a path from the
// machine that built them is a leak AND a reproducibility bug: the same source
// produces a different bundle on every developer's checkout. This caught a real
// one — rolldown writes a module's id into a `//#region` comment, and the CSS
// virtual id used to be an absolute path.
const BUILD_OUTPUTS = [CLIENT, 'lib/index.js', 'lib/service.js', 'lib/flow.js', 'lib/route.js', 'lib/wire.js']
for (const relativePath of BUILD_OUTPUTS) {
  if (!(await isFile(relativePath))) continue
  const text = await readFile(join(root, relativePath), 'utf8')
  const found = HOST_PATH_PATTERNS.map((pattern) => pattern.exec(text)?.[0]).filter(Boolean)
  check(`${relativePath} carries no build-machine path`, found.length === 0, found.join(', '))
}

// ------------------------------------------------------------------ report --
process.stdout.write(`${[...notes, ...failures].join('\n')}\n`)
if (failures.length > 0) {
  process.stderr.write(`\npreflight: ${String(failures.length)} check(s) failed\n`)
  process.exit(1)
}
process.stdout.write('\npreflight: all checks passed\n')
