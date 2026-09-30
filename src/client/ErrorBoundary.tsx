/**
 * Keep one throwing card from taking the settings dialog with it.
 *
 * A slot entry's component is rendered by the host's own tree, so an exception
 * during render propagates into the dialog that owns the slot and the user
 * loses the whole page — not just this card. The boundary is deliberately the
 * smallest thing that can work: it renders the failure in place, in the
 * card's own words, and offers nothing it cannot deliver.
 *
 * @module dsh-codex-oauth/client/ErrorBoundary
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './CodexSignIn.module.css'

/** What the boundary renders when it catches. */
export interface ErrorBoundaryLabels {
  readonly title: string
  readonly retry: string
}

/** Props for {@link CardErrorBoundary}. */
export interface CardErrorBoundaryProps {
  readonly labels: ErrorBoundaryLabels
  readonly children?: ReactNode
}

/** The boundary's own state: the message it caught, if any. */
interface CardErrorBoundaryState {
  readonly message: string | null
}

/**
 * Render `children`, or the failure that replaced them.
 *
 * React only routes render-time throws to the nearest boundary in the same
 * tree; this is that boundary for one card, and it is per-entry so a broken
 * Codex card cannot affect any other provider's row.
 */
export class CardErrorBoundary extends Component<CardErrorBoundaryProps, CardErrorBoundaryState> {
  override state: CardErrorBoundaryState = { message: null }

  /**
   * @param error - what the subtree threw.
   * @returns the state that replaces the subtree.
   */
  static getDerivedStateFromError(error: unknown): CardErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  /**
   * Report the failure where a developer can see it.
   * @param error - what the subtree threw.
   * @param info - React's component stack.
   */
  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[dsh-codex-oauth] the Codex sign-in card failed to render', error, info.componentStack)
  }

  /**
   * @returns the card, or its failure notice.
   */
  override render(): ReactNode {
    const { labels, children } = this.props
    const { message } = this.state
    if (message === null) return children
    return (
      <div className={styles.root}>
        <div className={styles.error}>{`${labels.title}：${message}`}</div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.hint}
            onClick={() => this.setState({ message: null })}
          >
            {labels.retry}
          </button>
        </div>
      </div>
    )
  }
}
