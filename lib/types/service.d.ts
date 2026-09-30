import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Context } from '@deepseek-ai/cordis';
import type { AttemptView, CodexStatus } from './wire.ts';
export type { AttemptPhase, AttemptView, CodexStatus, NoticeView, PromptOptionView, PromptView, } from './wire.ts';
/**
 * The `codexAuth` Remote service.
 *
 * It mounts unconditionally and reports what it cannot do, rather than
 * declaring the seams as required dependencies. That is a boot-safety
 * decision, not a stylistic one: this package is composed into a profile's
 * `dsh.profile.bundles`, where an entry that never activates fails the whole
 * application boot rather than merely going quiet. A composition missing
 * `authorization` or `credentials` therefore has to produce a panel that says
 * so, and it does — `status().ready` is false and every action refuses.
 */
export declare class CodexAuthService extends TypertRemoteService {
    /**
     * The seams, filled in as the host mounts them.
     *
     * A readonly CONTAINER whose contents change, rather than a field that gets
     * reassigned, and deliberately not a `#private` field. Both are forced by how
     * Cordis hands a service to its caller: `ctx.get()` returns a traceable
     * PROXY, and a Remote call reaches the method through it. A `#private` member
     * is unreachable through a proxy — the brand check is on the proxy, not on
     * the target, so every method would throw "Cannot read private member" — and
     * a plain field assignment lands on the proxy rather than on the service.
     * Mutating the contents of a container read through the proxy is the shape
     * that works, and it is the shape the harness's own services use.
     */
    private readonly seams;
    /** The memoized route read. Container semantics, for the reason above. */
    private readonly route;
    /** The one live attempt, if any. Container semantics, for the reason above. */
    private readonly state;
    /**
     * @param ctx - the owning context, which this Service registers itself in.
     */
    constructor(ctx: Context);
    /**
     * How Codex sign-in stands: the stored grant, the route, and the attempt.
     *
     * Every field is safe for a browser. The account id is masked here rather
     * than in the panel, so the full one has no path to the wire at all.
     */
    status(): Promise<CodexStatus>;
    /**
     * Begin the sign-in, or report the one already running.
     *
     * Returns as soon as the attempt is under way: the flow itself takes minutes
     * (a human has to finish it in a browser), so {@link status} is how a caller
     * follows it.
     */
    signIn(): Promise<AttemptView>;
    /**
     * Answer the question the flow is blocked on.
     * @param value - typed text, or the chosen option's id.
     * @returns the attempt as it stands after the answer.
     */
    answer(value: string): Promise<AttemptView>;
    /**
     * Withdraw the attempt.
     *
     * The human saying no is an outcome, not a fault, so this reports the
     * attempt rather than throwing.
     */
    cancel(): Promise<AttemptView>;
    /**
     * Forget the credential.
     *
     * The record is the whole of the local session — there is no second copy
     * anywhere, here or in the browser — so deleting it is the entire sign-out.
     */
    signOut(): Promise<CodexStatus>;
    /** The wire view of the current attempt, defaulting to idle. */
    private attemptView;
}
