/**
 * The `codexAuth` wire vocabulary, shared by both halves.
 *
 * Types only, and deliberately free of imports: the browser bundle needs the
 * exact shapes the host answers with, and it must not drag the host's Node-side
 * module graph in to get them. `src/service.ts` produces these and
 * `src/client/api.ts` consumes them, so a change here is a change to the
 * contract between them.
 *
 * @module dsh-codex-oauth/wire
 */
export {};
