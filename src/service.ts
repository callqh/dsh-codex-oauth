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
import { randomUUID } from 'node:crypto'
import { AuthorizationDeclinedError, type AuthorizationService } from '@deepseek-ai/dsh-authorization'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Context } from '@deepseek-ai/cordis'
import { FLOW_KEY, LOGIN_METHOD, grantFacts, maskAccountId } from './flow.ts'
import type { AttemptPhase, AttemptView, CodexStatus, NoticeView, PromptView } from './wire.ts'
import { RouteProbe, type SettingsLike } from './route.ts'

/** The Cordis service key, which is also the Remote wire namespace. */
const SERVICE_KEY = 'codexAuth'

export type {
  AttemptPhase,
  AttemptView,
  CodexStatus,
  NoticeView,
  PromptOptionView,
  PromptView,
} from './wire.ts'

/**
 * A prompt the flow is waiting on, plus the two ways it can settle.
 *
 * Both are idempotent: a question is answered at most once, and a prompt that
 * arrives while the flow is already settling cannot resolve twice. The flow
 * races a typed answer against a browser callback, so a losing prompt is the
 * normal case rather than an error path.
 */
interface PendingPrompt {
  readonly view: PromptView
  answer(value: string): void
  decline(): void
}

/** The mutable half of one attempt: what the panel reads and what it answers. */
interface Attempt {
  readonly id: string
  done: Promise<void>
  phase: AttemptPhase
  notice: NoticeView | null
  prompt: PendingPrompt | null
  error: string | null
}

/** The seams this plugin drives, filled in as the host mounts them. */
interface Seams {
  authorization: AuthorizationService | undefined
  credentials: CredentialProvider | undefined
  settings: SettingsLike | undefined
}

/** One string member, with the empty string treated as absent. */
function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** The message of a caught value, whatever it turned out to be. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
export class CodexAuthService extends TypertRemoteService {
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
  private readonly seams: Seams = { authorization: undefined, credentials: undefined, settings: undefined }

  /** The memoized route read. Container semantics, for the reason above. */
  private readonly route: RouteProbe

  /** The one live attempt, if any. Container semantics, for the reason above. */
  private readonly state: { attempt: Attempt | null; closed: boolean; signingOut: boolean } = {
    attempt: null, closed: false, signingOut: false,
  }

  /**
   * @param ctx - the owning context, which this Service registers itself in.
   */
  constructor(ctx: Context) {
    super(ctx, SERVICE_KEY)
    this.route = new RouteProbe(() => this.seams.settings)

    // Every seam arrives through a nested inject, so nothing here gates the
    // plugin's own activation. See the class note.
    ctx.inject(['authorization'], (scoped: Context) => {
      this.seams.authorization = scoped.authorization
    })
    ctx.inject(['credentials'], (scoped: Context) => {
      this.seams.credentials = scoped.credentials
    })
    ctx.inject(['settings'], (scoped: Context) => {
      this.seams.settings = scoped.get('settings') as SettingsLike
    })

    // A sign-in still waiting for its human must not outlive the plugin that
    // shows it: the pending question is withdrawn and the attempt cancelled
    // upstream, rather than left to time out against the device-code deadline.
    ctx.effect(() => async () => {
      this.state.closed = true
      const attempt = this.state.attempt
      attempt?.prompt?.decline()
      this.seams.authorization?.cancel(FLOW_KEY)
      await attempt?.done
      this.state.attempt = null
    }, 'codex-oauth: withdraw a running sign-in')
  }

  /**
   * How Codex sign-in stands: the stored grant, the route, and the attempt.
   *
   * Every field is safe for a browser. The account id is masked here rather
   * than in the panel. Credential read failures reject instead of appearing
   * signed out.
   */
  @Remote
  async status(): Promise<CodexStatus> {
    const authorization = this.seams.authorization
    const credentials = this.seams.credentials
    const ready = authorization !== undefined && credentials !== undefined

    let signedIn = false
    let accountId: string | null = null
    let planType: string | null = null
    let expiresAt: number | null = null
    if (credentials !== undefined) {
      const facts = grantFacts(await credentials.readRecord(FLOW_KEY))
      signedIn = facts.signedIn
      accountId = maskAccountId(facts.accountId)
      planType = facts.planType
      expiresAt = facts.expiresAt
    }

    const entry = authorization?.describe(FLOW_KEY)
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
    }
  }

  /**
   * Begin the sign-in, or report the one already running.
   *
   * Returns as soon as the attempt is under way: the flow itself takes minutes
   * (a human has to finish it in a browser), so {@link status} is how a caller
   * follows it.
   */
  @Remote
  async signIn(): Promise<AttemptView> {
    if (this.state.closed) throw new Error('Codex sign-in is unavailable after the plugin unloads')
    if (this.state.signingOut) throw new Error('Sign-out is still finishing. Try again when it completes.')
    const authorization = this.seams.authorization
    if (authorization === undefined) throw new Error('Harness 的授权服务未就绪，无法发起登录')

    // One attempt per key is the seam's own rule, and a second `begin()` would
    // be refused with ALREADY_IN_FLIGHT. Reporting the live attempt is the
    // answer the caller actually wants, so the refusal never has to surface.
    if (this.state.attempt?.phase === 'running') return this.attemptView()

    const attempt: Attempt = { id: randomUUID(), done: Promise.resolve(), phase: 'running', notice: null, prompt: null, error: null }
    this.state.attempt = attempt

    const interaction = {
      notify: (notice: { message?: unknown; url?: unknown; code?: unknown }) => {
        // The seam's vocabulary: a device-code notice carries where to go and
        // what to type there together, so the two can never drift apart.
        attempt.notice = {
          message: textOf(notice.message) ?? '',
          url: textOf(notice.url),
          code: textOf(notice.code),
        }
      },
      prompt: (prompt: PromptShape) => new Promise<string>((resolve, reject) => {
        if (prompt.signal?.aborted) {
          reject(new Error('Login question was withdrawn.'))
          return
        }
        let settled = false
        const withdraw = (): void => {
          prompt.signal?.removeEventListener('abort', abort)
          if (attempt.prompt === pending) attempt.prompt = null
        }
        const abort = (): void => {
          if (settled) return
          settled = true
          withdraw()
          // Only a human refusal is AuthorizationDeclinedError; callback withdrawal is not.
          reject(new Error('Login question was withdrawn.'))
        }
        const pending: PendingPrompt = {
          view: promptView(prompt),
          answer: (value) => {
            if (settled) return
            settled = true
            withdraw()
            resolve(value)
          },
          decline: () => {
            if (settled) return
            settled = true
            withdraw()
            reject(new AuthorizationDeclinedError('the user cancelled the sign-in'))
          },
        }
        // A second question while one is open would strand the first, which is
        // the seam's contract to prevent and this line's to survive.
        attempt.prompt?.decline()
        attempt.prompt = pending
        prompt.signal?.addEventListener('abort', abort, { once: true })
      }),
    }

    attempt.done = authorization.begin({ key: FLOW_KEY, method: LOGIN_METHOD, interaction }).then(
      (outcome) => {
        attempt.prompt?.decline()
        attempt.phase = outcome.status === 'authorized' ? 'authorized' : 'cancelled'
        // A route the user has just added or removed is exactly the kind of
        // change that follows a sign-in, so the memo is dropped with it.
        this.route.invalidate()
      },
      (error: unknown) => {
        attempt.prompt?.decline()
        attempt.phase = 'failed'
        attempt.error = messageOf(error)
      },
    )

    return this.attemptView()
  }

  /**
   * Answer the question the flow is blocked on.
   * @param attemptId - identity returned for the displayed login attempt.
   * @param promptId - identity returned for the displayed question.
   * @param value - typed text, or the chosen option's id.
   * @returns the attempt as it stands after the answer.
   */
  @Remote
  async answer(attemptId: string, promptId: string, value: string): Promise<AttemptView> {
    const attempt = this.requireAttempt(attemptId)
    const prompt = attempt.prompt
    if (attempt.phase !== 'running' || prompt === null || prompt.view.id !== promptId) {
      throw new Error('This login question has expired. Refresh the sign-in page and try again.')
    }
    if (prompt.view.kind === 'select' && !prompt.view.options?.some(option => option.id === value)) {
      throw new Error('Choose one of the displayed login methods.')
    }
    prompt.answer(value)
    return this.attemptView()
  }

  /**
   * Withdraw the named attempt and wait for its actual outcome. Once the
   * authorization service admits a commit, it may finish as authorized.
   * @param attemptId - identity returned for the login to cancel.
   * @returns the attempt after authorization settles; stale identities reject.
   */
  @Remote
  async cancel(attemptId: string): Promise<AttemptView> {
    const attempt = this.requireAttempt(attemptId)
    attempt.prompt?.decline()
    this.seams.authorization?.cancel(FLOW_KEY)
    await attempt.done
    return this.attemptView()
  }

  /**
   * Forget the credential.
   *
   * The record is the whole of the local session — there is no second copy
   * anywhere, here or in the browser. Sign-out stops new login admission,
   * waits for the active attempt, then deletes the record. A failed deletion
   * keeps the attempt available for retry.
   */
  @Remote
  async signOut(): Promise<CodexStatus> {
    if (this.state.closed) throw new Error('Codex sign-in is unavailable after the plugin unloads')
    if (this.state.signingOut) throw new Error('Sign-out is already running.')
    const credentials = this.seams.credentials
    if (credentials === undefined) throw new Error('Harness 的凭证服务未就绪，无法退出登录')
    this.state.signingOut = true
    try {
      const attempt = this.state.attempt
      attempt?.prompt?.decline()
      this.seams.authorization?.cancel(FLOW_KEY)
      await attempt?.done
      await credentials.deleteRecord(FLOW_KEY)
      this.state.attempt = null
      this.route.invalidate()
      return await this.status()
    } finally {
      this.state.signingOut = false
    }
  }

  /** Reject delayed operations that refer to a previous login. */
  private requireAttempt(id: string): Attempt {
    if (this.state.closed) throw new Error('Codex sign-in is unavailable after the plugin unloads')
    const attempt = this.state.attempt
    if (attempt === null || attempt.id !== id) throw new Error('This login attempt has expired. Refresh the sign-in page.')
    return attempt
  }

  /** The wire view of the current attempt, defaulting to idle. */
  private attemptView(): AttemptView {
    const attempt = this.state.attempt
    if (attempt === null) {
      return { id: null, phase: 'idle', notice: null, prompt: null, error: null }
    }
    return {
      id: attempt.id,
      phase: attempt.phase,
      notice: attempt.notice,
      prompt: attempt.prompt === null ? null : attempt.prompt.view,
      error: attempt.error,
    }
  }
}

/** The seam's own prompt shape, as this plugin reads it structurally. */
interface PromptShape {
  readonly signal?: AbortSignal
  readonly kind?: unknown
  readonly message?: unknown
  readonly placeholder?: unknown
  readonly options?: unknown
}

/**
 * Narrow one seam prompt into the view a panel renders.
 *
 * An unrecognised `kind` becomes `text`: the seam's vocabulary is closed, so
 * the only way to reach the fallback is a version skew, and offering a text
 * field is a better answer to an unexpected question than rendering nothing.
 */
function promptView(prompt: PromptShape): PromptView {
  const kind = prompt.kind === 'select' || prompt.kind === 'secret' ? prompt.kind : 'text'
  const rawOptions = Array.isArray(prompt.options) ? prompt.options : null
  return {
    id: randomUUID(),
    kind,
    message: textOf(prompt.message) ?? '',
    placeholder: textOf(prompt.placeholder),
    options: rawOptions === null
      ? null
      : rawOptions.map((option: { id?: unknown; label?: unknown; description?: unknown }) => ({
        id: textOf(option.id) ?? '',
        label: textOf(option.label) ?? '',
        description: textOf(option.description),
      })),
  }
}
