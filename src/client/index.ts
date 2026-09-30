/**
 * dsh-codex-oauth — browser entry.
 *
 * ## The seat
 *
 * The card is its own `settings.section`, so it appears in the settings sidebar
 * as **Codex sign-in**.
 *
 * It was first written into `settings.models.provider-card`, the keyed slot the
 * Models page renders inside each provider row. That seat is contextually right
 * and was rejected on contact with a user: those rows are the API-key editor,
 * and a subscription sign-in sitting inside one reads as part of that editor —
 * as if the ChatGPT login were an alternative way to fill in the same field. It
 * is not; it is a different thing that happens to configure the same route.
 *
 * The section seat also drops a whole class of silent failure. The provider-card
 * seat is keyed by the row's `settingsNs` (`llm-pi-ai`, derived from the loader
 * entry id), so a profile that renames that row loses the card with no error
 * anywhere; and the row itself only exists once the route is declared. A
 * section is declared by the shell and keyed by nothing.
 *
 * One host-contract fact this file still depends on:
 *
 * - The page's module table — not a package this bundle could depend on — is
 *   where `@deepseek-ai/dsh-client-ui-primitives` comes from (it is one of the
 *   platform seed words). The gate below turns a host that renamed one of the
 *   primitives into a missing card instead of a blank settings dialog.
 *
 * ## Why registration does not wait for the Remote namespace
 *
 * The first version nested the slot registration inside
 * `ctx.inject(['remote.codexAuth'], …)`, so nothing was registered until
 * `$mount` had resolved and the namespace service existed. That is one async
 * step too many in front of the only thing the user can see: if the mount fails
 * — for any reason, including one this plugin has not anticipated — the plugin
 * produces no card, no entry and no explanation. Silence is indistinguishable
 * from "not installed", and it is the worst available outcome.
 *
 * Registration now depends only on `slots` and `locale`, both declared in
 * `inject` above. The card resolves the namespace lazily through `ctx.get` and
 * says what it is waiting for while it does, so every failure has a visible
 * shape. The breadcrumbs below exist for the same reason: they make the console
 * answer "did this bundle even run".
 *
 * @module dsh-codex-oauth/client
 */
import { createElement } from 'react'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import { CONTRIBUTION, NAMESPACE, type CodexApi } from './api.ts'
import { CodexSignIn, REQUIRED_PRIMITIVES } from './CodexSignIn.tsx'
import { CardErrorBoundary } from './ErrorBoundary.tsx'
import { NS, bindMessages, en, zh } from './locales.ts'
import type { ClientContext } from './types.ts'

/** This plugin's own name. Also the prefix of every line this file logs. */
export const name = 'codex-oauth'

/** Prefix for the breadcrumbs; grepping the console for it finds all of them. */
const TAG = '[dsh-codex-oauth]'

// 'remote' is where `$mount` lives. The namespace it installs is NOT injected —
// see the module note.
export const inject = ['slots', 'locale', 'remote']

/** The slot: one page in the settings sidebar. */
const SLOT = 'settings.section'

/** This section's id, and the order it takes among the built-in sections. */
const SECTION_ID = 'codex-oauth'
const SECTION_ORDER = 14

/**
 * Register the card.
 * @param ctx - the client context carrying the slots, locale and remote seams.
 */
export function apply(ctx: ClientContext): void {
  console.info(`${TAG} client apply`)

  const missing = missingPrimitives(primitives as unknown as Record<string, unknown>)
  if (missing.length > 0) {
    // Nothing can be rendered, so this is the only surface left. Say exactly
    // which names are absent: "the card did not appear" is not a diagnosis.
    console.warn(
      `${TAG} this host's ui-primitives module is missing ${missing.join(', ')}; `
      + 'the Codex sign-in card is disabled rather than allowed to blank the settings dialog',
    )
    return
  }

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'codex-oauth: dictionaries')
  // The service's own lookup takes any string; the narrowed one is for the
  // components, so a mistyped message key is a build error.
  const lookup = ctx.locale.bind(NS)
  const t = bindMessages(lookup)

  ctx.effect(() => {
    let dispose: (() => Promise<void>) | undefined
    let unloaded = false
    void ctx.remote.$mount(CONTRIBUTION).then((off) => {
      console.info(`${TAG} Remote namespace ${JSON.stringify(NAMESPACE)} mounted`)
      if (unloaded) void off()
      else dispose = off
    }).catch((error: unknown) => {
      console.warn(`${TAG} could not mount the ${NAMESPACE} Remote namespace`, error)
    })
    return async () => {
      unloaded = true
      await dispose?.()
    }
  }, 'codex-oauth: Remote contribution')

  // Registered unconditionally, and as early as the slot exists. The card is
  // the only thing the user can act on; it must not be held behind the mount.
  ctx.slots.inject(SLOT, () => {
    console.info(`${TAG} slot ${JSON.stringify(SLOT)} is declared; adding the ${SECTION_ID} section`)
    return ctx.slots.register({
      name: SLOT,
      id: SECTION_ID,
      order: SECTION_ORDER,
      label: () => lookup('nav'),
      locale: NS,
      inject: () => ({ t: lookup }),
    }, () => createElement(
      CardErrorBoundary,
      { labels: { title: t('failed'), retry: t('retry') } },
      // Passed as a getter, not a value: the namespace may arrive after the
      // card mounts, and the card has to be able to notice that.
      createElement(CodexSignIn, { getApi: () => ctx.get(`remote.${NAMESPACE}`) as CodexApi | undefined, t }),
    ))
  })
}

/**
 * Which primitives this bundle renders that the host module does not export.
 * @param mod - the host's ui-primitives module.
 * @returns the missing member names, empty when the host is compatible.
 */
export function missingPrimitives(
  mod: Record<string, unknown>,
  required: readonly string[] = REQUIRED_PRIMITIVES,
): string[] {
  return required.filter((member) => mod[member] === undefined)
}

export { REQUIRED_PRIMITIVES }
