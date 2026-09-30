/**
 * dsh-codex-oauth — host entry.
 *
 * The plugin is the Service class itself, which is what `ctx.authorization`
 * needs to be driven from a browser: constructing it registers `ctx.codexAuth`
 * and binds the same key as a Remote namespace, so the client half can mount
 * `remote.codexAuth` and talk to exactly this instance.
 *
 * `name` is the module's own identity, used by the plugin list and the profile
 * patch's entry id. The class deliberately declares no `static inject`: its
 * three seams arrive through nested injects inside the constructor, so a
 * composition missing one of them produces a panel that says so instead of an
 * entry that never activates — and on a profile bundle, an entry that never
 * activates fails the whole application boot.
 *
 * @module dsh-codex-oauth
 */
export { CodexAuthService, CodexAuthService as default } from './service.ts';
export type { AttemptPhase, AttemptView, CodexStatus, NoticeView, PromptOptionView, PromptView, } from './wire.ts';
/** This plugin's own name. */
export declare const name = "codex-oauth";
