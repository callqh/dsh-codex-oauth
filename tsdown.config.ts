/**
 * Browser bundle for dsh-codex-oauth, built the way the harness builds its own
 * client packages: a closure-factory artifact that calls
 * `window.__ModuleLoader__.load({ id, factory })` and resolves its externals
 * through the injected `require` (the page's module table).
 *
 * The two things this file exists to get right:
 *
 * 1. ONLY platform seed words stay external. The page's seed table on this
 *    runtime is react, react/jsx-runtime, react-dom, react-dom/client,
 *    @deepseek-ai/cordis, dsh-client-store, dsh-client-ui-slots,
 *    dsh-client-ui-primitives and dsh-client-ui-dockkit. A `require()` the
 *    table cannot answer is an unconditional runtime throw, so anything else
 *    is inlined by `noExternal` rather than left as an import.
 *
 * 2. CSS Modules compile in the bundle. Importing `x.module.css` yields the
 *    hashed class map, and the stylesheet text installs one
 *    `<style data-plugin>` tag at factory execution — which the loader removes
 *    again when the plugin unloads.
 *
 * `scripts/preflight.mjs` asserts the emitted client/client.js carries the
 * exact `window.__ModuleLoader__.load({ id: "dsh-codex-oauth"` banner.
 */
import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve as resolvePath, sep as pathSep } from 'node:path'
import { defineConfig } from 'tsdown'
import { transform } from 'lightningcss'

const id = 'dsh-codex-oauth'

/** Externals answered by the page's platform seed table — and nothing else. */
const CLIENT_EXTERNALS = ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives']

/**
 * Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline.
 * The suffix matters: tsdown's guard matches ids ending in `.css`, so the
 * virtual id must not.
 */
const CSS_VIRTUAL_PREFIX = '\0codex-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

export default defineConfig({
  entry: { client: 'src/client/index.ts' },
  // package.json exports "./client" points at client/client.js, so the bundle
  // lands there directly.
  outDir: 'client',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  // Host types ship from lib/types (tsc); dts here would wrap the
  // banner/footer into a .d.cts and break parsing.
  dts: false,
  // No sourcemap: the bundle is committed (an install may block build scripts)
  // and a single-line map makes every front-end change a whole-file conflict.
  sourcemap: false,
  clean: false,
  external: [...CLIENT_EXTERNALS],
  // tsdown auto-externalizes package dependencies; anything NOT in the page's
  // module table has to inline instead.
  noExternal: (source: string) => (CLIENT_EXTERNALS.includes(source) ? undefined : true),
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [{
    name: 'codex-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
      // The virtual id is REPO-RELATIVE, not absolute, and that is load-bearing
      // twice over. Rolldown writes the id into a `//#region` comment in the
      // emitted bundle, so an absolute path would ship the builder's home
      // directory to every user and make the committed artifact differ per
      // machine. It is resolved back against the build's working directory in
      // `load` below.
      return CSS_VIRTUAL_PREFIX + relative(process.cwd(), abs).split(pathSep).join('/') + CSS_VIRTUAL_SUFFIX
    },
    async load(this: { addWatchFile(file: string): void }, virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = resolvePath(process.cwd(), virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length))
      // The virtual id otherwise hides the physical stylesheet from the watch graph.
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      // The filename feeds lightningcss's `[hash]`. Repo-relative with posix
      // separators keeps the class prefix identical on every machine, so a
      // rebuilt bundle is byte-identical and the committed artifact stays
      // reviewable.
      const { code, exports: cssExports } = transform({
        filename: relative(process.cwd(), fileId).split('\\').join('/'),
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
        // Without explicit targets lightningcss collapses the hand-written
        // `backdrop-filter` + `-webkit-backdrop-filter` pair to the -webkit-
        // form only; targets keep both.
        targets: { chrome: 90 << 16, firefox: 100 << 16, safari: 13 << 16, edge: 90 << 16 },
      })
      const classMap: Record<string, string> = {}
      for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      // One <style data-plugin> per module file; idempotent under re-evaluation.
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(`${id}/${basename(fileId)}`)};`,
        'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
        '  const tag = document.createElement(\'style\');',
        `  tag.dataset.plugin = ${JSON.stringify(id)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
