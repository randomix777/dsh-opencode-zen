<h1 align="center">DSH OpenCode Zen</h1>

<p align="center">
  <strong>把 <a href="https://opencode.ai/zen">OpenCode Zen</a> 的免费模型接进
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>。</strong><br>
  不用注册、不用 API key、不用填余额。
</p>

<p align="center">
  <a href="https://github.com/randomix777/dsh-opencode-zen"><img src="https://img.shields.io/github/stars/randomix777/dsh-opencode-zen?style=flat&label=Star&color=4D6BFE" alt="Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat" alt="MIT License"></a>
  <a href="https://github.com/keman-ai/dsh-opencode-zen"><img src="https://img.shields.io/badge/源自-keman--ai-blue" alt="Forked from"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <b>简体中文</b>
</p>

## 本 fork 的更新 (v0.2.1)

- **免费额度限流检测器** — 自动记录 429 响应，估算重置时间，显示倒计时
- **持久化额度状态** — 通过 `~/.dsh/cache/opencode-zen-quota.json` 跨 DSH 重启保留
- **8 个经核验的免费模型**（与 Zen 实时接口交叉验证，无无效条目）
- **持久化文件缓存** — 重启 DSH 后目录不丢失
- **指数退避重试** — 最多 2 次重试，间隔 500ms/1s
- **改进的错误提示** — 更清晰的额度限制说明
- **更新的配置架构** — 新增 `cachePath` 选项

所有模型均经过 models.dev（cost=0）和 Zen `/v1/models` 接口双重验证。

装上不用配任何东西。Zen 的免费模型允许匿名调用，插件启动后模型选择器里直接多出一组能用的模型。

```
模型选择器
├─ nemotron-3-ultra-free         100 万上下文
├─ muse-spark-1.2-contributor-free 100 万上下文
├─ nemotron-3.5-lightning-free   26 万上下文，输出也是 26 万
├─ ling-3.0-flash-fin-free       26 万上下文
├─ laguna-s-2.1-free             25.6 万上下文
├─ deepseek-v4-flash-free        20 万上下文，12.8 万输出
├─ big-pickle                    Zen 自家的匿名评测模型
└─ mimo-v2.5-free                20 万上下文
```

**全部支持工具调用和推理内容**，够跑完整的 agent 循环——不是只能聊天的阉割版。

清单不写死在代码里，运行时从上游拉：models.dev 定「哪些免费、多大上下文」，Zen 的模型接口定「现在还有没有」，取交集。免费模型是限时提供的，写死的清单迟早过期。离线时回退到内置快照。

## 安装

不发 npm，从 GitHub 装：

```sh
dsh plugin --profile web add -w github:randomix777/dsh-opencode-zen
```

装完**重启一次 dsh**，模型选择器里就会出现 `opencode-zen` 这一组。

三点说明：

- **`-w` 不能省。** profile 目录自带 `pnpm-workspace.yaml`，pnpm 会把它当 workspace 根，不带这个标志直接报 `ERR_PNPM_ADDING_TO_ROOT`。
- **不需要授权构建脚本。** 仓库带着构建产物、也没有 `prepare` 脚本，pnpm 装 git 源时不执行任何构建，你不必配 `allowBuilds`，也不必在自己机器上装构建工具链。
- **`--profile` 跟你平时用的那个走**（`web` / `headless` 都行）。这是个 LLM provider，不依赖 Web GUI。

想确认它真的进了 Loader 树：

```sh
dsh --profile web --dump-config | grep -A 1 opencode-zen
# - id: opencode-zen
#   name: dsh-opencode-zen
```

想改代码就本地装：

```sh
git clone https://github.com/randomix777/dsh-opencode-zen
cd dsh-opencode-zen && pnpm install && pnpm build
dsh plugin --profile web add <该目录的绝对路径>
```

## 要不要 API key

**不要也能用**，匿名调用走 Zen 的公共免费额度。按来源限流，自己试用够了，跑量会撞到 `FreeUsageLimitError`。

想要独立额度就去 [opencode.ai/zen](https://opencode.ai/zen) 取一个：

```sh
export OPENCODE_API_KEY=<你的 key>
```

变量名与 opencode 官方一致，本来就在用 opencode 的话两边共用同一个 key。也可以在 dsh 网页的「模型」页存进凭证服务，插件会优先读那里。

额度用尽时插件不会只丢一句 `Rate limit exceeded`，而是告诉你当前是匿名还是带 key、下一步能做什么。

## 配置

全部可选，什么都不写就是上面描述的默认行为。

```yaml
plugins:
  dsh-opencode-zen:
    apiKeyEnv: OPENCODE_API_KEY        # 凭证引用（环境变量名）
    baseURL: https://opencode.ai/zen/v1
    catalogUrl: https://models.dev/api.json
    catalogTtlMs: 3600000              # 目录缓存时长，默认一小时
    catalogTimeoutMs: 8000             # 目录请求超时
    maxTokens: 32000                   # 输出上限；模型自身上限更小时以模型为准
    defaultContextWindow: 128000       # 目录里查不到该模型时假定的容量
    cachePath: ~/.dsh/cache/opencode-zen-catalog.json  # 持久化缓存（默认）
```

设置 `cachePath: ""` 可完全禁用文件缓存。

## 已知边界

- **免费额度是共享的**，匿名调用尤其容易撞限流。这是 Zen 的策略，插件只能把原因说清楚。
- **不回传推理内容。** OpenAI 兼容的 `chat/completions` 没有承载上一轮思考的请求字段，所以推理块只展示、不回灌。
- **纯文本。** 所有模型都只吃文本，工具结果里的图片会被替换成一行占位说明，而不是静默丢掉。
- **付费模型不进目录。** Zen 也有 Claude、GPT 等付费模型，但本插件存在的理由就是「不配任何东西也能先跑起来」，混在一个列表里会让人分不清点哪个要花钱。要用付费的，配一个指向同一端点的 `llm-deepseek` 条目即可。

## 开发

```sh
pnpm install
pnpm check      # 类型检查
pnpm test       # 单元测试
pnpm build      # 打包到 lib/
```

**`lib/` 是故意提交进仓库的**：这个包不发 npm，所有人都从 git 源安装，而 pnpm 装 git 源时能不能构建取决于对方机器的工具链与 `allowBuilds` 授权。带上产物就没有这个变数——**改完代码要把 `pnpm build` 的产物一并提交。**

| 文件 | 职责 |
|---|---|
| `src/index.ts` | 插件入口：配置校验、凭证解析、往 `ctx.llm` 注册 provider |
| `src/adapter.ts` | `LlmAdapter` 实现：发请求、映射错误、暴露模型元数据 |
| `src/stream.ts` | SSE 增量 → harness 块序列的状态机 |
| `src/discovery.ts` | 免费目录的双源合并、缓存（内存+文件）、兜底和重试 |
| `src/quota-tracker.ts` | 限流检测：记录 429，估算重置时间，持久化到磁盘 |
| `src/fs-cache.ts` | 文件缓存辅助（浏览器环境无操作） |

## 相关

- [OpenCode Zen](https://opencode.ai/zen) —— 模型网关本体，key 在这里取
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) —— 宿主
- [dsh-plugin-subs](https://github.com/randomix777/dsh-plugin-subs) —— OAuth 订阅 LLM 插件
- [dsh-sprite-gen](https://github.com/randomix777/dsh-sprite-gen) —— AI 精灵图生成插件
- 原版: [keman-ai/dsh-opencode-zen](https://github.com/keman-ai/dsh-opencode-zen)

## 许可

[MIT](LICENSE) © 2026 Science Roam Limited (fork & 优化 by randomix777)

---

<p align="center">
  <sub>如果喜欢就给个 Star 鼓励我们一下吧</sub>
</p>
