var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
/**
 * The sign-in surface for the `openai-codex` route.
 *
 * Everything this class does is translation. The protocol belongs to pi-ai,
 * the conversation belongs to `ctx.authorization`, the credential record
 * belongs to `ctx.credentials`, and the route belongs to `llm-pi-ai`. What is
 * missing upstream is a surface that calls `begin()` and renders what the flow
 * says, so that is the whole of what is here:
 *
 *   signIn()  → ctx.authorization.begin({ key, method, interaction })
 *   status()  → the seam's own bookkeeping + the stored grant + the route probe
 *   answer()  → the return value of the one prompt the flow is waiting on
 *   cancel()  → ctx.authorization.cancel(key)
 *   signOut() → ctx.credentials.deleteRecord(key)
 *
 * Two deliberate non-goals, both of which this class would otherwise be
 * tempted into:
 *
 * - It never reads, copies or rewrites a token. `status()` reads the record to
 *   report an account and an expiry, and sends neither.
 * - It never refreshes, and never decides that a token is stale. pi-ai
 *   refreshes inside the credential store's `modify()`, which is also what
 *   makes two Harness processes sharing one refresh token safe.
 *
 * @module dsh-codex-oauth/service
 */
import { randomUUID } from 'node:crypto';
import { AuthorizationDeclinedError } from '@deepseek-ai/dsh-authorization';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { FLOW_KEY, LOGIN_METHOD, grantFacts, maskAccountId } from "./flow.js";
import { RouteProbe } from "./route.js";
/** The Cordis service key, which is also the Remote wire namespace. */
const SERVICE_KEY = 'codexAuth';
/** One string member, with the empty string treated as absent. */
function textOf(value) {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
/** The message of a caught value, whatever it turned out to be. */
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
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
let CodexAuthService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _status_decorators;
    let _signIn_decorators;
    let _answer_decorators;
    let _cancel_decorators;
    let _signOut_decorators;
    return class CodexAuthService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _status_decorators = [Remote];
            _signIn_decorators = [Remote];
            _answer_decorators = [Remote];
            _cancel_decorators = [Remote];
            _signOut_decorators = [Remote];
            __esDecorate(this, null, _status_decorators, { kind: "method", name: "status", static: false, private: false, access: { has: obj => "status" in obj, get: obj => obj.status }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _signIn_decorators, { kind: "method", name: "signIn", static: false, private: false, access: { has: obj => "signIn" in obj, get: obj => obj.signIn }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _answer_decorators, { kind: "method", name: "answer", static: false, private: false, access: { has: obj => "answer" in obj, get: obj => obj.answer }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _cancel_decorators, { kind: "method", name: "cancel", static: false, private: false, access: { has: obj => "cancel" in obj, get: obj => obj.cancel }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _signOut_decorators, { kind: "method", name: "signOut", static: false, private: false, access: { has: obj => "signOut" in obj, get: obj => obj.signOut }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
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
        seams = (__runInitializers(this, _instanceExtraInitializers), { authorization: undefined, credentials: undefined, settings: undefined });
        /** The memoized route read. Container semantics, for the reason above. */
        route;
        /** The one live attempt, if any. Container semantics, for the reason above. */
        state = {
            attempt: null, closed: false, signingOut: false,
        };
        /**
         * @param ctx - the owning context, which this Service registers itself in.
         */
        constructor(ctx) {
            super(ctx, SERVICE_KEY);
            this.route = new RouteProbe(() => this.seams.settings);
            // Every seam arrives through a nested inject, so nothing here gates the
            // plugin's own activation. See the class note.
            ctx.inject(['authorization'], (scoped) => {
                this.seams.authorization = scoped.authorization;
            });
            ctx.inject(['credentials'], (scoped) => {
                this.seams.credentials = scoped.credentials;
            });
            ctx.inject(['settings'], (scoped) => {
                this.seams.settings = scoped.get('settings');
            });
            // A sign-in still waiting for its human must not outlive the plugin that
            // shows it: the pending question is withdrawn and the attempt cancelled
            // upstream, rather than left to time out against the device-code deadline.
            ctx.effect(() => async () => {
                this.state.closed = true;
                const attempt = this.state.attempt;
                attempt?.prompt?.decline();
                this.seams.authorization?.cancel(FLOW_KEY);
                await attempt?.done;
                this.state.attempt = null;
            }, 'codex-oauth: withdraw a running sign-in');
        }
        /**
         * How Codex sign-in stands: the stored grant, the route, and the attempt.
         *
         * Every field is safe for a browser. The account id is masked here rather
         * than in the panel. Credential read failures reject instead of appearing
         * signed out.
         */
        async status() {
            const authorization = this.seams.authorization;
            const credentials = this.seams.credentials;
            const ready = authorization !== undefined && credentials !== undefined;
            let signedIn = false;
            let accountId = null;
            let planType = null;
            let expiresAt = null;
            if (credentials !== undefined) {
                const facts = grantFacts(await credentials.readRecord(FLOW_KEY));
                signedIn = facts.signedIn;
                accountId = maskAccountId(facts.accountId);
                planType = facts.planType;
                expiresAt = facts.expiresAt;
            }
            const entry = authorization?.describe(FLOW_KEY);
            return {
                ready,
                signedIn,
                accountId,
                planType,
                expiresAt,
                routeConfigured: this.route.read(),
                flowAvailable: entry !== undefined,
                flowLabel: entry === undefined ? null : entry.label,
                attempt: this.attemptView(),
            };
        }
        /**
         * Begin the sign-in, or report the one already running.
         *
         * Returns as soon as the attempt is under way: the flow itself takes minutes
         * (a human has to finish it in a browser), so {@link status} is how a caller
         * follows it.
         */
        async signIn() {
            if (this.state.closed)
                throw new Error('Codex sign-in is unavailable after the plugin unloads');
            if (this.state.signingOut)
                throw new Error('Sign-out is still finishing. Try again when it completes.');
            const authorization = this.seams.authorization;
            if (authorization === undefined)
                throw new Error('Harness 的授权服务未就绪，无法发起登录');
            // One attempt per key is the seam's own rule, and a second `begin()` would
            // be refused with ALREADY_IN_FLIGHT. Reporting the live attempt is the
            // answer the caller actually wants, so the refusal never has to surface.
            if (this.state.attempt?.phase === 'running')
                return this.attemptView();
            const attempt = { id: randomUUID(), done: Promise.resolve(), phase: 'running', notice: null, prompt: null, error: null };
            this.state.attempt = attempt;
            const interaction = {
                notify: (notice) => {
                    // The seam's vocabulary: a device-code notice carries where to go and
                    // what to type there together, so the two can never drift apart.
                    attempt.notice = {
                        message: textOf(notice.message) ?? '',
                        url: textOf(notice.url),
                        code: textOf(notice.code),
                    };
                },
                prompt: (prompt) => new Promise((resolve, reject) => {
                    if (prompt.signal?.aborted) {
                        reject(new Error('Login question was withdrawn.'));
                        return;
                    }
                    let settled = false;
                    const withdraw = () => {
                        prompt.signal?.removeEventListener('abort', abort);
                        if (attempt.prompt === pending)
                            attempt.prompt = null;
                    };
                    const abort = () => {
                        if (settled)
                            return;
                        settled = true;
                        withdraw();
                        // Only a human refusal is AuthorizationDeclinedError; callback withdrawal is not.
                        reject(new Error('Login question was withdrawn.'));
                    };
                    const pending = {
                        view: promptView(prompt),
                        answer: (value) => {
                            if (settled)
                                return;
                            settled = true;
                            withdraw();
                            resolve(value);
                        },
                        decline: () => {
                            if (settled)
                                return;
                            settled = true;
                            withdraw();
                            reject(new AuthorizationDeclinedError('the user cancelled the sign-in'));
                        },
                    };
                    // A second question while one is open would strand the first, which is
                    // the seam's contract to prevent and this line's to survive.
                    attempt.prompt?.decline();
                    attempt.prompt = pending;
                    prompt.signal?.addEventListener('abort', abort, { once: true });
                }),
            };
            attempt.done = authorization.begin({ key: FLOW_KEY, method: LOGIN_METHOD, interaction }).then((outcome) => {
                attempt.prompt?.decline();
                attempt.phase = outcome.status === 'authorized' ? 'authorized' : 'cancelled';
                // A route the user has just added or removed is exactly the kind of
                // change that follows a sign-in, so the memo is dropped with it.
                this.route.invalidate();
            }, (error) => {
                attempt.prompt?.decline();
                attempt.phase = 'failed';
                attempt.error = messageOf(error);
            });
            return this.attemptView();
        }
        /**
         * Answer the question the flow is blocked on.
         * @param attemptId - identity returned for the displayed login attempt.
         * @param promptId - identity returned for the displayed question.
         * @param value - typed text, or the chosen option's id.
         * @returns the attempt as it stands after the answer.
         */
        async answer(attemptId, promptId, value) {
            const attempt = this.requireAttempt(attemptId);
            const prompt = attempt.prompt;
            if (attempt.phase !== 'running' || prompt === null || prompt.view.id !== promptId) {
                throw new Error('This login question has expired. Refresh the sign-in page and try again.');
            }
            if (prompt.view.kind === 'select' && !prompt.view.options?.some(option => option.id === value)) {
                throw new Error('Choose one of the displayed login methods.');
            }
            prompt.answer(value);
            return this.attemptView();
        }
        /**
         * Withdraw the named attempt and wait for its actual outcome. Once the
         * authorization service admits a commit, it may finish as authorized.
         * @param attemptId - identity returned for the login to cancel.
         * @returns the attempt after authorization settles; stale identities reject.
         */
        async cancel(attemptId) {
            const attempt = this.requireAttempt(attemptId);
            attempt.prompt?.decline();
            this.seams.authorization?.cancel(FLOW_KEY);
            await attempt.done;
            return this.attemptView();
        }
        /**
         * Forget the credential.
         *
         * The record is the whole of the local session — there is no second copy
         * anywhere, here or in the browser. Sign-out stops new login admission,
         * waits for the active attempt, then deletes the record. A failed deletion
         * keeps the attempt available for retry.
         */
        async signOut() {
            if (this.state.closed)
                throw new Error('Codex sign-in is unavailable after the plugin unloads');
            if (this.state.signingOut)
                throw new Error('Sign-out is already running.');
            const credentials = this.seams.credentials;
            if (credentials === undefined)
                throw new Error('Harness 的凭证服务未就绪，无法退出登录');
            this.state.signingOut = true;
            try {
                const attempt = this.state.attempt;
                attempt?.prompt?.decline();
                this.seams.authorization?.cancel(FLOW_KEY);
                await attempt?.done;
                await credentials.deleteRecord(FLOW_KEY);
                this.state.attempt = null;
                this.route.invalidate();
                return await this.status();
            }
            finally {
                this.state.signingOut = false;
            }
        }
        /** Reject delayed operations that refer to a previous login. */
        requireAttempt(id) {
            if (this.state.closed)
                throw new Error('Codex sign-in is unavailable after the plugin unloads');
            const attempt = this.state.attempt;
            if (attempt === null || attempt.id !== id)
                throw new Error('This login attempt has expired. Refresh the sign-in page.');
            return attempt;
        }
        /** The wire view of the current attempt, defaulting to idle. */
        attemptView() {
            const attempt = this.state.attempt;
            if (attempt === null) {
                return { id: null, phase: 'idle', notice: null, prompt: null, error: null };
            }
            return {
                id: attempt.id,
                phase: attempt.phase,
                notice: attempt.notice,
                prompt: attempt.prompt === null ? null : attempt.prompt.view,
                error: attempt.error,
            };
        }
    };
})();
export { CodexAuthService };
/**
 * Narrow one seam prompt into the view a panel renders.
 *
 * An unrecognised `kind` becomes `text`: the seam's vocabulary is closed, so
 * the only way to reach the fallback is a version skew, and offering a text
 * field is a better answer to an unexpected question than rendering nothing.
 */
function promptView(prompt) {
    const kind = prompt.kind === 'select' || prompt.kind === 'secret' ? prompt.kind : 'text';
    const rawOptions = Array.isArray(prompt.options) ? prompt.options : null;
    return {
        id: randomUUID(),
        kind,
        message: textOf(prompt.message) ?? '',
        placeholder: textOf(prompt.placeholder),
        options: rawOptions === null
            ? null
            : rawOptions.map((option) => ({
                id: textOf(option.id) ?? '',
                label: textOf(option.label) ?? '',
                description: textOf(option.description),
            })),
    };
}
