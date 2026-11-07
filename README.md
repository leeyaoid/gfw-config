# Clash 全局扩展脚本

一份脚本同时用于三个 mihomo 内核客户端：[Clash Verge Rev](https://www.clashverge.dev/) 的「全局扩展脚本」，以及 [FlClash](https://flclash.cc/) 和 [clash.md 的 Clash](https://clash.md/) 的「覆写脚本」。基于 [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules) 白名单模式，在此之上增加 AI 服务专用分流、常用服务分流、校园网直连和 DNS 防泄露设计。

- 脚本文件：[`ClashGlobalExtensionScript.js`](ClashGlobalExtensionScript.js)（文件名固定，更新只改内容，版本记录见 Git 提交历史）
- 原始地址：`https://raw.githubusercontent.com/leeyaoid/gfw-config/main/ClashGlobalExtensionScript.js`
- 适用平台：电脑（macOS、Windows、Linux）、Android（FlClash）、iPhone / iPad / Mac（clash.md 的 Clash）
- 入站方式：电脑只开系统代理即可，TUN 兼容；手机端始终以 VPN / 隧道方式接管流量

## 目录

1. [设计目标](#1-设计目标)
2. [使用方法](#2-使用方法)
3. [策略组设计](#3-策略组设计)
4. [节点地区识别](#4-节点地区识别)
5. [分流规则](#5-分流规则)
6. [AI 客户端进程识别](#6-ai-客户端进程识别)
7. [校园网、学术资源与国内 App](#7-校园网学术资源与国内-app)
8. [DNS 设计](#8-dns-设计)
9. [系统代理、TUN 与手机端](#9-系统代理tun-与手机端)
10. [隐藏真实 IP](#10-隐藏真实-ip)
11. [自定义与开关](#11-自定义与开关)
12. [验证方法](#12-验证方法)
13. [已知限制](#13-已知限制)
14. [参考资料](#14-参考资料)

## 1. 设计目标

| 目标 | 实现方式 |
| --- | --- |
| 境内网站直连，境外网站走代理 | Loyalsoldier 白名单模式：没有命中规则的流量一律走代理 |
| ChatGPT、Claude、Gemini 稳定可用 | 三个独立策略组，只能选 AI 支持的地区（默认新加坡）；出口节点手动固定，不随测速跳变 |
| 常用服务可单独选择出口 | YouTube、Netflix、Disney+、Spotify、TikTok、Bilibili、Telegram、X、GitHub、Microsoft、Apple、Steam 各有策略组 |
| 本机 AI 客户端完整覆盖 | 按域名和进程双重识别，覆盖 macOS、Windows、Linux 客户端、命令行工具和 Android App |
| 本地网络、校园网不受影响 | 本地地址、`bjut.edu.cn`（含 VPN、WebVPN）、校园 VPN 客户端、学术数据库直连 |
| 国内 App 不绕道海外 | 手机上小红书、微信、淘宝等国内常用 App 按包名整体直连，并补充 Loyalsoldier 未收录的小红书域名 |
| 隐藏真实 IP 和 DNS 查询 | 境外连接由节点远程解析；本地需要解析的境外域名，经代理向境外 DoH 加密查询 |
| 电脑和手机共用一份脚本 | 只用同步代码，兼容三个客户端的脚本引擎；手机端默认开启 Fake-IP 与嗅探，电脑只开系统代理时这两项不起作用 |

## 2. 使用方法

### 2.1 Clash Verge Rev（电脑）

1. 导入机场订阅。
2. 进入「订阅」页，编辑「全局扩展脚本」，用本脚本全部内容替换后保存。
3. 在「设置」中打开「系统代理」，关闭「TUN 模式」，代理模式选「规则」；建议打开「代理守卫」。「DNS 覆写」保持关闭，由脚本接管。

脚本只修改策略组、规则、DNS 和嗅探；端口、TUN、IPv6、局域网连接等由 Verge 界面控制，脚本写入的这些字段会被 Verge 覆盖。

### 2.2 FlClash（Android、Windows、macOS、Linux）

1. 导入机场订阅。
2. 在该配置的「扩展」中，将「扩展模式」设为脚本模式，新建扩展脚本，粘贴本脚本全部内容并选用。
3. 检查以下设置：
   - 「查找进程」：设为严格（`strict`）。FlClash 用界面设置覆盖脚本中的 `find-process-mode`；设为关闭时，AI 客户端、校园 VPN、坚果云、国内 App 的进程和包名规则都不会生效。
   - DNS 的「覆写项」：不要添加任何项，否则会与脚本的 DNS 设置合并。
   - 「追加系统DNS」：关闭，否则系统 DNS 会被加到默认解析服务器中，境外域名可能经运营商 DNS 解析。
   - 「域名嗅探」覆写项与规则预设「屏蔽 STUN」：不要启用，由脚本控制。
   - 「IPv6」：保持关闭。
4. 代理模式选「规则」。电脑上可只开「系统代理」；Android 始终以 VPN 方式运行。

FlClash 会用界面设置覆盖端口、局域网连接、出站模式、查找进程、虚拟网卡等字段，并自行保存策略组选择（不使用 `store-selected`）。

### 2.3 clash.md 的 Clash（iPhone、iPad、Mac）

1. 添加机场订阅。
2. 在该配置的「配置覆写」中添加覆写脚本，粘贴本脚本全部内容。
3. 出站模式选「规则」。

iPhone 与 iPad 不支持按进程分流，AI App 只能靠域名分流（见 [6.4](#64-各平台支持情况)）。

### 2.4 共同步骤

1. 进入 `sg` 组手动选一个节点并固定，三个 AI 组默认使用 `sg`。
2. `Proxy` 和各服务组建议选 `auto`、`hk` 或 `us`，把 `sg` 留给 AI（原因见 [3.4](#34-地区组的共享选择)）。
3. 电脑上的终端工具（codex、claude、gemini 命令行，git、npm、curl 等）不读取系统代理，需设置环境变量，见 [10.2](#102-命令行工具)。

## 3. 策略组设计

### 3.1 策略组一览

功能组名称首字母大写，地区组和 `auto` 为小写。每个策略组都配有图标（[Qure](https://github.com/Koolson/Qure) 和 [LobeHub Icons](https://github.com/lobehub/lobe-icons)）。功能组只列地区组，不列单个节点，节点统一在地区组内选择。

| 类别 | 策略组 | 默认 | 可选项 | 用途 |
| --- | --- | --- | --- | --- |
| AI | `ChatGPT` | `sg` | `sg` `us` `jp` `tw` `kr` `eu` 中有节点的地区 | ChatGPT、Codex |
| | `Claude` | `sg` | 同上 | Claude、Claude Code |
| | `Gemini` | `sg` | 同上 | Gemini、Gemini CLI、Antigravity、Google 登录 |
| 总出口 | `Proxy` | `auto` | `auto` 和全部非空地区组 | 未单独分流的境外连接 |
| 视频、音乐 | `YouTube` | `Proxy` | `Proxy` 和全部非空地区组 | YouTube |
| | `Netflix` | `Proxy` | 同上 | Netflix（域名和 IP） |
| | `Disney+` | `Proxy` | 同上 | Disney+ |
| | `Spotify` | `Proxy` | 同上 | Spotify |
| | `TikTok` | `us` | 与 AI 组相同的地区 | TikTok（香港不提供服务） |
| 国内 | `Bilibili` | `DIRECT` | `DIRECT` `hk` `tw` | 哔哩哔哩；看港澳台番剧时切换 |
| 社交 | `Telegram` | `Proxy` | `Proxy` 和全部非空地区组 | Telegram（域名和 IP） |
| | `X` | `Proxy` | 同上 | X / Twitter（域名和 IP） |
| 按需服务 | `GitHub` | `Proxy` | 同上 | GitHub |
| | `Microsoft` | `Proxy` | `Proxy` `DIRECT` 和全部非空地区组 | 微软境外服务（境内域名始终直连） |
| | `Apple` | `DIRECT` | `DIRECT` `Proxy` 和全部非空地区组 | Apple 境内可直连的域名（含 iCloud） |
| | `Steam` | `Proxy` | `Proxy` `DIRECT` 和全部非空地区组 | Steam 商店与社区（境内下载 CDN 始终直连） |
| 地区 | `us` `hk` `jp` `tw` `sg` `kr` `eu` `other` | — | 该地区的节点 | 在组内固定具体节点 |
| 测速 | `auto` | — | 全部节点 | 选延迟最低的节点，容差 50 ms |

哔哩哔哩国际版（bilibili.tv）在国内直连打不开，不跟 `Bilibili` 组走，归入 `Proxy`。

### 3.2 AI 组为什么只能选部分地区

- **排除香港**：OpenAI、Anthropic、Google Gemini 都不在香港提供服务，用香港节点会被拒绝。
- **排除受限地区**：澳门、俄罗斯、伊朗、朝鲜、叙利亚、古巴、白俄罗斯同样不在服务范围内。
- **排除混有受限节点的地区组**：例如 `other` 里有俄罗斯节点时，整个 `other` 组不出现在 AI 组中，避免误选。
- **不提供 `auto`**：自动测速会频繁更换出口 IP，AI 服务对 IP 跳变敏感，容易触发账号风控。
- **默认新加坡**：可选项按 `sg → us → jp → tw → kr → eu → other` 排列，第一个有节点的地区为默认值；订阅没有新加坡节点时自动以美国为默认。
- **回退机制**：如果订阅里识别不出任何 AI 可用地区，AI 组退而列出除 `hk` 外的所有非空地区组，并在日志中提示。

### 3.3 服务组的设计

- **Bilibili 默认直连**：切到 `hk` 或 `tw` 后，B 站的视频流量也会经代理，消耗机场流量；看完港澳台内容后建议切回 `DIRECT`。
- **Microsoft、Steam 的境内部分始终直连**：MetaCubeX 的 `microsoft@cn`、`steam@cn` 规则集先匹配直连，其余才进入策略组。Copilot 不在香港提供服务，`Microsoft` 组不宜选 `hk`。
- **Apple 组只管境内可直连的域名**：沿用 Loyalsoldier 的 `icloud`、`apple` 列表，默认直连；其他 Apple 境外域名由白名单规则走 `Proxy`。
- **GitHub 在 Microsoft 之前匹配**：MetaCubeX 的 `microsoft` 规则集包含 GitHub 域名。

### 3.4 地区组的共享选择

地区组是手动选择组，它选中的节点被所有引用它的功能组共享：

- 三个 AI 组都选 `sg` 时，使用同一个节点。
- 如果 `Proxy` 或某个服务组也选 `sg`，为它在 `sg` 组里换节点，AI 的出口 IP 也会跟着变。

因此建议 `Proxy` 和服务组用 `auto`、`hk` 或 `us`，把 `sg` 留给 AI，并在 `sg` 组里固定一个节点后不再频繁更换。

### 3.5 空地区组的处理

某个地区没有节点时，该地区组仍然保留，但只包含 `REJECT`（拒绝连接），不会被功能组引用。空策略组在 mihomo 中可能被填入兼容用的占位出站，存在流量误走直连、暴露真实 IP 的风险，所以这里显式指向 `REJECT`，宁可连接失败也不直连。

## 4. 节点地区识别

脚本按节点名称识别地区，每个节点只归入第一个匹配的地区，顺序为 `hk → tw → jp → kr → sg → us → eu`，都不匹配的归入 `other`。

| 地区 | 中英文关键字（不区分大小写，示例） | 地区代码（区分大小写） |
| --- | --- | --- |
| `hk` | 香港、Hong Kong | HK、HKG |
| `tw` | 台湾、台灣、台北、高雄、Taiwan、Taipei | TW、TWN、TPE |
| `jp` | 日本、东京、大阪、埼玉、Japan、Tokyo、Osaka | JP、JPN |
| `kr` | 韩国、首尔、春川、Korea、Seoul | KR、KOR |
| `sg` | 新加坡、狮城、Singapore | SG、SGP |
| `us` | 美国、洛杉矶、圣何塞、硅谷、西雅图、纽约、达拉斯、United States、America | US、USA |
| `eu` | 欧洲及英、德、法、荷、瑞士、北欧、南欧等国家和主要城市 | EU、UK、GB、GBR、DE、DEU、FR、NL 等 |

设计细节：

- **地区代码区分大小写，且前后不能紧挨英文字母**：避免把 `AUS`（澳大利亚）、`Plus` 误判为 `US`，同时允许 `US01`、`USA_1` 这类写法。
- **不使用旗帜符号识别**：只按名称和代码识别。有的机场给台湾节点标 🇨🇳 旗帜，按旗帜识别会出错。
- **AI 受限判断不使用 `CN`**：部分机场把台湾标注为中国，CN2 等线路名也含 `CN`，按 `CN` 排除会误伤可用节点。
- **过滤提示用的假节点**：名称含“剩余、到期、过期、流量、官网、套餐、重置、Traffic、Expire、Reset”的节点不进入任何策略组。
- **名称冲突处理**：节点名与策略组名或内置出站（`DIRECT`、`REJECT` 等）重复时，内核会拒绝整个配置。脚本把该节点改名为“原名 节点”（如 `Netflix 节点`），同步修改引用它的 `dialer-proxy`，并在日志中提示；改名后的节点照常参与分组。

节点名称只能说明机场标注的地区，不能证明实际出口地区，也不能证明 AI 服务一定可用。

## 5. 分流规则

规则自上而下匹配，命中即停。整体分为 9 层：

| 层 | 内容 | 去向 | 设计原因 |
| --- | --- | --- | --- |
| 1 | 本机与局域网：`localhost`、`.local`、`.lan`、`.home.arpa`、`.test` 等域名；无点号主机名（如 `nas`）；私有 IP 段 | DIRECT | 放在最前，保证本地服务在任何情况下都可访问；IP 段直接写入，规则集下载前也生效 |
| 2 | 北京工业大学 `bjut.edu.cn`（含 VPN、WebVPN）、校园 VPN 客户端进程、坚果云、学术数据库 | DIRECT | 校园网和学校授权资源不受代理影响，详见第 7 节 |
| 3 | 自定义代理域名 | Proxy | 用户补充 |
| 4 | AI 服务域名：内置核心域名 + MetaCubeX 规则集（openai、anthropic、google-gemini） | 对应 AI 组 | 放在广告拦截前，避免 AI 客户端用到的统计、风控域名被误拦 |
| 5 | AI 客户端进程（境内连接除外） | 对应 AI 组 | 客户端访问的其他境外地址也走同一出口，详见第 6 节 |
| 6 | 常用软件、私有网络、广告拦截（Loyalsoldier） | DIRECT / REJECT | 广告照常拦截 |
| 7 | 国内 App：补充域名集（小红书）；Android 上按包名整体直连（已知境外域名除外） | DIRECT | 覆盖第三方 SDK、直接用 IP 连接等域名列表收录不到的连接，详见 [7.2](#72-国内-app) |
| 8 | 各服务：MetaCubeX 规则集 | 对应服务组 | 放在 `google`、`proxy`、`direct` 列表之前，YouTube、Bilibili 不会被这些列表先匹配 |
| 9 | Loyalsoldier 白名单模式其余部分 | 见下 | 境内直连，其余代理 |

第 6 至 9 层完整顺序：

```text
RULE-SET,applications,DIRECT        常用下载工具等软件直连
RULE-SET,private,DIRECT             私有网络域名
RULE-SET,reject,REJECT              广告拦截（可关闭）
RULE-SET,site-xiaohongshu,DIRECT    小红书补充域名
AND,((RULE-SET,process-cn-apps),(NOT,((RULE-SET,proxy))),(NOT,((RULE-SET,google)))),DIRECT
                                    国内 App（Android 包名），已知境外域名除外
RULE-SET,site-biliintl,Proxy        哔哩哔哩国际版
RULE-SET,site-youtube,YouTube
RULE-SET,site-netflix,Netflix
RULE-SET,site-disney,Disney+
RULE-SET,site-spotify,Spotify
RULE-SET,site-tiktok,TikTok
RULE-SET,site-bilibili,Bilibili
RULE-SET,site-telegram,Telegram
RULE-SET,site-twitter,X
RULE-SET,site-github,GitHub         须在 microsoft 之前
RULE-SET,site-microsoft-cn,DIRECT   微软境内域名
RULE-SET,site-microsoft,Microsoft
RULE-SET,site-steam-cn,DIRECT       Steam 境内下载 CDN
RULE-SET,site-steam,Steam
RULE-SET,icloud,Apple               iCloud
RULE-SET,apple,Apple                Apple 境内可直连域名
RULE-SET,google,Proxy               Google
RULE-SET,proxy,Proxy                境外域名列表
RULE-SET,direct,DIRECT              境内域名列表
RULE-SET,lancidr,DIRECT             局域网 IP
RULE-SET,cncidr,DIRECT              中国大陆 IP
RULE-SET,telegramcidr,Telegram      Telegram IP
RULE-SET,ip-netflix,Netflix         Netflix IP
RULE-SET,ip-twitter,X               X IP
GEOIP,LAN,DIRECT
GEOIP,CN,DIRECT
MATCH,Proxy                         其余全部走代理
```

关于未收录域名：前面的域名规则都没命中时，`lancidr`、`cncidr` 这类 IP 规则会触发一次 DNS 解析。解析经代理向境外 DoH 加密发出，结果是大陆 IP 就直连（照顾未收录的境内小网站），否则落到 `MATCH` 走代理。

规则集（`.txt` / `.yaml`）经 `Proxy` 从 GitHub 原始地址下载，每 24 小时更新一次。不用 jsDelivr 镜像，是因为它有约 12 小时的更新延迟，且国内访问不稳定。

## 6. AI 客户端进程识别

### 6.1 为什么要按进程识别

域名规则无法穷举 AI 客户端访问的所有地址（登录、更新、插件市场、验证码等）。这些地址如果落到 `Proxy`，就会和 AI 服务用不同的出口 IP，增加风控风险；如果落到香港节点，还可能因为地区限制而失败。按进程识别后，AI 客户端的所有境外连接都走对应 AI 组，出口保持一致。

### 6.2 覆盖范围

| 策略组 | macOS | Windows | Linux | Android |
| --- | --- | --- | --- | --- |
| ChatGPT | ChatGPT.app、Codex.app 整个应用包（含 Helper、内置 codex、node） | 应用商店版 ChatGPT（`WindowsApps\OpenAI.*`）、`codex.exe` | `codex` 命令行 | `com.openai.chatgpt` |
| Claude | Claude.app 及 Helper、桌面版内置的 Claude Code、原生安装的 Claude Code（`~/.local/share/claude/versions/`，进程名为版本号） | `AnthropicClaude` 安装目录、`claude.exe` | Claude Code、社区版 `claude-desktop` | `com.anthropic.claude` |
| Gemini | Gemini.app、Antigravity.app（含 `language_server`） | `Antigravity.exe` 及其 `language_server` | `antigravity`、`language_server`、`antigravity-server` | `com.google.android.apps.bard`（Gemini App） |

另外按安装路径匹配 npm 安装的 Codex CLI（`@openai/codex`）和 Claude Code（`@anthropic-ai/claude-code`）。

### 6.3 匹配原则

- **不按通用进程名匹配**：`node`、`electron`、`python`、`chrome`、单独的 `language_server` 都不匹配，避免误伤 VS Code、浏览器等。只有位于 AI 应用自身安装目录内的 node、language_server 才会匹配。
- **路径分隔符兼容**：路径正则写作 `[/\\]`，同时适配 `/` 和 `\`。
- **Android 按包名匹配**：mihomo 在 Android 上用 App 包名作为进程名。
- **Gemini CLI 例外**：它以通用的 node 进程运行，无法按进程识别，只靠 Gemini 相关域名分流。

### 6.4 各平台支持情况

| 客户端与平台 | 按进程分流 |
| --- | --- |
| Clash Verge Rev（电脑） | 支持，`find-process-mode` 由脚本设为 `strict` |
| FlClash（电脑、Android） | 支持，需在界面中把「查找进程」设为严格 |
| clash.md 的 Clash（Mac） | 支持，部分连接可能取不到进程信息 |
| clash.md 的 Clash（iPhone、iPad） | 不支持，进程规则不会命中，只靠域名分流 |

### 6.5 境内连接例外

AI 客户端访问境内资源（如国内文档、镜像）时不应绕道海外。进程规则写成组合条件：

```text
AND,(
  (RULE-SET,process-chatgpt),              进程是 ChatGPT / Codex
  (NOT,((RULE-SET,private))),              且不是私有网络域名
  (NOT,((RULE-SET,direct))),               且不是境内域名
  (NOT,((RULE-SET,apple))),                且不是 Apple 域名
  (NOT,((RULE-SET,icloud))),               且不是 iCloud 域名
  (OR,((RULE-SET,proxy),(RULE-SET,google),(NOT,((RULE-SET,cncidr)))))
                                           且是已知境外域名，或解析后不是大陆 IP
),ChatGPT
```

进程正则中含有括号，直接写进 `AND`/`NOT` 会与逻辑规则的括号语法冲突，因此放在内联规则集（`type: inline`）中引用。

`find-process-mode` 使用 `strict`：只在规则需要时查找进程。已实测嵌套在逻辑规则中的进程规则能正常触发查找，无需改为每个连接都查找的 `always`。

## 7. 校园网、学术资源与国内 App

### 7.1 校园网、学术资源与坚果云

| 对象 | 处理 | 说明 |
| --- | --- | --- |
| `bjut.edu.cn` 全部子域名 | 直连，系统 DNS 解析 | 包括主站、图书馆、`vpn.bjut.edu.cn`、`webvpn.bjut.edu.cn`；校内专用地址只能由学校 DNS 解析，所以用系统 DNS |
| 校园 VPN 客户端 | 进程直连（电脑端） | Array Networks MotionPro，兼容深信服 EasyConnect、aTrust |
| 学术数据库 | 直连，国内 DoH 解析 | 知网、万方、维普、IEEE、ACM、ScienceDirect、Springer、Nature、Wiley、Web of Science 等 29 个 |
| 坚果云 | 直连，国内 DoH 解析 | 域名 `jianguoyun.com`、电脑端进程 `Nutstore`、`NutstoreFilesD`、Android 包名 `nutstore.android` |

- **VPN 判断依据**：vpn.bjut.edu.cn 返回的跳转路径 `/prx/000/` 是 Array Networks SSL VPN 的特征，对应客户端为 MotionPro；webvpn.bjut.edu.cn 使用 WenGine（网瑞达）WebVPN 系统。
- **学术数据库为什么直连**：这些数据库按来源 IP 判断学校订阅权限。在校园网内或连着学校 VPN 时，直连才能使用学校授权；走代理会失去授权。代价是出版商能看到真实 IP，不需要时可关闭 `academicDirect`。
- **电脑上使用校园 VPN**：请只开系统代理、不开 TUN。开启 TUN 后，VPN 客户端的流量和系统 DNS 都可能被接管，导致校内地址无法访问。
- **手机上使用校园 VPN**：Android 和 iOS 同一时间只能运行一个 VPN，MotionPro 与 FlClash / Clash 不能同时开启；WebVPN 不受影响。

### 7.2 国内 App

手机上所有 App 的流量都经过 mihomo。国内 App 除了主域名，还会用到第三方 SDK 域名、新上线的域名，或通过 HTTPDNS 直接用 IP 连接。这些连接不在 Loyalsoldier `direct` 列表中时，会经境外 DoH 解析后按 IP 判断；拿到境外 CDN 地址就会落到 `Proxy`，表现为小红书等 App 的部分连接走了境外节点。脚本分两层处理：

| 处理 | 平台 | 说明 |
| --- | --- | --- |
| 按包名整体直连 | Android（FlClash） | `CN_APP_PACKAGES` 中的 App，所有连接直连；Loyalsoldier `proxy`、`google` 列表中的境外域名除外（如在微信里打开 YouTube 链接仍走代理） |
| 补充域名集 | 全部平台 | MetaCubeX `xiaohongshu` 规则集，直连并用国内 DoH 解析；补上 Loyalsoldier 未收录的 `xhsrcdn.com`、`redelight.cn` 等 |

`CN_APP_PACKAGES` 默认收录小红书、微信、QQ、企业微信、支付宝、云闪付、淘宝、天猫、闲鱼、京东、拼多多、美团、大众点评、饿了么、抖音、快手、今日头条、微博、知乎、百度、百度网盘、高德地图、滴滴出行、铁路 12306、携程、网易云音乐、QQ 音乐、钉钉、飞书。哔哩哔哩不在其中，仍由 `Bilibili` 组控制。

这条规则放在广告拦截之后，国内 App 里的广告照常拦截；放在 AI 规则之后，在国内 App 里访问 AI 服务仍走 AI 组。需要按包名分流时，FlClash 的「查找进程」必须设为严格。其他 App 仍走境外节点时，在客户端「连接」页查到它的包名后加入 `CN_APP_PACKAGES`。

## 8. DNS 设计

### 8.1 解析分工

| 域名类别 | 解析服务器 | 查询出站 |
| --- | --- | --- |
| 无点号主机名、本地域名、`bjut.edu.cn` | 系统 DNS | 本机 |
| 学术数据库、坚果云 | 阿里 `223.5.5.5`、腾讯 `1.12.12.12` DoH | DIRECT |
| AI 域名及 AI 规则集 | Cloudflare `1.1.1.1`、Google `8.8.8.8` DoH | 对应 AI 组 |
| 境内（private、direct、apple、icloud、xiaohongshu、bilibili、microsoft@cn、steam@cn 规则集） | 阿里、腾讯 DoH | DIRECT |
| 机场节点域名 | 阿里、腾讯 DoH | DIRECT |
| 直连流量 | 按上述分工（`direct-nameserver-follow-policy: true`） | DIRECT |
| 其余全部域名 | Cloudflare、Google DoH | Proxy |

### 8.2 设计要点

- **远程解析**：被域名规则命中的连接由代理节点在远端解析，本机不产生 DNS 查询。
- **需要本地解析时加密发出**：未收录域名需要本地解析判断 IP 时，经代理向境外 DoH 查询，运营商看不到你查了哪些境外域名。
- **全部使用 IP 形式的 DoH**：不需要先解析 DoH 服务器自身的域名，引导用的 DNS 服务器（`default-nameserver`）也用 DoH。
- **用 `#策略组` 指定出站**：每个 DNS 服务器地址后用 `#DIRECT`、`#Proxy`、`#ChatGPT` 等指定查询走哪条线路，不依赖规则顺序。
- **直连流量用国内 DNS**：保证国内网站拿到国内 CDN 地址。
- **关闭 IPv6 解析**：避免 IPv6 地址绕过代理或因节点不支持 IPv6 而连接失败。
- **DNS 模式默认 Fake-IP**：手机端和 TUN 下，App 的 DNS 查询由 mihomo 应答，Fake-IP 让每个连接都能还原域名，域名规则覆盖更完整。本地与校园网域名、NTP、联网检测、STUN 等在 `fake-ip-filter` 中，返回真实 IP。电脑只开系统代理时，系统不使用 mihomo 的 DNS，这项设置不起作用。

## 9. 系统代理、TUN 与手机端

### 9.1 电脑

| 流量来源 | 系统代理能否覆盖 | 说明 |
| --- | --- | --- |
| 浏览器 | 能 | 读取系统代理 |
| ChatGPT、Claude、Gemini、Antigravity 桌面客户端 | 能 | 原生或 Electron 应用，读取系统代理；已确认 ChatGPT 内置的 Codex 服务进程经系统代理连接 |
| 终端工具 | 不能 | 需设置 `HTTPS_PROXY` 等环境变量 |
| UDP 流量（WebRTC、游戏） | 不能 | 系统代理只转发 TCP |

电脑上推荐只用系统代理：不接管系统路由和 DNS，不影响校园 VPN，行为可预期，出问题容易定位。如果某个应用在客户端「连接」页始终看不到，说明它绕过了系统代理，这时再考虑开启 TUN。

### 9.2 手机

FlClash（Android）以 VPN 方式运行，clash.md 的 Clash（iPhone、iPad）以系统隧道方式运行，两者都相当于 TUN：所有 App 的 TCP、UDP 流量和 DNS 查询都经过 mihomo。为此脚本默认开启：

- **Fake-IP**：见 [8.2](#82-设计要点)。
- **域名嗅探**：从 TLS、HTTP、QUIC 握手中还原域名，覆盖直接用 IP 连接或自带 DNS 的 App；本地与校园网地址不嗅探。

## 10. 隐藏真实 IP

### 10.1 覆盖范围

| 场景 | 对方看到的 IP |
| --- | --- |
| 境外网站、AI 服务 | 代理节点 IP |
| 境内网站、校园网、学术数据库 | 真实 IP（按设计直连） |
| 电脑上绕过系统代理的程序 | 真实 IP（需设环境变量或开 TUN） |
| 电脑浏览器 WebRTC（只开系统代理时） | 可能暴露真实 IP（需单独处理） |

### 10.2 命令行工具

在 `~/.zshrc` 中加入（端口改为客户端中实际的「混合代理端口」，Clash Verge Rev 默认 7897，FlClash 默认 7890）：

```bash
export http_proxy=http://127.0.0.1:7897 https_proxy=http://127.0.0.1:7897 all_proxy=socks5h://127.0.0.1:7897
export HTTP_PROXY=$http_proxy HTTPS_PROXY=$https_proxy ALL_PROXY=$all_proxy
export no_proxy=localhost,127.0.0.1,::1,.local NO_PROXY=localhost,127.0.0.1,::1,.local
```

国内地址进入 mihomo 后仍按规则直连，不会绕道海外。

### 10.3 WebRTC

WebRTC 使用 UDP。只开系统代理时，UDP 不经过 mihomo，需要在浏览器中处理：

- Chrome：安装 Google 官方扩展 WebRTC Network Limiter，选择“使用代理服务器”。
- Firefox：在 `about:config` 中将 `media.peerconnection.ice.proxy_only` 设为 `true`。

TUN 模式和手机端，发往境外的 STUN 请求会按规则走 `Proxy`，对方看到的是节点 IP。脚本的 `blockStun` 默认关闭，因为拦截 UDP 3478 会影响 FaceTime、Google Meet 等通话；需要彻底禁止 STUN 时可改为 `true`。

### 10.4 其他注意事项

- 机场节点域名经阿里、腾讯 DoH 解析，对方能看到你在解析机场节点，但看不到你访问了哪些网站。
- 不要把 AI 组或 `Proxy` 切到直连。

## 11. 自定义与开关

脚本开头集中放置可修改项：

### 11.1 开关 `OPTIONS`

| 开关 | 默认 | 说明 |
| --- | --- | --- |
| `blockAds` | `true` | Loyalsoldier `reject` 广告拦截；个别网站异常时改为 `false` |
| `academicDirect` | `true` | 学术数据库直连 |
| `fakeIp` | `true` | Fake-IP DNS 模式；电脑只开系统代理时不起作用；电脑开 TUN 且校园 VPN 异常时可改为 `false`（`redir-host`） |
| `sniff` | `true` | 流量嗅探，跳过校园网和局域网地址；电脑只开系统代理时不起作用 |
| `blockStun` | `false` | 拦截 STUN（UDP 3478、19302–19309）；只在 TUN 和手机端有效，会影响音视频通话 |

### 11.2 自定义列表

| 常量 | 用途 |
| --- | --- |
| `CAMPUS_DOMAINS` | 校园网/内网域名，直连并用系统 DNS |
| `CAMPUS_VPN_PROCESS` | 校园 VPN 客户端进程名正则，直连 |
| `ACADEMIC_DOMAINS` | 学术数据库域名，直连 |
| `APP_DIRECT_DOMAINS` / `APP_DIRECT_PROCESS` / `APP_DIRECT_PACKAGES` | 国内应用（坚果云）的域名、电脑端进程名正则、Android 包名，直连 |
| `CN_APP_PACKAGES` | 国内 App 的 Android 包名，整体直连（已知境外域名除外）；包名可在 FlClash「连接」页查到 |
| `CN_SITE_SETS` | 国内 App 补充域名集（MetaCubeX geosite 名称），直连并用国内 DNS |
| `EXTRA_DIRECT_DOMAINS` | 额外直连域名 |
| `EXTRA_DIRECT_CIDRS` | 额外直连 IP 段 |
| `EXTRA_PROXY_DOMAINS` | 额外走 `Proxy` 的域名 |
| `AI_PROCESSES` | AI 客户端进程规则；新客户端可在客户端「连接」页查到进程名或包名后加入 |
| `SERVICES` | 服务策略组：名称、可选项类型、图标、MetaCubeX 规则集；增删服务只需改这里 |
| `REGIONS` | 地区关键字；机场命名方式特殊时在此补充 |
| `AI_REGION_ORDER` | AI 组可选地区及顺序，第一个有节点的地区为默认值 |

域名只填主机名，不含协议和路径，后缀匹配会同时覆盖所有子域名。

## 12. 验证方法

1. **看分流**：客户端「连接」页中，每条连接都会显示命中的规则和使用的策略组。确认 ChatGPT、Claude、Gemini 客户端的连接落在对应 AI 组，YouTube、B 站等落在对应服务组，北工大和国内网站为 DIRECT。clash.md 的 Clash 在 Mac 上可用 `clash-cli rule match <域名>` 查看某个域名会命中哪条规则。
2. **看 AI 出口**：访问 `https://chatgpt.com/cdn-cgi/trace`、`https://claude.ai/cdn-cgi/trace`，`loc=` 应为所选地区（如 `SG`）。
3. **看泄露**：用 browserleaks.com 的 WebRTC 和 DNS 页面检查，境外 DNS 解析服务器不应出现国内运营商。

## 13. 已知限制

- 节点地区按名称识别，不能证明实际出口地区或 AI 可用性。
- 只有节点列表（`proxies`）的订阅会生效；纯 `proxy-providers` 订阅脚本不做修改，原样返回。
- Windows、Linux 的进程路径按常见安装位置编写，只在 macOS 上用真实进程验证过；Android 包名未在真机上验证分流。
- iPhone、iPad 不支持按进程分流；Gemini CLI 以 node 运行，只能靠域名分流。
- 电脑只开系统代理时，不覆盖 UDP 和不读取系统代理的程序。
- Bilibili 切到 `hk` / `tw` 能否解锁港澳台内容取决于节点，未实测。
- 国内 App 包名直连只在 Android 上生效；iPhone、iPad 上只能靠域名，App 使用未收录的域名或直接用 IP 连接时，仍可能落到 `Proxy`，需要把域名补进 `EXTRA_DIRECT_DOMAINS`。
- 策略组图标托管在 raw.githubusercontent.com 和 unpkg.com，代理未连通时可能无法显示，不影响分流。

## 14. 参考资料

- [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules)：规则集及白名单模式
- [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)：AI 与各服务规则集
- [Clash Verge Rev 文档：扩展脚本](https://www.clashverge.dev/guide/script.html)
- [FlClash](https://github.com/chen08209/FlClash)：覆写脚本实现见 `plugins/rust_api/rust/src/script/`
- [clash.md](https://clash.md/zh/guide/)：Clash（Apple 平台）使用说明；覆写脚本实现见 [ProjectClash/Clash-Client](https://github.com/ProjectClash/Clash-Client)
- [mihomo 文档](https://wiki.metacubex.one/)：规则、DNS、策略组配置说明
- [Koolson/Qure](https://github.com/Koolson/Qure)、[lobehub/lobe-icons](https://github.com/lobehub/lobe-icons)：策略组图标
