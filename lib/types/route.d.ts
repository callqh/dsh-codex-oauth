/**
 * The slice of `ctx.settings` this probe touches.
 *
 * Declared structurally on purpose: the plugin takes no dependency on the
 * settings package, so a host that reshapes or drops it costs this probe its
 * answer and nothing else.
 */
export interface SettingsLike {
    describe(options?: {
        readonly redactSecrets?: boolean;
    }): unknown;
}
/**
 * A memoized, never-throwing read of "does this profile declare the route".
 *
 * Every failure mode collapses to `null`: no settings service, a `describe()`
 * that throws, a shape this build does not recognise. The panel shows nothing
 * for `null`, so an unreadable host degrades to a smaller card instead of a
 * broken one.
 */
export declare class RouteProbe {
    private readonly settingsOf;
    private answer;
    private readAt;
    /**
     * @param settingsOf - resolves the host's settings service at read time.
     *   Resolved per read rather than captured, because the service arrives
     *   through an inject that fires after this probe is constructed.
     */
    constructor(settingsOf: () => SettingsLike | undefined);
    /**
     * Whether the profile declares `providers['openai-codex']` for `llm-pi-ai`.
     * @returns true/false when the host answered, `null` when it could not.
     */
    read(): boolean | null;
    /** Drop the memo, so the next {@link read} walks the host again. */
    invalidate(): void;
    /** The read itself, with every throw folded into `null`. */
    private probe;
}
