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
/** How one attempt stands. `authorized`/`cancelled` are outcomes; `failed` is not. */
export type AttemptPhase = 'idle' | 'running' | 'authorized' | 'cancelled' | 'failed';
/** A page (and optional code) the flow wants the human to act on. Never a secret. */
export interface NoticeView {
    readonly message: string;
    readonly url: string | null;
    readonly code: string | null;
}
/** One choice a `select` prompt offers. */
export interface PromptOptionView {
    readonly id: string;
    readonly label: string;
    readonly description: string | null;
}
/**
 * A question the flow is blocked on. `select` answers with an option id, the
 * other two with typed text — and `secret` differs from `text` only in how a
 * surface presents it.
 */
export interface PromptView {
    readonly kind: 'text' | 'secret' | 'select';
    readonly message: string;
    readonly placeholder: string | null;
    readonly options: readonly PromptOptionView[] | null;
}
/** What the panel renders for one running (or just-finished) attempt. */
export interface AttemptView {
    readonly phase: AttemptPhase;
    readonly notice: NoticeView | null;
    readonly prompt: PromptView | null;
    readonly error: string | null;
}
/** The whole answer to "how does Codex sign-in stand right now". */
export interface CodexStatus {
    /**
     * Whether the two seams this plugin drives are mounted. False means the
     * panel has nothing to offer and says so, rather than offering a button
     * whose handler would throw.
     */
    readonly ready: boolean;
    readonly signedIn: boolean;
    /** Already masked on the host, so the full id has no path to the browser. */
    readonly accountId: string | null;
    readonly planType: string | null;
    readonly expiresAt: number | null;
    /** `null` when this composition has no settings service to ask. */
    readonly routeConfigured: boolean | null;
    /** Whether `llm-pi-ai` has registered a flow for the key at all. */
    readonly flowAvailable: boolean;
    /** The flow's own user-facing name, taken from the registration. */
    readonly flowLabel: string | null;
    readonly attempt: AttemptView;
}
