# Install and usage

Step-by-step setup for **dsh-codex-oauth**. The [README](README.md) explains
what the plugin is and how it works; this file is only about getting it running.

If you would rather not do this by hand, [there is a prompt at the
bottom](#doing-this-with-an-ai-agent) you can hand to your Harness agent.

- [What you need](#what-you-need)
- [1. Find your profile](#1-find-your-profile)
- [2. Declare the route](#2-declare-the-route)
- [3. Install the plugin](#3-install-the-plugin)
- [4. Restart](#4-restart)
- [5. Check the card](#5-check-the-card)
- [6. Sign in](#6-sign-in)
- [7. Use the Codex models](#7-use-the-codex-models)
- [Uninstall](#uninstall)
- [Troubleshooting](#troubleshooting)
- [Doing this with an AI agent](#doing-this-with-an-ai-agent)

## What you need

- **DeepSeek Harness `0.2.0-rc.2`** — the line this plugin is built and verified
  against. Run `dsh --version` or read the version in **Settings → General**.
- A **ChatGPT Plus or Pro** subscription.
- Write access to your DSH home (`~/.dsh` by default, or `$DSH_HOME`).

## 1. Find your profile

A profile is a directory under `~/.dsh/profiles/`. Which one you are using
decides how the plugin gets installed.

| Where you are running | Profile | Install route |
|---|---|---|
| The Desktop app (Electron) | `desktop` | the in-app plugin manager |
| `dsh web` from a terminal | `web` (or whatever you passed to `--profile`) | the CLI |
| `dsh headless …` | same | the CLI |

Not sure? The Desktop app always uses `desktop`. From a terminal, the profile is
the name after `--profile`, and `dsh` with no flag boots `web`.

```sh
ls ~/.dsh/profiles/
```

## 2. Declare the route

Add this entry to your profile's `cordis.patch.yml`
(`~/.dsh/profiles/<profile>/cordis.patch.yml`):

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      openai-codex: {}
```

That file is a YAML list. Append the entry at the end, at the same indentation
as the entries already there. If an `- id: llm-pi-ai` entry already exists, add
the `openai-codex: {}` line under its existing `providers:` instead of creating a
second one.

**Back it up first** — a malformed patch file stops the profile from booting:

```sh
cp ~/.dsh/profiles/<profile>/cordis.patch.yml \
   ~/.dsh/profiles/<profile>/cordis.patch.yml.bak-$(date +%s)
```

### Why the empty value matters

`{}` is a **keyless** route: it keeps the provider's own authentication, which
for `openai-codex` is pi-ai's ChatGPT OAuth — the grant the sign-in writes.

Adding an `apiKeyEnv` instead replaces that with an API key. The sign-in will
still appear to work and the models will stop authenticating.

Without this entry the Models page has no `openai-codex` row at all, and
`llm-pi-ai` never registers its adapter for the route, so a successful sign-in
would leave you with a stored credential and nothing that uses it. The card says
so, in those words, if it finds the route missing.

## 3. Install the plugin

Both build outputs (`lib/` and `client/client.js`) are committed to the
repository, so **there is no build step and nothing to approve at install time**.

### Desktop → the plugin manager

The Desktop app owns the `desktop` profile and its CLI refuses to manage it:

```
$ dsh plugin --profile desktop add dsh-codex-oauth
error: profile "desktop" is managed exclusively by the Electron application
```

Open **Settings → Built-in plugins** (or the Plugins entry in the sidebar) and
install from the repository URL or a local checkout. Then continue to
[step 4](#4-restart).

### CLI-managed profiles → `dsh plugin add`

`dsh plugin` is a passthrough to `pnpm` inside the profile, so it takes the same
specifiers:

```sh
# from GitHub
dsh plugin --profile web add github:callqh/dsh-codex-oauth

# from npm
dsh plugin --profile web add dsh-codex-oauth
```

### By hand

If neither route is available, a profile is just a directory with a
`package.json`:

```sh
cd ~/.dsh/profiles/<profile>
cp package.json package.json.bak-$(date +%s)
```

Add `"dsh-codex-oauth"` to `dsh.profile.bundles`, and the dependency:

```jsonc
{
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-codex-oauth"]
    }
  },
  "dependencies": {
    "dsh-codex-oauth": "github:callqh/dsh-codex-oauth"
  }
}
```

```sh
pnpm install
```

## 4. Restart

A profile's bundle list is composed **at process start**, so the plugin is not
loaded until Harness restarts. Quit and reopen — for the Desktop app that means
quitting the application, not reloading the window.

## 5. Check the card

Open **Settings → Codex sign-in**. You should see:

![Codex sign-in, not signed in](assets/screenshot-settings.png)

"The Codex route is not declared yet" instead means step 2 did not take effect —
the card prints the exact YAML to add. Any other red text names what is missing.
See [Troubleshooting](#troubleshooting).

## 6. Sign in

Press **Sign in with ChatGPT**. The flow asks which method you want:

### Browser login (default)

The authorization page opens in a new tab, and the callback is caught on the
host at `127.0.0.1:1455`. Complete the login there; the card flips to signed in
within about a second, with no page refresh.

While it waits, the card also offers a link and a **Copy link** button for when
the tab did not open.

### Device code login

Choose it if the browser is on another machine. The card shows a `XXXX-XXXX`
code and the address to enter it on, with a copy button.

> This method needs **"Enable device code authorization for Codex"** turned on in
> ChatGPT → Settings → Account security & login. The default browser login does
> not need it.

### What success looks like

- **Account** — masked, e.g. `a1b2c3d4…9f0e`. The full value never leaves the host.
- **Plan** — your subscription tier.
- **Sign-in valid until** — the access token's expiry.

Signing out deletes the stored credential. Nothing else is left behind.

## 7. Use the Codex models

Pick a model whose provider is `openai-codex` in the model selector and send a
message. If the route is configured and the credential is stored, it just works —
there is no per-session setup.

## Uninstall

1. **Sign out** in the card, so the credential is deleted.
2. Remove `dsh-codex-oauth` from the profile's `dsh.profile.bundles` and its
   `dependencies` (or use the plugin manager), then `pnpm install`.
3. Restart.

Nothing else is written: no config outside the profile, no files in your
workspace.

## Troubleshooting

The card never goes blank and never fails silently.

| What you see | What it means | What to do |
|---|---|---|
| "Connecting to Harness…" | The host interface has not been published yet | Wait a second; it gives up after ~2s |
| "Cannot reach the Harness sign-in service" | The client bundle loaded but the host refused its Remote contribution | Open the browser console and read the `[dsh-codex-oauth]` lines |
| "ui-primitives module is missing …" | A host build that renamed a UI primitive | Report it with your Harness version |
| "The Codex route is not declared yet" | Step 2 is missing | Add the YAML shown on the card, restart |

Everything the client half does is logged under a `[dsh-codex-oauth]` prefix in
the browser console. The last line it prints says how far it got:

```
[dsh-codex-oauth] client apply
[dsh-codex-oauth] Remote namespace "codexAuth" mounted
[dsh-codex-oauth] slot "settings.section" is declared; adding the codex-oauth section
[dsh-codex-oauth] card mounted in its settings section
```

### The application will not start after installing

A bundle in `dsh.profile.bundles` that cannot be imported fails the whole boot.
The failure dialog offers to disable third-party plugins and restore the profile
patch; that works. To fix it by hand instead, remove `"dsh-codex-oauth"` from
`dsh.profile.bundles` in the profile's `package.json` (leave the `dependencies`
entry — it is harmless) and restart.

Keep the `*.bak-<timestamp>` copies you made in steps 1 and 2 for exactly this.

## Doing this with an AI agent

Everything above is mechanical. Paste this into your Harness agent and let it do
the work:

```text
Install and set up the DeepSeek Harness plugin at
https://github.com/callqh/dsh-codex-oauth for the profile I am running,
then verify it. Read INSTALL.md in that repository first.

Ground rules:
- Work only on my profile under ~/.dsh/profiles/. Do not touch any other profile.
- Before editing that profile's cordis.patch.yml or package.json, copy it to
  <same name>.bak-<epoch-ms> and tell me you did.
- The openai-codex route must stay KEYLESS: `providers: { "openai-codex": {} }`.
  Never add apiKeyEnv to it — that swaps the ChatGPT subscription auth for an
  API key and breaks the sign-in.
- If my profile is `desktop`, the dsh CLI refuses to manage it. Install through
  the in-app plugin manager instead of editing files by hand.
- Do not restart Harness yourself. Tell me when to, and stop there.
- Do not add, remove, or upgrade anything else.

When you are done, report:
1. which profile and which Harness version you found;
2. whether the route was already declared, and exactly what you changed;
3. how you installed the plugin, with the exact command or action;
4. what I should see in Settings -> Codex sign-in;
5. anything that failed, quoted verbatim.
```
