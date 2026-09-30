/**
 * The slice of the page this plugin touches, declared structurally.
 *
 * The plugin takes no dependency on any `@deepseek-ai/dsh-client-*` package.
 * Those are not a contract: they change without notice, the browser half has
 * no type checking against the runtime, and a component that throws while
 * rendering blanks the whole slot entry. Declaring only the members actually
 * used keeps a host-side rename to one compilation error here instead of a
 * page that silently loses its card.
 *
 * @module dsh-codex-oauth/client/types
 */

/** Look up one message in the registered dictionary. */
export type Translate = (key: string) => string

/** The locale service: dictionary registration and lookup. */
export interface LocaleService {
  register(namespace: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }): unknown
  bind(namespace: string): Translate
}

/**
 * What `slots.register` accepts for the seat this plugin claims.
 *
 * `settings.section` is a LIST slot — one entry per cell, addressed by `id` and
 * ordered by `order` — which is why there is no `key` here. The keyed shape
 * belongs to `settings.models.provider-card`, the seat this plugin used first
 * and moved away from.
 */
export interface SlotRegistration {
  /** The slot key, which must match the name the host declared. */
  readonly name: string
  /** This entry's cell id, unique among the section's registrations. */
  readonly id: string
  /** Position among the section list's entries. */
  readonly order: number
  /** The sidebar label. A thunk so a locale switch re-reads it. */
  readonly label: () => string
  /** The namespace this entry's label and copy come from. */
  readonly locale: string
  /** Props handed to the component. */
  readonly inject: () => { readonly t: Translate }
}

/**
 * The slots service.
 *
 * A section component receives the props its entry declared through `inject`;
 * this plugin's card reads none of them, because everything it shows comes from
 * its own Remote call.
 */
export interface SlotsService {
  inject(slot: string, register: () => unknown): void
  register(options: SlotRegistration, component: (props: Record<string, unknown>) => unknown): unknown
}

/**
 * The one Remote namespace this plugin mounts.
 *
 * Indexable because the namespace service is reached by name off the same
 * object — `ctx.remote.codexAuth` — once the corresponding service key is
 * available.
 */
export interface RemoteService {
  $mount(contribution: unknown): Promise<() => Promise<void>>
  readonly [service: string]: unknown
}

/** The client context shape this plugin relies on. */
export interface ClientContext {
  effect(callback: () => unknown, label?: string): void
  inject(services: string[], callback: (scoped: ClientContext) => void): void
  /**
   * Read one service without depending on it.
   *
   * Used for the Remote namespace, which is created by `$mount` and may never
   * arrive. Depending on it with `inject` would gate the card's very existence
   * on an async step, so a failure there would leave the user with nothing at
   * all — the one outcome this plugin must not produce.
   */
  get(service: string): unknown
  locale: LocaleService
  slots: SlotsService
  remote: RemoteService
}
