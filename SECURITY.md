# Security

## What this plugin can reach

It runs inside the Harness host process, so it can reach whatever the host can.
The question worth answering is what it *does* reach, and that is deliberately
small: three Cordis services, and nothing else.

| Service | Used for | Not used for |
|---|---|---|
| `ctx.authorization` | starting, cancelling and observing the `openai-codex` flow | registering a flow of its own |
| `ctx.credentials` | reading one record's presence for display; deleting it on sign-out | writing, copying or rotating anything |
| `ctx.settings` | one read-only `describe()` to see whether the route is declared | any write |

No filesystem access, no network calls, no child processes, no environment
reads. The only outbound traffic in the whole sign-in is pi-ai's, inside
`ctx.authorization.begin()`.

## Where the credential lives

One record, in the harness credential store, under the key
`llm-pi-ai/openai-codex`. Its payload is written by pi-ai in pi-ai's format and
is opaque to this plugin — it is read only to project an account id, a plan tier
and an expiry, and only for display.

There is no second copy. In particular this plugin does **not** write an API key,
does not use the `apiKeyEnv` route, and does not touch `~/.codex/auth.json`.

## What crosses to the browser

`status()` returns:

```
ready, signedIn, accountId (masked), planType, expiresAt,
routeConfigured, flowAvailable, flowLabel,
attempt: { phase, notice: { message, url, code }, prompt, error }
```

`accountId` is truncated **on the host** (`acct-012…cdef`), so the full value has
no path to the wire. `planType` is a tier name. No token, no refresh token, no
signing material, and no unredacted record is ever returned.

The `notice.code` field is the device-code the human has to type — it is shown on
screen by design, not a secret.

## The one place a token is touched

`grantFacts()` base64-decodes the access token's middle segment to read
`https://api.openai.com/auth.chatgpt_plan_type` for the plan label. That decode
happens on the host, its result is a tier string, and **nothing in this plugin
makes a decision from it** — not refresh, not expiry, not validity. The decode is
wrapped so a token that is not a JWT yields `null` rather than an exception.

## Failure modes that are deliberately contained

- **A missing seam does not fail the boot.** `authorization` and `credentials`
  arrive through nested injects rather than a `static inject`. On a profile
  bundle an entry that never activates fails the whole application start, so the
  plugin always activates and reports what it cannot do (`status().ready`).
- **A settings service that throws is not a fault the user sees.** The route
  probe folds every failure into `null`, which the card renders as silence.
- **A crash while rendering stays in one row.** The card is wrapped in an error
  boundary, because an exception in a slot entry otherwise blanks the whole
  settings dialog.
- **A host missing a UI primitive disables the card instead of rendering it.**
  The primitives are reached through the page's module table, so a rename would
  hand the card an `undefined` component; the entry checks first.

## Third-party surface

The sign-in runs against the **official Codex CLI's** OAuth endpoints and its
`client_id`, including `https://auth.openai.com/api/accounts/deviceauth/*`, which
is not a published OAuth endpoint. Availability and terms are OpenAI's call, and
this plugin cannot mitigate a change on their side.

It also shares one OAuth session with any installed Codex CLI: whichever side
refreshes can invalidate the other's older refresh token. That is a consequence
of using the same client, not something this plugin can avoid.

## Reporting

This is a local, private package. If it is ever published, file issues on the
repository rather than opening a public issue for anything credential-shaped.
