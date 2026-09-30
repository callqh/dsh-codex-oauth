/**
 * "Is the `openai-codex` route actually declared?"
 *
 * This is the one fact the plugin cannot read from either seam it already
 * uses, and it matters because it decides whether signing in is enough:
 * `llm-pi-ai`'s adapter is registered from the RESOLVED profiles, and its
 * `ensureRegistrationFacts()` returns early while no route is declared — so a
 * successful sign-in against a profile that names no `providers['openai-codex']`
 * produces a stored credential and no working route. Telling a user they are
 * signed in when the model list still refuses their request is the failure
 * this probe exists to prevent.
 *
 * Why not ask `llm-pi-ai` directly: it exports no service, and its config is
 * reached through the settings layer like any other entry's. `describe()` is
 * the read-only view the Models page itself is built from, keyed by the entry
 * id — which is `llm-pi-ai` for the built-in bundle row, and would follow a
 * user who renamed the row only if they also renamed the settings namespace,
 * which is the same string either way.
 *
 * The whole surface is optional. A composition without a settings service
 * reports `null` — "not known" — which the panel renders as silence rather
 * than as a warning, because a fact nobody could read is not a fault the user
 * can act on.
 *
 * @module dsh-codex-oauth/route
 */
import { PROVIDER_ID, RECORD_SCOPE } from "./flow.js";
/**
 * How long an answer is trusted. The client polls while a sign-in is in
 * flight, and `describe()` walks every config entry on the host, so the read
 * is memoized rather than repeated per poll. Five seconds is short enough that
 * a route a user adds in the Models page shows up on their next look, and long
 * enough that polling costs one walk per five seconds instead of one per
 * second.
 */
const TTL_MS = 5_000;
/**
 * A memoized, never-throwing read of "does this profile declare the route".
 *
 * Every failure mode collapses to `null`: no settings service, a `describe()`
 * that throws, a shape this build does not recognise. The panel shows nothing
 * for `null`, so an unreadable host degrades to a smaller card instead of a
 * broken one.
 */
export class RouteProbe {
    settingsOf;
    answer;
    readAt = 0;
    /**
     * @param settingsOf - resolves the host's settings service at read time.
     *   Resolved per read rather than captured, because the service arrives
     *   through an inject that fires after this probe is constructed.
     */
    constructor(settingsOf) {
        this.settingsOf = settingsOf;
    }
    /**
     * Whether the profile declares `providers['openai-codex']` for `llm-pi-ai`.
     * @returns true/false when the host answered, `null` when it could not.
     */
    read() {
        const now = Date.now();
        if (this.answer !== undefined && now - this.readAt < TTL_MS)
            return this.answer;
        this.answer = this.probe();
        this.readAt = now;
        return this.answer;
    }
    /** Drop the memo, so the next {@link read} walks the host again. */
    invalidate() {
        this.answer = undefined;
    }
    /** The read itself, with every throw folded into `null`. */
    probe() {
        const settings = this.settingsOf();
        if (settings === undefined)
            return null;
        try {
            const described = settings.describe({ redactSecrets: true });
            if (!Array.isArray(described))
                return null;
            const section = described.find((entry) => isRecord(entry) && entry.ns === RECORD_SCOPE);
            if (!isRecord(section))
                return false;
            const value = section['value'];
            if (!isRecord(value))
                return false;
            const providers = value['providers'];
            if (!isRecord(providers))
                return false;
            return Object.prototype.hasOwnProperty.call(providers, PROVIDER_ID);
        }
        catch {
            return null;
        }
    }
}
/** Whether a value is a plain, non-array object. */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
