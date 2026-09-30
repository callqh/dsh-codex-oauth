/**
 * The card's two dictionaries.
 *
 * Written to one rule: every line has to answer "so what?". A state says what
 * is true, a failure says what happened and what to do about it, and anything
 * a user cannot act on does not appear at all. The one exception is the
 * advanced note about the profile route, which is only rendered when the host
 * actually reports the route missing — a state the user can fix.
 *
 * @module dsh-codex-oauth/client/locales
 */

/** The locale namespace this plugin registers its dictionaries under. */
export const NS = 'codex-oauth'

export const zh = {
  nav: 'Codex 登录',
  title: 'OpenAI Codex',
  subtitle: 'ChatGPT Plus / Pro 订阅',
  signedIn: '已登录',
  signedOut: '未登录',

  account: '账号',
  plan: '套餐',
  expires: '登录有效期至',
  unknown: '未知',
  planPlus: 'Plus',
  planPro: 'Pro',

  signIn: '使用 ChatGPT 账号登录',
  signInHint: '用已有的 ChatGPT 订阅登录，不需要 API Key。',
  signingIn: '等待浏览器完成登录…',
  stepInBrowser: '在浏览器里打开下面的地址，输入设备代码：',
  openPage: '打开授权页面',
  copyCode: '复制代码',
  copyLink: '复制链接',
  copied: '已复制',
  browserOpening: '授权页面会在新标签页打开。如果没有自动打开，点下面的链接，或复制后手动打开。',
  submit: '提交',
  cancel: '取消登录',
  signOut: '退出登录',
  signOutConfirm: '退出后需要重新登录才能继续使用 Codex 模型。确定退出吗？',

  checking: '正在读取登录状态…',
  connecting: '正在连接 Harness…',
  namespaceMissing: '连不上 Harness 的登录服务（codexAuth）。插件已加载，但主进程没有把接口挂上——请把控制台里 [dsh-codex-oauth] 开头的日志发出来。',
  working: '处理中…',

  done: '登录成功。Codex 模型现在可以使用了。',
  cancelled: '已取消登录，没有产生任何凭证。',
  failed: '登录没有完成',

  seamsMissing: 'Harness 的授权或凭证服务没有挂载，这台机器上无法完成登录。',
  flowMissing: '当前的 Harness 版本没有为 Codex 注册登录入口，无法发起登录。这通常意味着 llm-pi-ai 未挂载，或它的目录里没有 openai-codex。',
  routeMissingTitle: 'Codex 路由尚未在配置里声明',
  routeMissing: '登录本身可以完成，但 Harness 还不会把请求发给 Codex——profile 里缺少 llm-pi-ai 的 providers["openai-codex"]。在「模型」设置里添加该供应商（留空即用订阅登录，不需要 API Key），然后回到这里。',
  retry: '重试',
} as const

export const en = {
  nav: 'Codex sign-in',
  title: 'OpenAI Codex',
  subtitle: 'ChatGPT Plus / Pro subscription',
  signedIn: 'Signed in',
  signedOut: 'Not signed in',

  account: 'Account',
  plan: 'Plan',
  expires: 'Sign-in valid until',
  unknown: 'Unknown',
  planPlus: 'Plus',
  planPro: 'Pro',

  signIn: 'Sign in with ChatGPT',
  signInHint: 'Uses the ChatGPT subscription you already have. No API key needed.',
  signingIn: 'Waiting for the browser to finish…',
  stepInBrowser: 'Open this address in your browser and enter the device code:',
  openPage: 'Open authorization page',
  copyCode: 'Copy code',
  copyLink: 'Copy link',
  copied: 'Copied',
  browserOpening: 'The authorization page opens in a new tab. If it did not, use the link below or copy it.',
  submit: 'Submit',
  cancel: 'Cancel sign-in',
  signOut: 'Sign out',
  signOutConfirm: 'After signing out you will need to sign in again to use Codex models. Sign out?',

  checking: 'Reading sign-in state…',
  connecting: 'Connecting to Harness…',
  namespaceMissing: 'Cannot reach the Harness sign-in service (codexAuth). The plugin loaded, but the host did not publish the interface — please share the console lines starting with [dsh-codex-oauth].',
  working: 'Working…',

  done: 'Signed in. Codex models are ready to use.',
  cancelled: 'Sign-in cancelled. Nothing was stored.',
  failed: 'Sign-in did not finish',

  seamsMissing: 'This Harness has no authorization or credential service mounted, so signing in is not possible here.',
  flowMissing: 'This Harness build registered no sign-in flow for Codex, so one cannot be started. That usually means llm-pi-ai is not mounted, or its catalog ships no openai-codex.',
  routeMissingTitle: 'The Codex route is not declared yet',
  routeMissing: 'Signing in will work, but Harness still will not route requests to Codex: the profile declares no providers["openai-codex"] for llm-pi-ai. Add that provider in Models settings (leave it empty — the subscription sign-in needs no API key), then come back.',
  retry: 'Retry',
} as const

/** Every key the card renders, so a missing translation is a type error. */
export type MessageKey = keyof typeof zh

/**
 * Bind one dictionary lookup to a locale service.
 *
 * The service's own `bind` returns a function typed against an open string
 * key; this narrows it so a typo in a key is caught at build time instead.
 * @param bind - the dictionary lookup the locale service returned.
 * @returns a lookup restricted to {@link MessageKey}.
 */
export function bindMessages(bind: (key: string) => string): (key: MessageKey) => string {
  return (key) => bind(key)
}
