# Clash Verge Rev 全局扩展脚本与 Loon 配置

适用于 [Clash Verge Rev](https://www.clashverge.dev/)（mihomo 内核）的全局扩展脚本，以及按同一思路改写的 [Loon](https://nsloon.app) 配置。基于 [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules) 白名单模式，在此之上增加 AI 服务专用分流、校园网直连和 DNS 防泄露设计。

- 脚本文件：`ClashVerge全局扩展脚本-V2.2-20260928.js`
- Loon 配置：`Loon-Config-V1.3-20261005.conf`（见[第 14 节](#14-loon-配置)）
- 测试环境：macOS，Clash Verge Rev 2.5.2，mihomo v1.19.29
- 入站方式：只开系统代理即可，TUN 模式兼容

## 目录

1. [设计目标](#1-设计目标)
2. [使用方法](#2-使用方法)
3. [策略组设计](#3-策略组设计)
4. [节点地区识别](#4-节点地区识别)
5. [分流规则](#5-分流规则)
6. [AI 客户端进程识别](#6-ai-客户端进程识别)
7. [校园网与学术资源](#7-校园网与学术资源)
8. [DNS 设计](#8-dns-设计)
9. [系统代理与 TUN](#9-系统代理与-tun)
10. [隐藏真实 IP](#10-隐藏真实-ip)
11. [自定义与开关](#11-自定义与开关)
12. [验证方法](#12-验证方法)
13. [已知限制](#13-已知限制)
14. [Loon 配置](#14-loon-配置)
15. [参考资料](#15-参考资料)

## 1. 设计目标

| 目标 | 实现方式 |
| --- | --- |
| 境内网站直连，境外网站走代理 | Loyalsoldier 白名单模式：没有命中规则的流量一律走代理 |
| ChatGPT、Claude、Gemini 稳定可用 | 三个独立策略组，只能选 AI 支持的地区；出口节点手动固定，不随测速跳变 |
| 本机 AI 客户端完整覆盖 | 按域名和进程双重识别，覆盖 macOS、Windows、Linux 客户端及命令行工具 |
| 本地网络、校园网不受影响 | 本地地址、`bjut.edu.cn`（含 VPN、WebVPN）、校园 VPN 客户端、学术数据库直连 |
| 隐藏真实 IP 和 DNS 查询 | 境外连接由节点远程解析；本地需要解析的境外域名，经代理向境外 DoH 加密查询 |
| 只用系统代理 | 所有设计都以系统代理为前提验证；开关默认值针对系统代理模式 |

## 2. 使用方法

1. 在 Clash Verge Rev 中导入机场订阅。
2. 进入「订阅」页，编辑「全局扩展脚本」，用本脚本全部内容替换后保存。
3. 在「设置」中打开「系统代理」，关闭「TUN 模式」，代理模式选「规则」；建议打开「代理守卫」。「DNS 覆写」保持关闭，由脚本接管。
4. 进入 `us` 组手动选一个节点并固定，三个 AI 组默认使用 `us`。
5. `Proxy` 建议选 `auto` 或 `hk`，把 `us` 留给 AI（原因见 [3.3](#33-地区组的共享选择)）。
6. 终端工具（codex、claude、gemini 命令行，git、npm、curl 等）不读取系统代理，需设置环境变量，见 [10.2](#102-命令行工具)。

脚本只修改策略组、规则、DNS 和嗅探；端口、TUN、IPv6、局域网连接等由 Verge 界面控制，脚本写入的这些字段会被 Verge 覆盖。

## 3. 策略组设计

### 3.1 策略组一览

功能组名称首字母大写，地区组和 `auto` 为小写。每个策略组都配有图标（[Qure](https://github.com/Koolson/Qure) 和 [LobeHub Icons](https://github.com/lobehub/lobe-icons)）。

| 策略组 | 类型 | 可选项 | 用途 |
| --- | --- | --- | --- |
| `ChatGPT` | 手动选择 | `us`（默认）、`jp`、`sg`、`tw`、`eu` | ChatGPT、Codex |
| `Claude` | 手动选择 | 同上 | Claude、Claude Code |
| `Gemini` | 手动选择 | 同上 | Gemini、Gemini CLI、Antigravity、Google 登录 |
| `Proxy` | 手动选择 | `auto`（默认）、全部非空地区组 | 除 AI 以外的所有境外连接 |
| `us` `hk` `jp` `tw` `sg` `eu` `other` | 手动选择 | 该地区的节点 | 在组内固定具体节点 |
| `auto` | 自动测速 | 全部节点 | 选延迟最低的节点，容差 50 ms |

四个功能组只列地区组，不列单个节点，界面简洁，节点统一在地区组内选择。

### 3.2 AI 组为什么只能选部分地区

- **排除香港**：OpenAI、Anthropic、Google Gemini 都不在香港提供服务，用香港节点会被拒绝。
- **排除受限地区**：澳门、俄罗斯、伊朗、朝鲜、叙利亚、古巴、白俄罗斯同样不在服务范围内。
- **排除混有受限节点的地区组**：例如 `other` 里有俄罗斯节点时，整个 `other` 组不出现在 AI 组中，避免误选。
- **不提供 `auto`**：自动测速会频繁更换出口 IP，AI 服务对 IP 跳变敏感，容易触发账号风控。
- **回退机制**：如果订阅里识别不出任何 AI 可用地区，AI 组退而列出除 `hk` 外的所有非空地区组，并在日志中提示。

### 3.3 地区组的共享选择

地区组是手动选择组，它选中的节点被所有引用它的功能组共享：

- 三个 AI 组都选 `us` 时，使用同一个节点。
- 如果 `Proxy` 也选 `us`，为浏览网页在 `us` 组里换节点，AI 的出口 IP 也会跟着变。

因此建议 `Proxy` 用 `auto` 或 `hk`，把 `us` 留给 AI，并在 `us` 组里固定一个节点后不再频繁更换。

### 3.4 空地区组的处理

某个地区没有节点时，该地区组仍然保留，但只包含 `REJECT`（拒绝连接），不会被功能组引用。空策略组在 mihomo 中可能被填入兼容用的占位出站，存在流量误走直连、暴露真实 IP 的风险，所以这里显式指向 `REJECT`，宁可连接失败也不直连。

## 4. 节点地区识别

脚本按节点名称识别地区，每个节点只归入第一个匹配的地区，顺序为 `hk → tw → jp → sg → us → eu`，都不匹配的归入 `other`。

| 地区 | 中英文关键字（不区分大小写，示例） | 地区代码（区分大小写） |
| --- | --- | --- |
| `hk` | 香港、Hong Kong | HK、HKG |
| `tw` | 台湾、台灣、台北、高雄、Taiwan、Taipei | TW、TWN、TPE |
| `jp` | 日本、东京、大阪、埼玉、Japan、Tokyo、Osaka | JP、JPN |
| `sg` | 新加坡、狮城、Singapore | SG、SGP |
| `us` | 美国、洛杉矶、圣何塞、硅谷、西雅图、纽约、达拉斯、United States、America | US、USA |
| `eu` | 欧洲及英、德、法、荷、瑞士、北欧、南欧等国家和主要城市 | EU、UK、GB、GBR、DE、DEU、FR、NL 等 |

设计细节：

- **地区代码区分大小写，且前后不能紧挨英文字母**：避免把 `AUS`（澳大利亚）、`Plus` 误判为 `US`，同时允许 `US01`、`USA_1` 这类写法。
- **不使用旗帜符号识别**：只按名称和代码识别。有的机场给台湾节点标 🇨🇳 旗帜，按旗帜识别会出错。
- **AI 受限判断不使用 `CN`**：部分机场把台湾标注为中国，CN2 等线路名也含 `CN`，按 `CN` 排除会误伤可用节点。
- **过滤提示用的假节点**：名称含“剩余、到期、过期、流量、官网、套餐、重置、Traffic、Expire、Reset”的节点不进入任何策略组。
- **名称冲突检查**：节点名与策略组名重复时直接报错，避免引用混乱。

节点名称只能说明机场标注的地区，不能证明实际出口地区，也不能证明 AI 服务一定可用。

## 5. 分流规则

规则自上而下匹配，命中即停。整体分为 6 层：

| 层 | 内容 | 去向 | 设计原因 |
| --- | --- | --- | --- |
| 1 | 本机与局域网：`localhost`、`.local`、`.lan`、`.home.arpa`、`.test` 等域名；无点号主机名（如 `nas`）；私有 IP 段 | DIRECT | 放在最前，保证本地服务在任何情况下都可访问；IP 段直接写入，规则集下载前也生效 |
| 2 | 北京工业大学 `bjut.edu.cn`（含 VPN、WebVPN）、校园 VPN 客户端进程、学术数据库 | DIRECT | 校园网和学校授权资源不受代理影响，详见第 7 节 |
| 3 | 自定义代理域名 | Proxy | 用户补充 |
| 4 | AI 服务域名：内置核心域名 + MetaCubeX 规则集（openai、anthropic、google-gemini） | 对应 AI 组 | 放在广告拦截前，避免 AI 客户端用到的统计、风控域名被误拦 |
| 5 | AI 客户端进程（境内连接除外） | 对应 AI 组 | 客户端访问的其他境外地址也走同一出口，详见第 6 节 |
| 6 | Loyalsoldier 白名单模式，按仓库 README 顺序 | 见下 | 境内直连，其余代理 |

第 6 层完整顺序：

```text
RULE-SET,applications,DIRECT     常用下载工具等软件直连
DOMAIN,clash.razord.top,DIRECT   面板域名（README 原有）
DOMAIN,yacd.haishan.me,DIRECT
RULE-SET,private,DIRECT          私有网络域名
RULE-SET,reject,REJECT           广告拦截（可关闭）
RULE-SET,icloud,DIRECT           iCloud
RULE-SET,apple,DIRECT            Apple 境内可直连域名
RULE-SET,google,Proxy            Google
RULE-SET,proxy,Proxy             境外域名列表
RULE-SET,direct,DIRECT           境内域名列表
RULE-SET,lancidr,DIRECT          局域网 IP
RULE-SET,cncidr,DIRECT           中国大陆 IP
RULE-SET,telegramcidr,Proxy      Telegram IP
GEOIP,LAN,DIRECT
GEOIP,CN,DIRECT
MATCH,Proxy                      其余全部走代理
```

关于未收录域名：前面的域名规则都没命中时，`lancidr`、`cncidr` 这类 IP 规则会触发一次 DNS 解析。解析经代理向境外 DoH 加密发出，结果是大陆 IP 就直连（照顾未收录的境内小网站），否则落到 `MATCH` 走代理。

规则集（`.txt` / `.yaml`）经 `Proxy` 从 GitHub 原始地址下载，每 24 小时更新一次。不用 jsDelivr 镜像，是因为它有约 12 小时的更新延迟，且国内访问不稳定。

## 6. AI 客户端进程识别

### 6.1 为什么要按进程识别

域名规则无法穷举 AI 客户端访问的所有地址（登录、更新、插件市场、验证码等）。这些地址如果落到 `Proxy`，就会和 AI 服务用不同的出口 IP，增加风控风险；如果落到香港节点，还可能因为地区限制而失败。按进程识别后，AI 客户端的所有境外连接都走对应 AI 组，出口保持一致。

### 6.2 覆盖范围

| 策略组 | macOS | Windows | Linux |
| --- | --- | --- | --- |
| ChatGPT | ChatGPT.app、Codex.app 整个应用包（含 Helper、内置 codex、node） | 应用商店版 ChatGPT（`WindowsApps\OpenAI.*`）、`codex.exe` | `codex` 命令行 |
| Claude | Claude.app 及 Helper、桌面版内置的 Claude Code、原生安装的 Claude Code（`~/.local/share/claude/versions/`，进程名为版本号） | `AnthropicClaude` 安装目录、`claude.exe` | Claude Code、社区版 `claude-desktop` |
| Gemini | Gemini.app、Antigravity.app（含 `language_server`） | `Antigravity.exe` 及其 `language_server` | `antigravity`、`language_server`、`antigravity-server` |

另外按安装路径匹配 npm 安装的 Codex CLI（`@openai/codex`）和 Claude Code（`@anthropic-ai/claude-code`）。

### 6.3 匹配原则

- **不按通用进程名匹配**：`node`、`electron`、`python`、`chrome`、单独的 `language_server` 都不匹配，避免误伤 VS Code、浏览器等。只有位于 AI 应用自身安装目录内的 node、language_server 才会匹配。
- **路径分隔符兼容**：路径正则写作 `[/\\]`，同时适配 `/` 和 `\`。
- **Gemini CLI 例外**：它以通用的 node 进程运行，无法按进程识别，只靠 Gemini 相关域名分流。

### 6.4 境内连接例外

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

## 7. 校园网与学术资源

| 对象 | 处理 | 说明 |
| --- | --- | --- |
| `bjut.edu.cn` 全部子域名 | 直连，系统 DNS 解析 | 包括主站、图书馆、`vpn.bjut.edu.cn`、`webvpn.bjut.edu.cn`；校内专用地址只能由学校 DNS 解析，所以用系统 DNS |
| 校园 VPN 客户端 | 进程直连 | Array Networks MotionPro，兼容深信服 EasyConnect、aTrust |
| 学术数据库 | 直连，国内 DoH 解析 | 知网、万方、维普、IEEE、ACM、ScienceDirect、Springer、Nature、Wiley、Web of Science 等 29 个 |

- **VPN 判断依据**：vpn.bjut.edu.cn 返回的跳转路径 `/prx/000/` 是 Array Networks SSL VPN 的特征，对应客户端为 MotionPro；webvpn.bjut.edu.cn 使用 WenGine（网瑞达）WebVPN 系统。
- **学术数据库为什么直连**：这些数据库按来源 IP 判断学校订阅权限。在校园网内或连着学校 VPN 时，直连才能使用学校授权；走代理会失去授权。代价是出版商能看到真实 IP，不需要时可关闭 `academicDirect`。
- **校园 VPN 的前提**：使用学校 VPN 时请只开系统代理、不开 TUN。开启 TUN 后，VPN 客户端的流量和系统 DNS 都可能被接管，导致校内地址无法访问。

## 8. DNS 设计

### 8.1 解析分工

| 域名类别 | 解析服务器 | 查询出站 |
| --- | --- | --- |
| 无点号主机名、本地域名、`bjut.edu.cn` | 系统 DNS | 本机 |
| 学术数据库 | 阿里 `223.5.5.5`、腾讯 `1.12.12.12` DoH | DIRECT |
| AI 域名及 AI 规则集 | Cloudflare `1.1.1.1`、Google `8.8.8.8` DoH | 对应 AI 组 |
| 境内（private、direct、apple、icloud 规则集） | 阿里、腾讯 DoH | DIRECT |
| 机场节点域名 | 阿里、腾讯 DoH | DIRECT |
| 直连流量 | 按上述分工（`direct-nameserver-follow-policy: true`） | DIRECT |
| 其余全部域名 | Cloudflare、Google DoH | Proxy |

### 8.2 设计要点

- **远程解析**：系统代理模式下，浏览器把域名直接交给 mihomo，只要被域名规则命中，就由代理节点在远端解析，本机不产生 DNS 查询。
- **需要本地解析时加密发出**：未收录域名需要本地解析判断 IP 时，经代理向境外 DoH 查询，运营商看不到你查了哪些境外域名。
- **全部使用 IP 形式的 DoH**：不需要先解析 DoH 服务器自身的域名，引导用的 DNS 服务器（`default-nameserver`）也用 DoH。
- **用 `#策略组` 指定出站**：每个 DNS 服务器地址后用 `#DIRECT`、`#Proxy`、`#ChatGPT` 等指定查询走哪条线路，不依赖规则顺序。
- **直连流量用国内 DNS**：保证国内网站拿到国内 CDN 地址。
- **关闭 IPv6 解析**：避免 IPv6 地址绕过代理或因节点不支持 IPv6 而连接失败。
- **DNS 模式默认 `redir-host`**：只用系统代理时，Fake-IP 用不上；开启 TUN 时，redir-host 对校园 VPN 等需要真实 IP 的程序更稳妥。需要时可打开 `fakeIp` 开关。

## 9. 系统代理与 TUN

| 流量来源 | 系统代理能否覆盖 | 说明 |
| --- | --- | --- |
| 浏览器 | 能 | 读取系统代理 |
| ChatGPT、Claude、Gemini、Antigravity 桌面客户端 | 能 | 原生或 Electron 应用，读取系统代理；已确认 ChatGPT 内置的 Codex 服务进程经系统代理连接 |
| 终端工具 | 不能 | 需设置 `HTTPS_PROXY` 等环境变量 |
| UDP 流量（WebRTC、游戏） | 不能 | 系统代理只转发 TCP |

推荐只用系统代理，原因：

- 不接管系统路由和 DNS，不影响校园 VPN。
- 行为可预期，出问题容易定位。

如果某个应用在 Verge「连接」页始终看不到，说明它绕过了系统代理，这时再考虑开启 TUN，并同时打开 `fakeIp`、`sniff` 两个开关。

## 10. 隐藏真实 IP

### 10.1 覆盖范围

| 场景 | 对方看到的 IP |
| --- | --- |
| 境外网站、AI 服务 | 代理节点 IP |
| 境内网站、校园网、学术数据库 | 真实 IP（按设计直连） |
| 绕过系统代理的程序 | 真实 IP（需设环境变量或开 TUN） |
| 浏览器 WebRTC | 可能暴露真实 IP（需单独处理） |

### 10.2 命令行工具

在 `~/.zshrc` 中加入（端口改为 Verge 界面中实际的「混合代理端口」，默认 7897）：

```bash
export http_proxy=http://127.0.0.1:7897 https_proxy=http://127.0.0.1:7897 all_proxy=socks5h://127.0.0.1:7897
export HTTP_PROXY=$http_proxy HTTPS_PROXY=$https_proxy ALL_PROXY=$all_proxy
export no_proxy=localhost,127.0.0.1,::1,.local NO_PROXY=localhost,127.0.0.1,::1,.local
```

国内地址进入 mihomo 后仍按规则直连，不会绕道海外。

### 10.3 WebRTC

WebRTC 使用 UDP，不经过系统代理，可能暴露真实 IP：

- Chrome：安装 Google 官方扩展 WebRTC Network Limiter，选择“使用代理服务器”。
- Firefox：在 `about:config` 中将 `media.peerconnection.ice.proxy_only` 设为 `true`。

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
| `fakeIp` | `false` | Fake-IP DNS 模式，仅在开启 TUN 时考虑 |
| `sniff` | `false` | 流量嗅探，仅在开启 TUN 时考虑；开启后跳过校园网和局域网地址 |

### 11.2 自定义列表

| 常量 | 用途 |
| --- | --- |
| `CAMPUS_DOMAINS` | 校园网/内网域名，直连并用系统 DNS |
| `CAMPUS_VPN_PROCESS` | 校园 VPN 客户端进程名正则，直连 |
| `ACADEMIC_DOMAINS` | 学术数据库域名，直连 |
| `EXTRA_DIRECT_DOMAINS` | 额外直连域名 |
| `EXTRA_DIRECT_CIDRS` | 额外直连 IP 段 |
| `EXTRA_PROXY_DOMAINS` | 额外走 `Proxy` 的域名 |
| `AI_PROCESSES` | AI 客户端进程规则；新客户端可在 Verge「连接」页查到进程名后加入 |
| `REGIONS` | 地区关键字；机场命名方式特殊时在此补充 |

域名只填主机名，不含协议和路径，后缀匹配会同时覆盖所有子域名。

## 12. 验证方法

1. **看分流**：Verge「连接」页中，每条连接都会显示命中的规则和使用的策略组。确认 ChatGPT、Claude、Gemini 客户端的连接落在对应 AI 组，北工大和国内网站为 DIRECT。
2. **看 AI 出口**：访问 `https://chatgpt.com/cdn-cgi/trace`、`https://claude.ai/cdn-cgi/trace`，`loc=` 应为所选地区（如 `US`）。
3. **看泄露**：用 browserleaks.com 的 WebRTC 和 DNS 页面检查，境外 DNS 解析服务器不应出现国内运营商。

## 13. 已知限制

- 节点地区按名称识别，不能证明实际出口地区或 AI 可用性。
- 只有节点列表（`proxies`）的订阅会生效；纯 `proxy-providers` 订阅脚本不做修改，原样返回。
- Windows、Linux 的进程路径按常见安装位置编写，只在 macOS 上用真实进程验证过。
- Gemini CLI 以 node 运行，只能靠域名分流。
- 系统代理不覆盖 UDP 和不读取系统代理的程序。
- 策略组图标托管在 raw.githubusercontent.com 和 unpkg.com，代理未连通时可能无法显示，不影响分流。

## 14. Loon 配置

`Loon-Config-V1.3-20261005.conf` 按本脚本 V2.2 的策略组和分流思路改写，已在 Loon for Mac 0.4.0 上实测导入和分流。

### 14.1 导入方法（配置与节点分开）

Loon 的订阅节点写在配置文件的 `[Remote Proxy]` 段里。直接导入不含订阅的配置文件，会替换掉当前配置，节点随之消失。为此，配置文件放在秘密 Gist 上，通过链接导入，并使用 Loon 的「替换并保留节点和证书」功能，使配置更新与节点互不影响。

- 配置链接：`https://gist.githubusercontent.com/leeyaoid/26aff17b020bbb75b7d71ca88dd8f8c5/raw/gfw-loon.conf`
- 该链接始终指向最新版本；Gist 不公开列出，但持有链接的人可以访问。文件中不含订阅链接。

**首次使用**

1. Loon「配置 → 从 URL 导入」，填入上面的配置链接，选择「作为新配置添加」。
2. 切换到新配置 `gfw-loon.conf`，在「节点」中添加机场订阅（只需添加一次）。
3. 进入 `us` 组固定一个节点；`Proxy` 建议选 `auto` 或 `hk`。

**以后更新配置**

1. 再次「从 URL 导入」同一个链接，提示配置已存在时选「替换使用中的配置」。
2. 在随后的提示中选择 **「替换并保留节点和证书」**，不要选「完全覆盖」。

已在 Loon for Mac 0.4.0 上实测：替换后规则和策略组更新为最新版本，订阅节点和分流均正常。

### 14.2 与 Clash 版的对应

| 项目 | Loon 配置的实现 |
| --- | --- |
| 策略组 | 与 V2.2 相同：`ChatGPT`、`Claude`、`Gemini`（只能选 us、jp、sg、tw、eu）、`Proxy`（auto 加 7 个地区组）、地区组、`auto` |
| 节点归类 | 用 Loon「筛选节点」（`NameRegex`）实现与 V2.2 相同的识别规则和优先级，每个节点只归入一个地区；用真实订阅核对，各组节点与 V2.2 一致 |
| 规则集 | Loyalsoldier/surge-rules 的 RULE-SET 版本，与 clash-rules 同源，Loon 可直接识别 |
| AI 域名 | V2.2 内置核心域名加 MetaCubeX 规则集快照（2026-10-05），写在本地规则中，不会自动更新 |
| 北工大 | `bjut.edu.cn` 直连，系统 DNS 解析，不经过 Loon（`skip-proxy`），返回真实 IP（`real-ip`） |
| 隐藏 IP | 只用 IPv4（Loon 保存时会写成 `v4-only`）；禁用 STUN，防止 WebRTC 泄露；节点不支持 UDP 时拒绝，不回落直连 |
| 本机代理端口 | HTTP `7891`、SOCKS5 `7892`，只监听 127.0.0.1，与 Clash 的 `7890` 分开、互不冲突。HTTP 端口不接受 SOCKS 请求，SOCKS5 须用 7892 |

### 14.3 与 Clash 版的差异

| 项目 | 原因与做法 |
| --- | --- |
| 规则优先级 | Loon 中目标为域名时先匹配全部域名类规则，再匹配 IP 类规则；本地规则优先于订阅规则，与文件中的位置无关 |
| DNS | Loon 不能让 DNS 查询经过代理，因此未收录的域名不在本地解析，直接交给 `Proxy` 由节点远程解析，DNS 不泄露；代价是未收录的境内小网站也会走代理 |
| 中国大陆 IP 规则集（cncidr） | 默认关闭，可在 Loon 中开启；开启后未收录的境内网站会先在本地解析再直连 |
| 进程规则 | 只有 macOS 版 Loon 支持。进程名必须精确匹配（不区分大小写，不支持通配符），因此逐一列出 AI 应用的各个进程名；不支持按安装路径匹配 |
| AI 进程的境内例外 | 本地进程规则会先于订阅的境内域名列表生效，因此用 `AND,((OR,(进程…)),(NOT,((GEOIP,CN)))),AI组` 排除解析为中国大陆 IP 的连接；这部分连接会用国内 DoH 做一次本地 DNS 查询 |
| 常用软件直连（applications） | 依赖进程名，iOS 上无法使用，已去掉 |
| 图标 | Loon 不显示 SVG 图标，Claude、Gemini 使用 LobeHub 的 PNG 版本 |

### 14.4 让所有 App 使用 Loon 的端口

Loon 连接后会接管本机的默认路由，没有单独设置代理的 App 都会经过 Loon。需要注意的是**已经固定了代理地址**的 App：它们会继续连接旧端口。

1. **系统代理**：打开 Loon 主界面右上角的「系统代理」开关。之后读取系统代理的 App（浏览器、Claude Desktop、ChatGPT 等）使用 `127.0.0.1:7891` / `7892`。
2. **Claude Desktop**：它在**启动时**读取一次系统代理，并固定给之后的所有 Claude Code 会话使用；代理不可用时请求直接失败，不会改为直连（日志记录为 `[CCD] Resolved system proxy for Code sessions: …`）。因此在 Clash 和 Loon 之间切换后，需要完全退出（`⌘Q`）并重新打开 Claude Desktop。
3. **终端**：在 `~/.zshrc` 中按端口是否可用自动选择代理，优先 Loon，其次 Clash，都未运行则不设代理：

```bash
if nc -z -G 1 127.0.0.1 7891 >/dev/null 2>&1; then
  __http_port=7891; __socks_port=7892
elif nc -z -G 1 127.0.0.1 7890 >/dev/null 2>&1; then
  __http_port=7890; __socks_port=7890
fi
if [ -n "$__http_port" ]; then
  export http_proxy=http://127.0.0.1:$__http_port https_proxy=http://127.0.0.1:$__http_port all_proxy=socks5h://127.0.0.1:$__socks_port
  export HTTP_PROXY=$http_proxy HTTPS_PROXY=$https_proxy ALL_PROXY=$all_proxy
  export no_proxy=localhost,127.0.0.1,::1,.local
  export NO_PROXY=$no_proxy
fi
unset __http_port __socks_port
```

### 14.5 实测结果（Loon for Mac 0.4.0）

| 项目 | 结果 |
| --- | --- |
| 导入 | 12 个策略组加载成功；10 组规则共 326,464 条，远程规则集全部下载成功 |
| AI | ChatGPT、Claude、Gemini、Google 登录走美国节点，`/cdn-cgi/trace` 显示 `loc=US` |
| AI 客户端进程 | Claude 桌面版的统计上报（datadoghq.com）走 Claude 组；以 AI 进程名访问百度、B 站、北工大时直连 |
| 其他境外 | Google、GitHub、未收录网站走 `Proxy` |
| 直连 | 百度、北工大（含 WebVPN）、IEEE、ScienceDirect、Apple 直连 |
| 广告 | 广告域名在 DNS 阶段被拦截 |
| DNS | 全部使用加密 DoH；未收录的境外域名不在本地解析 |

### 14.6 已知限制

- iOS 版 Loon 不支持进程规则，AI 应用只能靠域名分流；是否接受这些规则行未在 iOS 上验证。
- iOS 同一时间只能运行一个 VPN，北工大 VPN 客户端（MotionPro）与 Loon 不能同时开启；WebVPN 不受影响。
- 校园 VPN 客户端的进程名（MotionPro、EasyConnect、aTrust 等）未在真机上核实。
- 某地区没有节点时空分组的表现未验证。
- 不建议 Loon 与 Clash Verge 同时运行：端口已分开不会冲突，但两者会争夺系统代理设置，流量也可能经过两层代理。

## 15. 参考资料

- [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules)：规则集及白名单模式
- [Clash Verge Rev 文档：扩展脚本](https://www.clashverge.dev/guide/script.html)
- [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)：AI 服务规则集
- [mihomo 文档](https://wiki.metacubex.one/)：规则、DNS、策略组配置说明
- [Loon 官方手册](https://github.com/Loon0x00/LoonManual)：Loon 配置语法
- [Loyalsoldier/surge-rules](https://github.com/Loyalsoldier/surge-rules)：Loon 使用的规则集（与 clash-rules 同源）
- [Koolson/Qure](https://github.com/Koolson/Qure)、[lobehub/lobe-icons](https://github.com/lobehub/lobe-icons)：策略组图标
