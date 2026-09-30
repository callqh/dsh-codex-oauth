# dsh-codex-oauth

**在 DeepSeek Harness 里用 ChatGPT Plus / Pro 订阅登录 OpenAI Codex。**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.0--rc.2-4B6EF5)](https://github.com/deepseek-ai/deepseek-harness)

[English](README.md) | 中文

Harness 其实已经把 Codex 该有的都带上了：OAuth 流程、token 刷新、凭证存储、连
`chatgpt.com/backend-api` 的传输层。唯独缺一个发起登录的入口——`openai-codex` 的
flow 早就注册好了，但没有任何地方去调它。

这个插件就是那一行调用，仅此而已。它不实现 OAuth，不存 token，也不管刷新。

## 交给 AI 装

把下面这段丢给 Harness 里的 agent：

```text
请为我现在使用的 profile 安装这个 DeepSeek Harness 插件：
https://github.com/callqh/dsh-codex-oauth
装完做验证。确切步骤在那个仓库的 INSTALL.md 里。

硬性要求：
- 只动 ~/.dsh/profiles/ 下我正在用的那一个 profile，改任何文件前先备份。
- openai-codex 路由必须保持 KEYLESS：providers: { "openai-codex": {} }。
  绝对不要加 apiKeyEnv —— 那会把 ChatGPT 订阅认证换成 API Key。
- 如果我的 profile 是 `desktop`，dsh CLI 拒绝管理它，请用应用内的插件管理器。
- 不要自己重启 Harness，告诉我什么时候重启。

做完汇报：你找到的 profile 与版本、你改了什么、怎么装的、我应该在
「设置 -> Codex 登录」里看到什么，以及任何失败的原文错误信息。
```

想自己动手、或者要核对它干了什么，完整步骤在 **[INSTALL.zh.md](INSTALL.zh.md)**。

## 安装

**1. 加一条 keyless 路由。** 在 `~/.dsh/profiles/<profile>/cordis.patch.yml` 里加：

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      openai-codex: {}
```

值必须是空的。空值才会保留供应商自己的认证方式，而 `openai-codex` 用的就是 pi-ai 的
ChatGPT OAuth。这里写上 `apiKeyEnv`，认证就变成 API Key 了，订阅登录随即失效。

**2. 装插件。** 桌面端用应用内的插件管理器——CLI 不管理那个 profile。其它情况：

```sh
dsh plugin --profile web add github:callqh/dsh-codex-oauth
```

**3. 重启。** profile 的 bundle 列表是启动时组装的，不重启不会加载。

## 用法

打开 **设置 → Codex 登录**。

![Codex 登录，未登录状态](assets/screenshot-settings.png)

点按钮，选登录方式：**浏览器登录**（默认，授权页会在新标签页打开，回调落到
`127.0.0.1:1455`）或者 **设备码**（浏览器不在这台机器上时用）。

登录后卡片会显示脱敏账号、套餐和 token 有效期，而且不用刷新页面就会切过去。点退出
登录就把凭证删掉。

## 验证到什么程度

- `npm test` —— 44 个用例，五条泳道。
- `npm run stage-verify -- --browser` —— 在一个由真实 profile 补丁层搭出来的一次性
  profile 里跑 26 项检查，其中包括对真实 flow 发起两条登录分支再撤回，以及用真实
  浏览器把卡片渲染出来。
- 本机已经完成过一次真实的 ChatGPT 授权，卡片能把那份凭证读回来。

**还没验证的：向 Codex 模型发一条真实请求。** 如果你正好卡在这里，欢迎开 issue。
细节见 [VERIFICATION.md](VERIFICATION.md)。

## 出问题了

卡片不会白屏，每一条提示都对应一个明确的原因：

| 卡片显示 | 含义 |
|---|---|
| 「正在连接 Harness…」 | 宿主接口还没发布，约 2 秒后会放弃并报错 |
| 「连不上 Harness 的登录服务」 | bundle 加载了，但宿主拒绝了它的 Remote contribution |
| 「Codex 路由尚未在配置里声明」 | 缺第 1 步——卡片会把要加的 YAML 打出来 |
| 「界面组件缺失 …」 | 宿主重命名了某个 UI primitive |

真正的原因在浏览器控制台里，日志以 `[dsh-codex-oauth]` 开头，最后一条会告诉你它走
到了哪一步。

如果装完 Harness 起不来：从 profile 的 `package.json` 里把 `"dsh-codex-oauth"` 从
`dsh.profile.bundles` 中删掉，然后重启。这是本插件唯一可能让应用起不来的地方。
[INSTALL.zh.md](INSTALL.zh.md) 里有完整说明。

## 开发

```sh
pnpm install
npm run check     # 类型检查（宿主 + 客户端）→ 构建 → 预检断言
npm test
```

`src/` 是 TypeScript，`lib/` 和 `client/client.js` 是构建产物，两个都提交进仓库了
——因为 `dsh.profile.bundles` 里的 bundle 一旦导入失败，整个应用都起不来。改完
`src/` 下任何东西，跑一次 `npm run check`。

如果你也在写 client bundle，有个坑值得知道：官方 `@deepseek-ai/*` 的 peer 范围必须
带一个显式的预发布分支（`>=0.2.0-rc.2 <0.3.0-0 || >=0.3.0-0`）。node-semver 只在
范围里某个比较符与该版本的 `major.minor.patch` 完全一致时才放行预发布版，所以看起来
很宽的范围会把所有 `-rc` 静默排除掉。

## 安全

token 只留在宿主侧。凭证只存一份——harness 凭证库里 `llm-pi-ai/openai-codex` 那条
记录，由 pi-ai 按它自己的格式写入——浏览器端只拿得到脱敏账号、套餐等级和有效期。
完整边界见 [SECURITY.md](SECURITY.md)。

## 许可

[MIT](LICENSE)
