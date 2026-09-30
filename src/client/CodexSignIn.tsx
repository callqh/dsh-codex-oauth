/**
 * The Codex sign-in card, rendered inside the `openai-codex` provider row on
 * the Models settings page.
 *
 * Everything it shows comes from one host call, `status()`, and it renders the
 * four states a user can be in: not signed in, signing in (which includes
 * whatever question the flow is currently asking), signed in, and unable to
 * sign in at all. It never holds a credential and never sees a token.
 *
 * The polling is deliberate and bounded: it runs only while an attempt is in
 * flight, at a little over a second, and stops the moment the flow settles.
 * The alternative — a stream or event channel — needs a hand-written
 * descriptor for a non-unary method, and a wrong descriptor there fails at
 * mount rather than at runtime, which is a worse trade for a flow whose whole
 * interactive window is a couple of minutes.
 *
 * @module dsh-codex-oauth/client/CodexSignIn
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import {
  Button,
  IconCopyOutlineRegular,
  IconLinkOutlineRegular,
  IconLoadingOutlineRegular,
  Input,
  StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { NAMESPACE, unwrap, type CodexApi } from './api.ts'
import type { MessageKey } from './locales.ts'
import type { AttemptView, CodexStatus } from '../wire.ts'
import styles from './CodexSignIn.module.css'

/** How often a running attempt is re-read. Short enough to feel live. */
const POLL_MS = 1200

/** What the card needs to render. */
export interface CodexSignInProps {
  /**
   * The Remote namespace, or undefined while it is not published yet.
   *
   * A getter rather than a value: `$mount` creates the namespace asynchronously,
   * and the card is registered before that finishes. Holding a value would mean
   * either gating the card's existence on the mount — which is how a failure
   * becomes invisible — or freezing `undefined` forever.
   */
  readonly getApi: () => CodexApi | undefined
  readonly t: (key: MessageKey) => string
}

/** How the card stands with the host interface. */
type RemotePhase = 'connecting' | 'ready' | 'missing'

/**
 * How often to look for the namespace, and how many times before giving up.
 *
 * The namespace is created in this same page, moments after `$mount` resolves,
 * so a couple of seconds is already generous. The budget is deliberately short:
 * a card stuck on "connecting" is the same silence the give-up state exists to
 * remove, and two seconds of it is a diagnostic rather than a hang.
 */
const CONNECT_MS = 250
const CONNECT_ATTEMPTS = 8

/** A line the card adds below its controls, in one of three tones. */
type Flash = { readonly tone: 'error' | 'notice' | 'done'; readonly text: string }

/** The phase an attempt is in, defaulted so the first render has one. */
function phaseOf(status: CodexStatus | null): AttemptView['phase'] {
  return status?.attempt.phase ?? 'idle'
}

/**
 * Render the sign-in surface.
 * @param props - the mounted Remote namespace and the bound dictionary.
 * @returns the card.
 */
export function CodexSignIn({ getApi, t }: CodexSignInProps): ReactElement {
  const [remote, setRemote] = useState<RemotePhase>('connecting')
  const [status, setStatus] = useState<CodexStatus | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [answer, setAnswer] = useState('')
  const [copied, setCopied] = useState('')
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    // The shell renders this section by looking the entry up in the slot
    // ledger, so reaching this line means registration landed AND the settings
    // page selected it. Paired with the entry's own breadcrumb, it separates
    // "never registered" from "registered but never selected".
    console.info('[dsh-codex-oauth] card mounted in its settings section')
    return () => {
      mounted.current = false
    }
  }, [])

  /**
   * Re-read the whole state. Never throws at the caller.
   * @returns the status, or null when the host is not reachable yet.
   */
  const reload = useCallback(async (): Promise<CodexStatus | null> => {
    const api = getApi()
    if (api === undefined) {
      if (mounted.current) setRemote((phase) => (phase === 'missing' ? phase : 'connecting'))
      return null
    }
    if (mounted.current) setRemote('ready')
    try {
      const next = unwrap(await api.status())
      if (mounted.current) setStatus(next)
      return next
    } catch (error) {
      if (mounted.current) setFlash({ tone: 'error', text: messageOf(error) })
      return null
    }
  }, [getApi])

  // Wait for the namespace, then give up loudly. A card that says "connecting"
  // forever would be the same silence this state exists to remove.
  useEffect(() => {
    if (remote !== 'connecting') return undefined
    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async (): Promise<void> => {
      const next = await reload()
      if (cancelled || next !== null) return
      attempts += 1
      if (attempts >= CONNECT_ATTEMPTS) {
        setRemote('missing')
        console.warn(`[dsh-codex-oauth] the ${NAMESPACE} Remote namespace never appeared`)
        return
      }
      timer = setTimeout(() => { void tick() }, CONNECT_MS)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [remote, reload])

  const phase = phaseOf(status)

  // Follow one running attempt. The attempt itself lives on the host, so a
  // re-render, a closed panel or a reloaded page never loses it.
  useEffect(() => {
    if (phase !== 'running') return undefined
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async (): Promise<void> => {
      const next = await reload()
      if (cancelled) return
      if (next === null) return
      if (next.attempt.phase === 'running') {
        timer = setTimeout(() => { void tick() }, POLL_MS)
        return
      }
      setBusy(false)
      if (next.attempt.phase === 'authorized') setFlash({ tone: 'done', text: t('done') })
      else if (next.attempt.phase === 'cancelled') setFlash({ tone: 'notice', text: t('cancelled') })
    }
    timer = setTimeout(() => { void tick() }, POLL_MS)
    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [phase, reload, t])

  /** Run one host action, surfacing whatever it says. */
  const run = useCallback(async (action: (api: CodexApi) => Promise<unknown>): Promise<void> => {
    const api = getApi()
    if (api === undefined) {
      setRemote('missing')
      return
    }
    setBusy(true)
    setFlash(null)
    try {
      await action(api)
    } catch (error) {
      setFlash({ tone: 'error', text: messageOf(error) })
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [getApi])

  const start = (): void => {
    // A fresh attempt gets a fresh page: the URL differs per attempt anyway,
    // but clearing this keeps the auto-open honest if a host ever reuses one.
    opened.current = ''
    void run(async (api) => {
      const attempt = unwrap(await api.signIn())
      setAnswer('')
      await reload()
      if (attempt.phase === 'failed') setFlash({ tone: 'error', text: attempt.error ?? t('failed') })
    })
  }

  const send = (value: string): void => {
    void run(async (api) => {
      unwrap(await api.answer(value))
      setAnswer('')
      await reload()
    })
  }

  const cancel = (): void => {
    void run(async (api) => {
      unwrap(await api.cancel())
      setFlash({ tone: 'notice', text: t('cancelled') })
      await reload()
    })
  }

  const signOut = (): void => {
    if (!window.confirm(t('signOutConfirm'))) return
    void run(async (api) => {
      setStatus(unwrap(await api.signOut()))
      setFlash(null)
    })
  }

  /** Copy one string, marking which control did it for the acknowledgement. */
  const copy = useCallback((what: string, value: string): void => {
    void navigator.clipboard?.writeText(value).then(() => {
      if (!mounted.current) return
      setCopied(what)
      setTimeout(() => {
        if (mounted.current) setCopied('')
      }, 1500)
    }).catch((error: unknown) => {
      if (mounted.current) setFlash({ tone: 'error', text: messageOf(error) })
    })
  }, [])

  const noticeUrl = status?.attempt.notice?.url ?? null
  const noticeCode = status?.attempt.notice?.code ?? null

  // The flow tells the human a browser window should open, because the Codex
  // CLI it was written for opens one. Nothing in the harness does, so the card
  // opens it instead — once per distinct URL, and on a best-effort basis: a
  // popup the browser suppresses leaves the link and the copy button below
  // doing the job.
  const opened = useRef('')
  useEffect(() => {
    if (noticeUrl === null || noticeCode !== null) return
    if (opened.current === noticeUrl) return
    opened.current = noticeUrl
    try {
      window.open(noticeUrl, '_blank', 'noopener,noreferrer')
    } catch {
      // A blocked or unavailable popup is not a failure worth reporting; the
      // link is on screen either way.
    }
  }, [noticeUrl, noticeCode])

  const signedIn = status?.signedIn === true
  const running = phase === 'running'
  const ready = status?.ready !== false
  const canSignIn = ready && status?.flowAvailable === true
  const attempt = status?.attempt ?? null

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <span className={styles.title}>{t('title')}</span>
        <span className={styles.headSpacer} />
        <StateDot state={signedIn ? 'done' : running ? 'ongoing' : 'idle'} />
        <span className={styles.hint}>
          {running ? t('signingIn') : signedIn ? t('signedIn') : t('signedOut')}
        </span>
      </div>

      <div className={styles.body}>
        {remote === 'missing'
          ? <div className={styles.error}>{t('namespaceMissing')}</div>
          : status === null
            ? <div className={styles.hint}>{remote === 'connecting' ? t('connecting') : t('checking')}</div>
            : !ready
            ? <div className={styles.error}>{t('seamsMissing')}</div>
            : signedIn
              ? (
                  <>
                    <div className={styles.row}>
                      <span className={styles.label}>{t('account')}</span>
                      <span className={styles.value}>{status.accountId ?? t('unknown')}</span>
                    </div>
                    <div className={styles.row}>
                      <span className={styles.label}>{t('plan')}</span>
                      <span className={styles.value}>{planLabel(status.planType, t)}</span>
                    </div>
                    <div className={styles.row}>
                      <span className={styles.label}>{t('expires')}</span>
                      <span className={styles.value}>{timeLabel(status.expiresAt, t)}</span>
                    </div>
                  </>
                )
              : running && attempt !== null
                ? <AttemptBody attempt={attempt} t={t} onCopy={copy} copied={copied} answer={answer} onAnswerChange={setAnswer} onSend={send} busy={busy} />
                : <div className={styles.hint}>{status.flowAvailable ? t('signInHint') : t('flowMissing')}</div>}

        {status !== null && status.routeConfigured === false
          ? (
              <div className={styles.error}>
                <strong>{t('routeMissingTitle')}</strong>
                <br />
                {t('routeMissing')}
              </div>
            )
          : null}

        {phase === 'failed' && attempt?.error != null
          ? <div className={styles.error}>{`${t('failed')}：${attempt.error}`}</div>
          : null}

        {flash === null
          ? null
          : <div className={flash.tone === 'error'
            ? styles.error
            : flash.tone === 'done' ? styles.done : styles.notice}>{flash.text}</div>}
      </div>

      <div className={styles.actions}>
        {!ready || remote !== 'ready' ? null : signedIn
          ? <Button variant="outline" size="sm" disabled={busy} onClick={signOut}>{t('signOut')}</Button>
          : running
            ? <Button variant="outline" size="sm" disabled={busy} onClick={cancel}>{t('cancel')}</Button>
            : (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy || !canSignIn}
                  icon={busy ? <IconLoadingOutlineRegular size={16} className={styles.spin} /> : undefined}
                  onClick={start}
                >
                  {busy ? t('working') : t('signIn')}
                </Button>
              )}
        {!running && !signedIn && ready && remote === 'ready'
          ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => { void reload() }}>{t('retry')}</Button>
          : null}
      </div>
    </div>
  )
}

/** The body of a running attempt: what the flow last said, and what it asks. */
function AttemptBody(props: {
  attempt: AttemptView
  t: (key: MessageKey) => string
  answer: string
  busy: boolean
  copied: string
  onCopy: (what: string, value: string) => void
  onAnswerChange: (value: string) => void
  onSend: (value: string) => void
}): ReactElement {
  const { attempt, t, answer, busy, copied, onCopy, onAnswerChange, onSend } = props
  const notice = attempt.notice
  const prompt = attempt.prompt
  return (
    <>
      {notice?.code != null
        ? (
            <div className={styles.device}>
              <div className={styles.hint}>{notice.message.length > 0 ? notice.message : t('stepInBrowser')}</div>
              <code className={styles.code}>{notice.code}</code>
              {/* The address is shown as text, not as a label over a link. A
                  device code is what the flow offers when the browser is
                  somewhere else, so the one person reading this may not be able
                  to click anything here and has to type the address instead. */}
              {notice.url === null
                ? null
                : <a className={styles.link} href={notice.url} target="_blank" rel="noreferrer">{notice.url}</a>}
              <div className={styles.actions}>
                <Button variant="outline" size="sm" icon={<IconCopyOutlineRegular size={16} />} onClick={() => onCopy('code', notice.code ?? '')}>
                  {copied === 'code' ? t('copied') : t('copyCode')}
                </Button>
              </div>
            </div>
          )
        : notice?.url != null
          ? (
              <div className={styles.device}>
                {/* The flow's own message here is written for the Codex CLI,
                    which opens the browser itself ("A browser window should
                    open"). The harness does not, so repeating that line at a
                    user who is waiting for a window would be a lie — the card
                    opens the tab and says what to do if it did not. */}
                <div className={styles.hint}>{t('browserOpening')}</div>
                <div className={styles.actions}>
                  <a className={styles.link} href={notice.url} target="_blank" rel="noreferrer">{t('openPage')}</a>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<IconLinkOutlineRegular size={16} />}
                    onClick={() => onCopy('link', notice.url ?? '')}
                  >
                    {copied === 'link' ? t('copied') : t('copyLink')}
                  </Button>
                </div>
              </div>
            )
          : <div className={styles.hint}>{notice?.message != null && notice.message.length > 0 ? notice.message : t('signingIn')}</div>}

      {prompt === null
        ? null
        : prompt.kind === 'select' && prompt.options !== null
          ? (
              <div className={styles.choices}>
                <div className={styles.hint}>{prompt.message}</div>
                {prompt.options.map((option) => (
                  <Button
                    key={option.id}
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className={styles.choice}
                    onClick={() => onSend(option.id)}
                  >
                    <span>{option.label}</span>
                    {option.description === null ? null : <span className={styles.choiceHint}>{option.description}</span>}
                  </Button>
                ))}
              </div>
            )
          : (
              <div className={styles.choices}>
                {/* The question is rendered, not only carried on the input's
                    accessible name: a bare field with no visible prompt leaves
                    the reader guessing what to paste. */}
                <div className={styles.hint}>{prompt.message}</div>
                <form
                  className={styles.answerRow}
                  onSubmit={(event) => {
                    event.preventDefault()
                    onSend(answer)
                  }}
                >
                  <Input
                    type={prompt.kind === 'secret' ? 'password' : 'text'}
                    value={answer}
                    placeholder={prompt.placeholder ?? ''}
                    aria-label={prompt.message}
                    onChange={(event) => onAnswerChange(event.target.value)}
                  />
                  <Button type="submit" variant="outline" size="sm" disabled={busy}>{t('submit')}</Button>
                </form>
              </div>
            )}
    </>
  )
}

/**
 * The two tiers the subscription copy names, so they read as products.
 *
 * Everything else is deliberately not translated: those values are the
 * vendor's own tier identifiers, and putting a localised product name on one
 * would be inventing a plan that may not exist.
 */
const PLAN_MESSAGE: Partial<Record<string, MessageKey>> = {
  plus: 'planPlus',
  pro: 'planPro',
}

/**
 * The plan tier, as something a person can read.
 *
 * The claim is an internal identifier — `self_serve_business_prolite` is a real
 * one — and printing it verbatim makes a working card look broken. Known tiers
 * get their product name; the rest are formatted from the identifier itself
 * (separators to spaces, words capitalised), which is presentation, not a claim
 * about what the plan is called.
 */
function planLabel(planType: string | null, t: (key: MessageKey) => string): string {
  if (planType === null) return t('unknown')
  const message = PLAN_MESSAGE[planType]
  if (message !== undefined) return t(message)
  return planType
    .split(/[_-]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** An absolute expiry, or "unknown" when the grant carried none. */
function timeLabel(expiresAt: number | null, t: (key: MessageKey) => string): string {
  if (expiresAt === null || expiresAt <= 0) return t('unknown')
  return new Date(expiresAt).toLocaleString()
}

/** The message of a caught value, whatever it turned out to be. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The host module's members this card renders.
 *
 * They arrive through the page's platform seed table rather than through a
 * package this bundle can check at build time, so a host that renamed or
 * dropped one would hand the card an `undefined` component and the throw would
 * blank the whole settings dialog. The entry checks this list first and skips
 * registration instead — the card going missing is a smaller failure than the
 * page going missing.
 */
export const REQUIRED_PRIMITIVES = [
  'Button',
  'Input',
  'StateDot',
  'IconCopyOutlineRegular',
  'IconLinkOutlineRegular',
  'IconLoadingOutlineRegular',
] as const
