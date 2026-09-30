# 安装与使用

**dsh-codex-oauth** 的完整安装步骤。[README](README.zh.md) 讲的是这个插件是什么、
怎么工作；这份文件只讲怎么把它跑起来。

**多数人应该直接从下面这段提示词开始。** 把它交给你的 Harness agent，整件事它都会
做完。往下是同一套流程的详细步骤，想自己动手、或者要核对 agent 干了什么时看。

- [交给 AI agent 做](#交给-ai-agent-做)
- [环境要求](#环境要求)
- [1. 确认你在哪个 profile](#1-确认你在哪个-profile)
- [2. 声明路由](#2-声明路由)
- [3. 安装插件](#3-安装插件)
- [4. 重启](#4-重启)
- [5. 检查卡片](#5-检查卡片)
- [6. 登录](#6-登录)
- [7. 使用 Codex 模型](#7-使用-codex-模型)
- [卸载](#卸载)
- [排错](#排错)

## 交给 AI agent 做

下面这些全是机械操作。把这段贴进你的 Harness agent 让它做：

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

## 环境要求

- **DeepSeek Harness `0.2.0-rc.2`** —— 这个插件就是针对这条版本线构建和验证的。用
  `dsh --version`，或在 **设置 → 通用** 里看版本号。
- 一个 **ChatGPT Plus 或 Pro** 订阅。
- 对 DSH home 的写权限（默认 `~/.dsh`，或 `$DSH_HOME`）。

## 1. 确认你在哪个 profile

一个 profile 就是 `~/.dsh/profiles/` 下的一个目录。你在用哪个，决定了插件怎么装。

| 你的运行方式 | profile | 安装途径 |
|---|---|---|
| 桌面端应用（Electron） | `desktop` | 应用内的插件管理器 |
| 终端里的 `dsh web` | `web`（或你 `--profile` 指定的） | 命令行 |
| `dsh headless …` | 同上 | 命令行 |

不确定的话：桌面端应用永远用 `desktop`；终端里就是 `--profile` 后面的名字，不带
任何参数时 `dsh` 启动的是 `web`。

```sh
ls ~/.dsh/profiles/
```

## 2. 声明路由

把下面这段加进你 profile 的 `cordis.patch.yml`
（`~/.dsh/profiles/<profile>/cordis.patch.yml`）：

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      openai-codex: {}
```

那个文件是一个 YAML 列表，把这段追加到末尾，缩进和已有的条目对齐。如果已经存在
`- id: llm-pi-ai` 这一项，就把 `openai-codex: {}` 加进它已有的 `providers:` 下面，
不要新建第二项。

**先备份** —— patch 文件格式错了会让 profile 起不来：

```sh
cp ~/.dsh/profiles/<profile>/cordis.patch.yml \
   ~/.dsh/profiles/<profile>/cordis.patch.yml.bak-$(date +%s)
```

### 为什么必须是空值

`{}` 表示 **keyless** 路由：保留供应商自己的认证方式，对 `openai-codex` 来说就是
pi-ai 的 ChatGPT OAuth——正是登录写进去的那份授权。

如果改成写 `apiKeyEnv`，认证就换成了 API Key。登录照样"看起来成功"，但模型会一直
认证失败。

**没有这一项**，模型页里根本不会有 `openai-codex` 这一行，`llm-pi-ai` 也不会为这条
路由注册适配器——那样就算登录成功，也只是存了一份没人用的凭证。卡片发现路由缺失时
会明确写出这一点。

## 3. 安装插件

两个构建产物（`lib/` 和 `client/client.js`）都已提交进仓库，所以**不需要构建，
安装时也没有任何东西需要批准**。

### 桌面端 → 应用内插件管理器

桌面端应用独占 `desktop` profile，它的 CLI 拒绝管理：

```
$ dsh plugin --profile desktop add dsh-codex-oauth
error: profile "desktop" is managed exclusively by the Electron application
```

打开 **设置 → 内置插件**（或侧边栏的「插件」），从仓库地址或本地目录安装。然后
直接跳到[第 4 步](#4-重启)。

### 由 CLI 管理的 profile → `dsh plugin add`

`dsh plugin` 就是在 profile 里跑 `pnpm`，所以写法完全一样：

```sh
# 从 GitHub 安装
dsh plugin --profile web add github:callqh/dsh-codex-oauth

# 从 npm 安装
dsh plugin --profile web add dsh-codex-oauth
```

### 手工安装

如果以上两条路都走不通——profile 本质上就是一个带 `package.json` 的目录：

```sh
cd ~/.dsh/profiles/<profile>
cp package.json package.json.bak-$(date +%s)
```

把 `"dsh-codex-oauth"` 加进 `dsh.profile.bundles`，并加上依赖：

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

## 4. 重启

profile 的 bundle 列表是**进程启动时**组装的，不重启就不会加载。退出再打开——桌面端
指的是退出整个应用，不是刷新窗口。

## 5. 检查卡片

打开 **设置 → Codex 登录**，应该看到：

![Codex 登录，未登录状态](assets/screenshot-settings.png)

如果显示的是「Codex 路由尚未在配置里声明」，说明第 2 步没生效——卡片会把要加的
那段 YAML 原样打出来。其他红字也会明确指出缺什么。见[排错](#排错)。

## 6. 登录

点 **使用 ChatGPT 账号登录**。流程会先问你想用哪种方式：

### 浏览器登录（默认）

授权页面会在新标签页打开，回调由主机侧的 `127.0.0.1:1455` 接住。在那里完成登录，
卡片会在一秒左右变成已登录，**不需要刷新页面**。

等待期间，卡片上还有一个链接和一个 **复制链接** 按钮，供标签页没打开时使用。

### 设备码登录

浏览器在另一台机器上时选这个。卡片会显示 `XXXX-XXXX` 和一个可复制的地址。

> 这种方式需要先在 ChatGPT → 设置 → 账户安全与登录里打开
> **「为 Codex 启用设备代码授权」**。默认的浏览器登录不需要。

### 登录成功的样子

- **账号** —— 脱敏显示，例如 `a1b2c3d4…9f0e`。完整值不会离开主机。
- **套餐** —— 你的订阅等级。
- **有效期** —— access token 的过期时间。

点「退出登录」会删除凭证记录，不留任何其它痕迹。

## 7. 使用 Codex 模型

在模型选择器里挑一个 provider 为 `openai-codex` 的模型，直接发消息即可。路由配好了、
凭证存下了，就能用——每个会话不需要额外设置。

## 卸载

1. 先在卡片上点 **退出登录**，删掉凭证；
2. 从 profile 的 `dsh.profile.bundles` 和 `dependencies` 里移除 `dsh-codex-oauth`
   （或用插件管理器卸载），然后 `pnpm install`；
3. 重启。

除此之外不写任何东西：profile 之外没有配置，工作区里没有文件。

## 排错

卡片永远不会是空白，也永远不会静默失败。

| 你看到的 | 含义 | 怎么办 |
|---|---|---|
| 「正在连接 Harness…」 | 宿主接口还没发布 | 等一下；约 2 秒后会放弃并报错 |
| 「连不上 Harness 的登录服务」 | 客户端 bundle 已加载，但宿主拒绝了它的 Remote contribution | 打开浏览器控制台，看 `[dsh-codex-oauth]` 开头的行 |
| 「界面组件缺失 …」 | 宿主重命名了某个 UI primitive | 带上你的 Harness 版本反馈 |
| 「Codex 路由尚未在配置里声明」 | 缺第 2 步 | 把卡片上给的 YAML 加上，重启 |

客户端做的每一步都会以 `[dsh-codex-oauth]` 为前缀打到浏览器控制台，最后一条会告诉
你它走到了哪一步：

```
[dsh-codex-oauth] client apply
[dsh-codex-oauth] Remote namespace "codexAuth" mounted
[dsh-codex-oauth] slot "settings.section" is declared; adding the codex-oauth section
[dsh-codex-oauth] card mounted in its settings section
```

### 安装后应用起不来

`dsh.profile.bundles` 里的 bundle 导入失败会让整个启动失败。失败弹窗会提供「禁用
第三方插件并恢复 profile patch」，那个办法是有效的。想手工修：从 profile 的
`package.json` 的 `dsh.profile.bundles` 里去掉 `"dsh-codex-oauth"`（`dependencies`
那条留着无妨），然后重启。

第 1、2 步让你留的 `*.bak-<时间戳>` 备份就是为这种情况准备的。
