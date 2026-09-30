# dsh-codex-oauth

**在 DeepSeek Harness 里，用你已有的 ChatGPT Plus / Pro 订阅登录 OpenAI Codex。**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.0--rc.2-4B6EF5)](https://github.com/deepseek-ai/deepseek-harness)
[![Topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin)
[![Bilingual](https://img.shields.io/badge/docs-%E4%B8%AD%E6%96%87%20%7C%20EN-lightgrey)](README.md)

[English](README.md) | 中文

---

DeepSeek Harness 已经具备跑 Codex 的全部能力：浏览器与设备码两套 OAuth 流程、
令牌刷新、凭证存储，以及直连 `chatgpt.com/backend-api` 的传输层。它缺的只是
**一个能发起登录的界面**——在整个安装里，`ctx.authorization.begin()` 只有一个
调用方，而那个属于 DeepSeek 自家账号。`openai-codex` 的流程被注册了，没人点火。

这个插件就是那个开关，仅此而已。它不实现 OAuth、不存储令牌、不拥有刷新循环。

## 目录

- [环境要求](#环境要求)
- [安装](#安装)
- [交给 AI agent 做](#交给-ai-agent-做)
- [使用](#使用)
- [工作原理](#工作原理)
- [兼容性](#兼容性)
- [排错](#排错)
- [开发](#开发)
- [安全](#安全)
- [许可](#许可)

## 环境要求

| | |
|---|---|
| DeepSeek Harness | `0.2.0-rc.2` —— 本插件构建与验证所针对的版本线 |
| 运行面 | 任何挂载了 `dsh-base` 的 profile（桌面端、`web`、headless） |
| 账号 | ChatGPT Plus 或 Pro 订阅 |
| Profile 配置 | 一条 **keyless** 的 `openai-codex` 路由 —— 见下 |

## 安装

这里是简版。**完整步骤在 [INSTALL.zh.md](INSTALL.zh.md)** —— 每条命令、每一步该看到
什么、以及不对时怎么办。

### 1. 声明路由

把这段加到 profile 的 `cordis.patch.yml`
（`~/.dsh/profiles/<profile>/cordis.patch.yml`）：

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      openai-codex: {}
```

空值就是 **keyless**：保留供应商自己的认证方式，也就是 pi-ai 的 ChatGPT
OAuth——正是本插件写进去的那份授权。

**不要给它写 `apiKeyEnv`。** 那会把认证换成 API Key，订阅登录随即失效。路由缺失
或写错时，卡片会说明原因，并把上面这段原样再给一次。

### 2. 安装插件

**通过插件管理器**（桌面端，以及任何你不想手工改的 profile）：打开
设置 → 插件，从仓库地址或本地目录安装。桌面端的 profile 由 Electron 应用独占，
它的 CLI 拒绝管理该 profile，所以在桌面端这是唯一途径。

**通过命令行**（`web`、headless 等由 CLI 管理的 profile）：

```sh
# 从 GitHub 安装
dsh plugin --profile web add github:callqh/dsh-codex-oauth

# 或从 npm 安装
dsh plugin --profile web add dsh-codex-oauth
```

然后重启 Harness。profile 的 bundle 列表在进程启动时组装，不支持热加载。

## 使用

打开 **设置 → Codex 登录**。

![Codex 登录，未登录状态](assets/screenshot-settings.png)

未登录时只有一个按钮。点下去之后，流程会先问你想用哪种登录方式：

- **浏览器登录**（默认）—— 授权页面在新标签页打开，回调由主机侧的
  `127.0.0.1:1455` 接住。通常不需要手工粘任何东西。
- **设备码登录** —— 卡片显示 `XXXX-XXXX` 和要输入它的地址，适合浏览器不在本机的情况。

浏览器那一步完成后，卡片会在一秒左右变成已登录——**不需要刷新页面**——显示脱敏
账号、套餐等级和令牌有效期。点 **退出登录** 会删除凭证记录。

浏览器端任何时候都拿不到 access / refresh 令牌明文。

## 交给 AI agent 做

[INSTALL.zh.md](INSTALL.zh.md) 里的每一步都是机械操作。把下面这段贴进你的 Harness
agent 让它做：

```text
请为我现在使用的 profile 安装并配置这个 DeepSeek Harness 插件：
https://github.com/callqh/dsh-codex-oauth
装完做验证。先读那个仓库里的 INSTALL.md。

硬性要求：
- 只动 ~/.dsh/profiles/ 下我正在用的那一个 profile，不要碰其它 profile。
- 改那个 profile 的 cordis.patch.yml 或 package.json 之前，先复制一份到
  同名 .bak-<epoch-ms>，并告诉我你做了备份。
- openai-codex 路由必须保持 KEYLESS：`providers: { "openai-codex": {} }`。
  绝对不要给它加 apiKeyEnv —— 那会把 ChatGPT 订阅认证换成 API Key，登录就废了。
- 如果我的 profile 是 `desktop`，dsh CLI 拒绝管理它。请改用应用内的插件管理器，
  不要手工改文件。
- 不要自己重启 Harness。告诉我什么时候重启，然后就停在那里。
- 不要增删或升级其它任何东西。

做完请汇报：
1. 你找到的是哪个 profile、哪个 Harness 版本；
2. 路由是否已存在，以及你具体改了什么；
3. 你用哪种方式安装的插件，附上确切命令或操作；
4. 我应该在「设置 -> Codex 登录」里看到什么；
5. 任何失败，原文引用错误信息。
```

## 工作原理

四项能力属于 Harness，插件只负责把它们接起来。

| 能力 | 归属 | 本插件做的事 |
|---|---|---|
| OAuth 协议 | pi-ai（`openai-codex` 供应商） | 调用它 |
| 与人对话 | `ctx.authorization` | 渲染 notice 与 prompt |
| 凭证记录与刷新 | `ctx.credentials` | 只读存在性，退出时删除 |
| 模型传输 | pi-ai → `chatgpt.com/backend-api` | 什么都不做 |

插件对外只有五个 Remote 方法——`status`、`signIn`、`answer`、`cancel`、
`signOut`——和一个设置分区。全部内容就是这些。

**刻意不做的：** 读取、复制或解析令牌；刷新令牌；判断令牌是否过期；写 profile
配置；导入 `~/.codex/auth.json`；多账号。

## 兼容性

针对 **DeepSeek Harness `0.2.0-rc.2`** 构建与验证。

### 依赖的上游内部标识

这些都不是公开契约，会随运行时变动。影响范围仅限**登录**：请求路径读的是 pi-ai
自己的 payload，不经过本插件。

| 标识 | 值 | 来源 |
|---|---|---|
| flow 键 | `llm-pi-ai/openai-codex` | `dsh-llm-pi-ai` 的 `recordKeyFor(providerId)` |
| 方法 id | `oauth` | `loginMethods()` 对 `auth.oauth` 的命名 |
| grant 结构 | `{ type: 'oauth', access, refresh, expires, accountId }` | pi-ai 的 `credentialsFromToken()` |
| 设置分区槽 | `settings.section` | shell |
| 平台种子表 | `react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-ui-primitives` | Web 前端的 `staticModules` |

### 预发布 peer 范围的坑

官方 `@deepseek-ai/*` 包用带显式预发布分支的范围声明：

```jsonc
"@deepseek-ai/dsh-authorization": ">=0.2.0-rc.2 <0.3.0-0 || >=0.3.0-0"
```

不是为了好看，而是因为 node-semver 只在该范围里**某个**比较符与该版本的
`major.minor.patch` 元组完全一致、且自身带预发布标签时，才放行预发布版本。看起来
很宽的范围——`>=0.0.1-rc.1 <0.2.0`，甚至 `>=0.0.0-0 <0.2.0-0`——会**静默排除**
所有预发布构建。上面这条范围放行 `0.2.0-rc.2`、整条 `0.2` 线，以及 `0.3.0-rc.1`；
再往后的版本线预发布需要再加一个 `||` 分支，而 `scripts/preflight.mjs` 会在已解析
的运行时不再被接受时直接让构建失败。

### 已验证

自动化泳道覆盖了构建、五条泳道共 44 个用例，以及在一个由真实 profile 补丁层搭出的
一次性 profile 里跑的 26 项检查——其中包括对**两条**登录分支各真实发起一次再撤回、
127.0.0.1:1455 回调服务器确实在监听、取消后端口被释放，以及**在真实浏览器里用真实
模块加载器、平台种子表和槽位账本渲染卡片**。详见 [VERIFICATION.md](VERIFICATION.md)。

本机也已完成过一次真实的 OpenAI 授权：它留下的凭证是 `llm-pi-ai/openai-codex` 下的
一条 `grant` 记录，卡片把它读回来显示为脱敏账号、套餐等级和有效期。

仍未验证的：向 Codex **模型**发一条真实请求。如果你恰好卡在这里，请带上控制台里
`[dsh-codex-oauth]` 开头的日志开 issue。

## 排错

卡片永远不会是空白，也永远不会静默失败。每一种状态只对应一件事：

| 你看到的 | 含义 |
|---|---|
| 一个登录按钮 | 链路是通的 |
| 「正在连接 Harness…」 | Remote 命名空间还没发布（约 2 秒后放弃） |
| 「连不上 Harness 的登录服务」 | 客户端 bundle 已挂载，但它的 Remote contribution 被拒了——原因在控制台里 |
| 「界面组件缺失 …」 | 宿主重命名了某个 UI primitive；宁可禁用卡片，也不让它把设置面板整片打空 |
| 「Codex 路由尚未在配置里声明」 | 缺上面第 1 步——卡片会把那段配置原样给出来 |

bundle 会打几条 `[dsh-codex-oauth]` 前缀的日志。在浏览器控制台里 grep 这个标记，
最后一条会告诉你它走到了哪一步。

## 开发

```sh
pnpm install
npm run check          # 类型检查（宿主 + 客户端）→ 构建 → 预检断言
npm test               # 44 个用例，五条泳道
npm run stage-verify -- --dsh <指向 @deepseek-ai/dsh/lib/bin.js 的路径>
```

`stage-verify` 会用真实 profile 的补丁层搭一个一次性 profile，并在它**自己的临时
`DSH_HOME`** 里启动——你的 `~/.dsh` 只被读、不被写。动真 profile 之前先跑它。

打包版桌面端把 `dsh` 载荷放在 `app.asar` 里，Node 无法直接 import。解一次即可：

```sh
npx @electron/asar extract \
  "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar" /tmp/dsh-asar

npm run stage-verify -- --dsh /tmp/dsh-asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js
```

### 目录结构

| 路径 | 内容 |
|---|---|
| `src/index.ts` | 宿主入口（默认导出 Service 类） |
| `src/service.ts` | `codexAuth` Remote 服务——唯一接触 seam 的地方 |
| `src/flow.ts` | 上游内部标识与脱敏投影 |
| `src/route.ts` | 可选的 settings 探针：路由声明了没有 |
| `src/wire.ts` | 两端共享的线上类型 |
| `src/client/` | 浏览器半边：分区注册、卡片、词典、错误边界 |
| `tests/descriptors.test.mjs` | 用真实 typert registry 校验 Remote 描述符 |
| `scripts/preflight.mjs` | 形状与可导入性断言 |
| `scripts/stage-verify.mjs` | 一次性 profile 端到端冒烟；`--browser` 加一条真实浏览器泳道，`--screenshot <p>` 重新生成上面那张图 |

`lib/` 与 `client/client.js` 都是 `src/` 的构建产物。`client/client.js`
**提交进仓库**，因为有些安装路径会禁用构建脚本；`lib/` 由安装时的 `prepare`
和 `npm run check` 生成。改完 `src/` 下任何东西后请跑一次 `npm run check`。

## 安全

令牌留在宿主侧。凭证只存在一个地方——harness 凭证库里 `llm-pi-ai/openai-codex`
那条记录，由 pi-ai 以其自身格式写入——浏览器端只拿到脱敏账号、套餐等级和有效期。
完整边界（这个插件够得着什么、以及它刻意够不着什么）见 [SECURITY.md](SECURITY.md)。

## 许可

[MIT](LICENSE)
