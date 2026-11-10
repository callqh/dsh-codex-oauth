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

// DSH owns these services. Installing even an optional peer can place a second
// version in the profile and shadow the bundled authorization/account services.
for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
  check(`${field} cannot install host packages`, Object.keys(pkg[field] ?? {}).length === 0)
}
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack']) {
  check(`installation does not run ${hook}`, pkg.scripts?.[hook] === undefined)
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
  // This is a development-only import check. The packed-profile regression
  // verifies installation separately; DSH supplies these modules at runtime.
  const require = createRequire(join(root, 'lib/index.js'))
  for (const id of ['@deepseek-ai/dsh-authorization', '@deepseek-ai/dsh-credentials', '@deepseek-ai/dsh-typert-protocol']) {
    let resolved = false
    try {
      resolved = require.resolve(id).length > 0
    } catch {
      resolved = false
    }
    check(`development dependency ${id} resolves`, resolved)
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
