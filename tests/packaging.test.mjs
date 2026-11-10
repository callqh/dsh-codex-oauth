/** Install the distribution, not a linked checkout that hides dependency shadowing. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('packed plugin installs without host packages or build scripts in either layout', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'codex-packaging-'))
  try {
    const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temp], { cwd: root, encoding: 'utf8' }))
    const archive = join(temp, packed[0].filename)
    for (const layout of ['hoisted', 'isolated']) {
      // Check auto-installing peers too: removing only runtime dependencies
      // would still reproduce the bug if the package advertised required peers.
      for (const peers of [false, true]) {
        const profile = join(temp, `${layout}-${peers}`)
        await mkdir(profile)
        await writeFile(join(profile, 'package.json'), JSON.stringify({
          private: true,
          dependencies: { 'dsh-codex-oauth': `file:${archive}` },
        }))
        await writeFile(join(profile, 'pnpm-workspace.yaml'), `packages:\n  - .\nnodeLinker: ${layout}\nautoInstallPeers: ${peers}\n`)
        execFileSync('pnpm', ['install', '--offline', '--ignore-scripts'], { cwd: profile, stdio: 'pipe' })
        const modules = join(profile, 'node_modules')
        const installed = join(modules, 'dsh-codex-oauth')
        const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'))
        for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
          assert.deepEqual(Object.keys(manifest[field] ?? {}), [], `${layout}/${peers}: ${field}`)
        }
        for (const hook of ['prepare', 'preinstall', 'install', 'postinstall', 'prepack']) {
          assert.equal(manifest.scripts?.[hook], undefined, hook)
        }
        // Both entry points must be distributed even when builds are denied.
        assert.match(await readFile(join(installed, 'lib/index.js'), 'utf8'), /CodexAuthService/)
        assert.match(await readFile(join(installed, 'client/client.js'), 'utf8'), /window\.__ModuleLoader__\.load/)
        const scope = await readdir(join(modules, '@deepseek-ai')).catch(error => {
          if (error.code === 'ENOENT') return []
          throw error
        })
        assert.deepEqual(scope, [], `${layout}/${peers}: profile must not shadow host services`)
        assert.doesNotMatch(await readFile(join(profile, 'pnpm-lock.yaml'), 'utf8'), /@deepseek-ai\//)
      }
    }
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
