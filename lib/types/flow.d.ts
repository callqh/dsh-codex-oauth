/**
 * Everything this plugin knows about the Codex sign-in it drives, and nothing
 * about how it works.
 *
 * These are facts about two upstreams, both read from the installed runtime
 * (0.2.0-rc.2) rather than assumed:
 *
 * - `llm-pi-ai` registers one authorization flow per INSTALLED CATALOG provider
 *   the moment it mounts — unconditionally on configuration, because a provider
 *   has to be signed into before a route for it is worth declaring. The key it
 *   registers under is `credentialKey('llm-pi-ai', providerId)`, and its method
 *   list comes from pi-ai's provider declaration: `oauth` for a provider whose
 *   `auth.oauth` exists, plus `api-key` only when that provider ships
 *   `auth.apiKey.login` at all. `openai-codex` is OAuth-only, so `oauth` is the
 *   only method it can offer.
 *
 * - pi-ai's `openaiCodexOAuth` writes `{ type: 'oauth', access, refresh,
 *   expires, accountId }` through `llm-pi-ai`'s credential store, which the
 *   seam keeps verbatim as a `kind: 'grant'` record's `payload`. `expires` is
 *   epoch milliseconds. `accountId` is pi-ai's own read of the
 *   `chatgpt_account_id` claim; it does not read a plan tier at all.
 *
 * None of this is a public contract, and all of it is versioned with the
 * runtime. When an upgrade renames a provider id or reshapes the grant, the
 * blast radius is sign-in: an already signed-in record keeps working, because
 * the request path reads the payload through pi-ai and never through here.
 *
 * @module dsh-codex-oauth/flow
 */
import { type CredentialKey, type CredentialRecord } from '@deepseek-ai/dsh-credentials';
/** The pi-ai provider id, which is also the harness route key and the record's id. */
export declare const PROVIDER_ID = "openai-codex";
/** The plugin that owns the record: `llm-pi-ai` writes it in pi-ai's format. */
export declare const RECORD_SCOPE = "llm-pi-ai";
/**
 * The credential record {@link PROVIDER_ID} is authorized into.
 *
 * The name and the record are addressed by the same key, which is what lets a
 * surface start the flow and read the result without either side agreeing on a
 * second name for it.
 */
export declare const FLOW_KEY: CredentialKey;
/** The one method an OAuth-only provider's flow offers. */
export declare const LOGIN_METHOD = "oauth";
/** What a stored grant says, projected down to what a settings panel may show. */
export interface GrantFacts {
    /** Whether an access token is present at all — the whole of "signed in". */
    readonly signedIn: boolean;
    /** pi-ai's own account id, verbatim. Masked before it crosses the wire. */
    readonly accountId: string | null;
    /** Plan tier, read from the token for display. Never used to make a decision. */
    readonly planType: string | null;
    /** Access-token expiry, epoch milliseconds. Display only — pi-ai owns refresh. */
    readonly expiresAt: number | null;
}
/**
 * Project a stored credential record into displayable facts.
 *
 * This reads a record whose payload was written by pi-ai and is owned by
 * pi-ai — it is deliberately tolerant: an unrecognised shape reads as signed
 * out rather than throwing, because the alternative is a settings page that
 * dies on a payload format it was never promised.
 *
 * @param record - the record stored for {@link FLOW_KEY}, or undefined.
 * @returns the facts; `signedIn: false` for anything this build cannot read.
 */
export declare function grantFacts(record: CredentialRecord | undefined): GrantFacts;
/**
 * Keep the ends of an account id and drop the middle.
 *
 * The panel has to name the account so a user can tell two apart; it does not
 * have to be a stable identifier anywhere, and a truncated one is not.
 * @param accountId - the account id, or null.
 * @returns the masked id, or null when there is nothing to name.
 */
export declare function maskAccountId(accountId: string | null): string | null;
