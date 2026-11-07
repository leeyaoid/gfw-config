/**
 * Clash 全局扩展脚本 / 覆写脚本 V3.0（mihomo 内核）
 * 适用客户端：Clash Verge Rev（全局扩展脚本）、FlClash（覆写脚本）、clash.md 的 Clash（覆写脚本）
 * 策略组：
 *   AI      ChatGPT（含 Codex）、Claude（含 Claude Code）、Gemini（含 Antigravity），默认 sg
 *   总出口  Proxy（未单独分流的境外连接）
 *   服务    YouTube、Netflix、Disney+、Spotify、TikTok、Bilibili、Telegram、X、GitHub、Microsoft、Apple、Steam
 *   地区    us / hk / jp / tw / sg / kr / eu / other，auto 为全节点测速
 *   功能组只选择地区组（不列具体节点），具体节点在地区组内选择
 * 分流：本地与北京工业大学（含 VPN、WebVPN）直连 → AI 域名与客户端进程 → 广告拦截 → 各服务 → Loyalsoldier 白名单模式
 * DNS：境外域名经代理加密解析；境内域名用国内 DoH；本地与校园网用系统 DNS
 * 入站：电脑只开系统代理即可，TUN 兼容；手机端（Android VPN、iOS 隧道）相当于 TUN，默认开启 Fake-IP 与嗅探
 * 运行环境：只用同步代码；FlClash 不传第二个参数（配置名），clash.md 不保证提供 console
 */

// ================= 开关 =================
const OPTIONS = {
  blockAds: true, // Loyalsoldier reject 广告拦截；个别网站异常时改为 false
  blockStun: false, // 拦截 STUN（UDP 3478、19302-19309）；会影响 FaceTime、Google Meet 等通话，默认关闭
  academicDirect: true, // 学术数据库直连，保留校园 IP 授权
  fakeIp: true, // Fake-IP DNS 模式；手机端与 TUN 下使域名规则覆盖更完整，电脑只开系统代理时不起作用
  sniff: true // 流量嗅探：从 TLS / HTTP / QUIC 中还原域名；电脑只开系统代理时不起作用
};

// ================= 自定义（只填域名或 CIDR，不含协议和路径） =================
// 北京工业大学：主站、图书馆、VPN（vpn.bjut.edu.cn）、WebVPN（webvpn.bjut.edu.cn）均为其子域名
const CAMPUS_DOMAINS = ["bjut.edu.cn"];
// 校园 VPN 客户端直连：Array MotionPro（北工大 VPN）、深信服 EasyConnect / aTrust（电脑端进程名）
const CAMPUS_VPN_PROCESS = "(?i)^(motionpro|easyconnect|ecagent|atrust)";
// 学术数据库：按来源 IP 识别校园订阅权限，直连才能使用学校授权
const ACADEMIC_DOMAINS = [
  "cnki.net", "wanfangdata.com.cn", "cqvip.com",
  "ieee.org", "acm.org", "sciencedirect.com", "elsevier.com", "springer.com", "springernature.com",
  "nature.com", "science.org", "wiley.com", "tandfonline.com", "sagepub.com", "webofscience.com",
  "clarivate.com", "scopus.com", "jstor.org", "iop.org", "aps.org", "acs.org", "rsc.org",
  "oup.com", "cambridge.org", "proquest.com", "ebsco.com", "ebscohost.com", "emerald.com", "siam.org"
];
// 国内应用直连：坚果云（域名、电脑端进程、Android 包名）
const APP_DIRECT_DOMAINS = ["jianguoyun.com"];
const APP_DIRECT_PROCESS = "(?i)^(nutstore|nutstorefilesd)(\\.exe)?$";
const APP_DIRECT_PACKAGES = ["nutstore.android"];
const EXTRA_DIRECT_DOMAINS = [];
const EXTRA_DIRECT_CIDRS = [];
const EXTRA_PROXY_DOMAINS = [];

// ================= 基础参数 =================
const TEST_URL = "https://www.gstatic.com/generate_204";

// 策略组图标（PNG）
const QURE_ICON_BASE = "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color";
const LOBEHUB_ICON_BASE = "https://unpkg.com/@lobehub/icons-static-png@1.90.0/light";
const qure = name => `${QURE_ICON_BASE}/${name}.png`;

// 策略组名称：功能组首字母大写，地区组与 auto 为小写
const G = { CHATGPT: "ChatGPT", CLAUDE: "Claude", GEMINI: "Gemini", PROXY: "Proxy", AUTO: "auto" };
const AI_GROUPS = [G.CHATGPT, G.CLAUDE, G.GEMINI];

const ICONS = {
  [G.CHATGPT]: qure("ChatGPT"),
  [G.CLAUDE]: `${LOBEHUB_ICON_BASE}/claude-color.png`,
  [G.GEMINI]: `${LOBEHUB_ICON_BASE}/gemini-color.png`,
  [G.PROXY]: qure("Proxy"),
  [G.AUTO]: qure("Auto"),
  us: qure("United_States"),
  hk: qure("Hong_Kong"),
  jp: qure("Japan"),
  tw: qure("Taiwan"),
  sg: qure("Singapore"),
  kr: qure("Korea"),
  eu: qure("European_Union"),
  other: qure("World_Map")
};

// 订阅中的流量、到期等提示用“伪节点”，不参与任何策略组
const INFO_NODE_RE = /剩余|到期|过期|流量|官网|套餐|重置|Traffic|Expire|Reset/i;

// 地区关键字：中文/英文名称不区分大小写；英文代码区分大小写且前后不能是字母（避免 AUS、Plus 误判为 US）
// 数组顺序即识别优先级，每个节点只归入第一个匹配的地区；都不匹配的归入 other
const REGIONS = [
  { key: "hk", words: "香港|Hong ?Kong", codes: "HK|HKG" },
  { key: "tw", words: "台湾|台灣|臺灣|台北|臺北|高雄|Taiwan|Taipei|Kaohsiung", codes: "TW|TWN|TPE" },
  { key: "jp", words: "日本|东京|東京|大阪|埼玉|Japan|Tokyo|Osaka|Saitama", codes: "JP|JPN" },
  { key: "kr", words: "韩国|韓國|首尔|首爾|春川|Korea|Seoul|Chuncheon", codes: "KR|KOR" },
  { key: "sg", words: "新加坡|狮城|獅城|Singapore", codes: "SG|SGP" },
  { key: "us", words: "美国|美國|洛杉矶|洛杉磯|圣何塞|聖何塞|硅谷|矽谷|西雅图|西雅圖|纽约|紐約|芝加哥|达拉斯|達拉斯|United ?States|America|Los ?Angeles|San ?Jose|Seattle|New ?York|Dallas", codes: "US|USA" },
  {
    key: "eu",
    words: "欧洲|歐洲|英国|英國|德国|德國|法国|法國|荷兰|荷蘭|瑞士|瑞典|芬兰|芬蘭|挪威|丹麦|丹麥|意大利|義大利|西班牙|葡萄牙|爱尔兰|愛爾蘭|奥地利|奧地利|比利时|比利時|波兰|波蘭|捷克|卢森堡|盧森堡|伦敦|倫敦|法兰克福|法蘭克福|巴黎|阿姆斯特丹|Europe|United ?Kingdom|Britain|Germany|France|Netherlands|Switzerland|Sweden|Finland|Norway|Denmark|Italy|Spain|Portugal|Ireland|Austria|Belgium|Poland|Czech|Luxembourg|London|Frankfurt|Paris|Amsterdam",
    codes: "EU|UK|GB|GBR|DE|DEU|FR|FRA|NL|NLD|CHE|SWE|FIN|NOR|DNK|ITA|ESP|PRT|IRL|AUT|BEL|POL|CZE|LUX"
  }
];
const REGION_DISPLAY_ORDER = ["us", "hk", "jp", "tw", "sg", "kr", "eu", "other"];

// AI 服务不支持的地区（香港、澳门、俄罗斯等）。不能按 CN 排除：部分机场台湾节点标注为中国，CN2 线路也含 CN
const AI_BLOCKED = {
  words: "香港|澳门|澳門|俄罗斯|俄羅斯|Russia|伊朗|Iran|朝鲜|朝鮮|叙利亚|敘利亞|古巴|白俄|Belarus|回国|大陆",
  codes: "HK|HKG|MO|MAC|RU|RUS|IR|IRN|KP|PRK|SY|SYR|CU|CUB|BY|BLR"
};
// AI 地区组顺序，第一个有节点的地区为默认值
const AI_REGION_ORDER = ["sg", "us", "jp", "tw", "kr", "eu", "other"];

// AI 核心域名：规则集下载前也能生效（完整列表由 MetaCubeX 规则集补充）
const AI_DOMAINS = {
  [G.CHATGPT]: ["openai.com", "chatgpt.com", "chat.com", "oaistatic.com", "oaiusercontent.com", "oaistatsig.com", "sora.com"],
  [G.CLAUDE]: ["anthropic.com", "claude.ai", "claude.com", "clau.de", "claudeusercontent.com", "claudemcpclient.com", "claudemcpcontent.com"],
  [G.GEMINI]: [
    "gemini.google.com", "gemini.google", "aistudio.google.com", "makersuite.google.com", "ai.google.dev", "bard.google.com",
    "notebooklm.google.com", "antigravity.google", "generativelanguage.googleapis.com", "aiplatform.googleapis.com",
    "cloudcode-pa.googleapis.com", "daily-cloudcode-pa.googleapis.com", "cloudaicompanion.googleapis.com", "aisandbox-pa.googleapis.com",
    "alkalimakersuite-pa.clients6.google.com",
    // Google 登录与 Gemini 同一出口，避免 Gemini CLI / Antigravity 登录时地区不一致
    "accounts.google.com", "oauth2.googleapis.com"
  ]
};
const AI_RULE_SETS = { [G.CHATGPT]: "openai", [G.CLAUDE]: "anthropic", [G.GEMINI]: "google-gemini" };

// AI 客户端进程（macOS / Windows / Linux / Android）；不按 node、electron、python 等通用名称匹配
// 路径分隔符写作 [/\\]，同时兼容 / 和 \；Android 按 App 包名匹配；iOS 不支持按进程分流
const AI_PROCESSES = {
  [G.CHATGPT]: [
    // ChatGPT、Codex 主程序与 Helper，Codex CLI（codex / codex.exe / codex-<平台>）
    "PROCESS-NAME-REGEX,(?i)^(chatgpt|codex)(-[a-z0-9_.-]+)?( helper| service)?( \\([^)]*\\))?(\\.exe)?$",
    "PROCESS-PATH-REGEX,(?i)[/\\\\](ChatGPT|Codex)\\.app[/\\\\]", // macOS 应用包（含内置 codex、node）
    "PROCESS-PATH-REGEX,(?i)[/\\\\]WindowsApps[/\\\\]OpenAI\\.", // Windows 应用商店版
    "PROCESS-PATH-REGEX,(?i)[/\\\\]@openai[/\\\\]codex[/\\\\]", // npm 安装的 Codex CLI
    "PROCESS-NAME,com.openai.chatgpt" // Android
  ],
  [G.CLAUDE]: [
    // Claude 桌面版与 Helper、Claude Code（claude / claude.exe）、Linux 社区版 claude-desktop
    "PROCESS-NAME-REGEX,(?i)^claude(-desktop)?( helper)?( \\([^)]*\\))?(\\.exe)?$",
    "PROCESS-PATH-REGEX,(?i)[/\\\\]Claude\\.app[/\\\\]", // macOS 应用包，及桌面版内置的 Claude Code
    "PROCESS-PATH-REGEX,(?i)[/\\\\]AnthropicClaude[/\\\\]", // Windows 桌面版
    "PROCESS-PATH-REGEX,(?i)[/\\\\]\\.local[/\\\\]share[/\\\\]claude[/\\\\]versions[/\\\\]", // Claude Code 原生安装（进程名为版本号）
    "PROCESS-PATH-REGEX,(?i)[/\\\\]@anthropic-ai[/\\\\]claude-code[/\\\\]", // npm 安装的 Claude Code
    "PROCESS-NAME,com.anthropic.claude" // Android
  ],
  [G.GEMINI]: [
    // Gemini 桌面版、Antigravity 主程序与 Helper、Antigravity 远程服务端
    "PROCESS-NAME-REGEX,(?i)^(gemini|antigravity|antigravity-server|agy)( helper)?( \\([^)]*\\))?(\\.exe)?$",
    "PROCESS-PATH-REGEX,(?i)[/\\\\](Gemini|Antigravity)\\.app[/\\\\]", // macOS 应用包（含 language_server）
    // Windows / Linux 的 Antigravity 安装目录，只匹配其自身的程序和语言服务器
    "PROCESS-PATH-REGEX,(?i)[/\\\\](antigravity|\\.antigravity-server)[/\\\\](.*[/\\\\])?(antigravity[^/\\\\]*|language_server[^/\\\\]*|node(\\.exe)?)$",
    "PROCESS-NAME,com.google.android.apps.bard" // Android 版 Gemini
  ]
};

// 服务策略组（按界面显示顺序）
// choices：proxy = Proxy + 地区组；proxyDirect = Proxy + DIRECT + 地区组；directFirst = DIRECT + Proxy + 地区组
//          ai = 与 AI 组相同的地区（不含 hk），prefer 为默认地区；bilibili = DIRECT + hk + tw
// sets：MetaCubeX geosite 规则集，按顺序生成规则；ipSets：MetaCubeX geoip 规则集
const SERVICES = [
  { name: "YouTube", choices: "proxy", icon: qure("YouTube"), sets: ["youtube"] },
  { name: "Netflix", choices: "proxy", icon: qure("Netflix"), sets: ["netflix"], ipSets: ["netflix"] },
  { name: "Disney+", choices: "proxy", icon: qure("Disney+"), sets: ["disney"] },
  { name: "Spotify", choices: "proxy", icon: qure("Spotify"), sets: ["spotify"] },
  { name: "TikTok", choices: "ai", prefer: "us", icon: qure("TikTok"), sets: ["tiktok"] }, // 香港不提供 TikTok
  { name: "Bilibili", choices: "bilibili", icon: qure("bilibili"), sets: ["bilibili"] }, // 平时直连，看港澳台番剧时切 hk / tw
  { name: "Telegram", choices: "proxy", icon: qure("Telegram"), sets: ["telegram"] }, // IP 规则沿用 Loyalsoldier telegramcidr
  { name: "X", choices: "proxy", icon: qure("X"), sets: ["twitter"], ipSets: ["twitter"] },
  { name: "GitHub", choices: "proxy", icon: qure("GitHub"), sets: ["github"] }, // 须在 Microsoft 之前：microsoft 规则集包含 GitHub
  { name: "Microsoft", choices: "proxyDirect", icon: qure("Microsoft"), sets: ["microsoft"], directSets: ["microsoft@cn"] },
  { name: "Apple", choices: "directFirst", icon: qure("Apple") }, // 规则沿用 Loyalsoldier icloud、apple（Apple 境内可直连域名）
  { name: "Steam", choices: "proxyDirect", icon: qure("Steam"), sets: ["steam"], directSets: ["steam@cn"] }
];
const SVC = Object.fromEntries(SERVICES.map(s => [s.name, s.name]));
// 哔哩哔哩国际版（bilibili.tv）：国内直连打不开，归入 Proxy；须在 Bilibili 之前匹配
const PROXY_SETS = ["biliintl"];

// 本机与局域网
const LOCAL_DOMAINS = ["localhost", "local", "lan", "localdomain", "home.arpa", "test"];
const LOCAL_CIDRS = ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "100.64.0.0/10", "::1/128", "fc00::/7", "fe80::/10"];

// DNS 服务器（均用 IP 形式的 DoH；# 后为该 DNS 查询的出站策略）
const DOMESTIC_DNS = ["https://223.5.5.5/dns-query#DIRECT", "https://1.12.12.12/dns-query#DIRECT"]; // 阿里、腾讯
const foreignDns = group => [`https://1.1.1.1/dns-query#${group}`, `https://8.8.8.8/dns-query#${group}`]; // Cloudflare、Google

// ================= 工具函数 =================
function log(message) {
  try {
    if (typeof console !== "undefined" && console && typeof console.log === "function") console.log(message);
  } catch (e) {
    // 部分客户端没有 console，忽略
  }
}

function buildMatcher(def) {
  const words = new RegExp(def.words, "i");
  const codes = new RegExp("(^|[^A-Za-z])(" + def.codes + ")([^A-Za-z]|$)");
  return name => words.test(name) || codes.test(name);
}

function ruleProvider(behavior, url, path) {
  return { type: "http", behavior, format: "yaml", interval: 86400, proxy: G.PROXY, url, path };
}

const processSetName = group => "process-" + group.toLowerCase();
const aiSetName = group => "ai-" + group.toLowerCase();
const siteSetName = set => "site-" + set.replace("@", "-");
const ipSetName = set => "ip-" + set;
const cidrRule = (cidr, target) => `${cidr.includes(":") ? "IP-CIDR6" : "IP-CIDR"},${cidr},${target},no-resolve`;

// ================= 规则集 =================
// 经 Proxy 从 GitHub 原始地址下载，无 jsDelivr 的缓存延迟
const LS = "https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release";
const META = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo";
const lsProvider = (name, behavior) => ruleProvider(behavior, `${LS}/${name}.txt`, `./ruleset/loyalsoldier/${name}.yaml`);
const siteProvider = set => ruleProvider("domain", `${META}/geosite/${set}.yaml`, `./ruleset/metacubex/${siteSetName(set)}.yaml`);
const ipProvider = set => ruleProvider("ipcidr", `${META}/geoip/${set}.yaml`, `./ruleset/metacubex/${ipSetName(set)}.yaml`);

const RULE_PROVIDERS = {};
for (const name of ["reject", "icloud", "apple", "google", "proxy", "direct", "private"]) RULE_PROVIDERS[name] = lsProvider(name, "domain");
for (const name of ["telegramcidr", "cncidr", "lancidr"]) RULE_PROVIDERS[name] = lsProvider(name, "ipcidr");
RULE_PROVIDERS.applications = lsProvider("applications", "classical");
if (!OPTIONS.blockAds) delete RULE_PROVIDERS.reject;
for (const group of AI_GROUPS) {
  RULE_PROVIDERS[aiSetName(group)] = ruleProvider("domain", `${META}/geosite/${AI_RULE_SETS[group]}.yaml`, `./ruleset/metacubex/${AI_RULE_SETS[group]}.yaml`);
  // 进程规则放入内联集合，避免正则中的括号与 AND/NOT 语法冲突
  RULE_PROVIDERS[processSetName(group)] = { type: "inline", behavior: "classical", payload: AI_PROCESSES[group] };
}
for (const set of PROXY_SETS) RULE_PROVIDERS[siteSetName(set)] = siteProvider(set);
for (const s of SERVICES) {
  for (const set of [...(s.directSets || []), ...(s.sets || [])]) RULE_PROVIDERS[siteSetName(set)] = siteProvider(set);
  for (const set of s.ipSets || []) RULE_PROVIDERS[ipSetName(set)] = ipProvider(set);
}

// ================= 分流规则（自上而下，命中即止） =================
const CAMPUS_ALL = [...CAMPUS_DOMAINS, ...EXTRA_DIRECT_DOMAINS];
const ACADEMIC = OPTIONS.academicDirect ? ACADEMIC_DOMAINS : [];
// AI 进程例外：境内、私有、Apple 域名不进入 AI 组；未收录域名解析后为境内 IP 的也不进入
const AI_PROCESS_EXCEPT = [
  ...["private", "direct", "apple", "icloud"].map(s => `(NOT,((RULE-SET,${s})))`),
  "(OR,((RULE-SET,proxy),(RULE-SET,google),(NOT,((RULE-SET,cncidr)))))"
].join(",");

// 各服务的域名规则：境内部分先直连，其余进对应服务组
const SERVICE_RULES = [
  ...PROXY_SETS.map(set => `RULE-SET,${siteSetName(set)},${G.PROXY}`),
  ...SERVICES.flatMap(s => [
    ...(s.directSets || []).map(set => `RULE-SET,${siteSetName(set)},DIRECT`),
    ...(s.sets || []).map(set => `RULE-SET,${siteSetName(set)},${s.name}`)
  ])
];
// 各服务的 IP 规则（App 直接用 IP 连接时）
const SERVICE_IP_RULES = SERVICES.flatMap(s => (s.ipSets || []).map(set => `RULE-SET,${ipSetName(set)},${s.name}`));

const RULES = [
  // 1. 本机、局域网
  ...LOCAL_DOMAINS.map(d => `DOMAIN-SUFFIX,${d},DIRECT`),
  "DOMAIN-REGEX,^[^.]+$,DIRECT", // 无点号的主机名，如 nas、router
  ...[...LOCAL_CIDRS, ...EXTRA_DIRECT_CIDRS].map(c => cidrRule(c, "DIRECT")),
  // 拦截 STUN（默认关闭）：仅 TUN / 手机端有 UDP 流量经过
  ...(OPTIONS.blockStun ? ["AND,((NETWORK,UDP),(OR,((DST-PORT,3478),(DST-PORT,19302-19309)))),REJECT"] : []),
  // 2. 北京工业大学（含 VPN、WebVPN）、校园 VPN 客户端、坚果云、学术数据库
  ...CAMPUS_ALL.map(d => `DOMAIN-SUFFIX,${d},DIRECT`),
  `PROCESS-NAME-REGEX,${CAMPUS_VPN_PROCESS},DIRECT`,
  ...APP_DIRECT_DOMAINS.map(d => `DOMAIN-SUFFIX,${d},DIRECT`),
  `PROCESS-NAME-REGEX,${APP_DIRECT_PROCESS},DIRECT`,
  ...APP_DIRECT_PACKAGES.map(p => `PROCESS-NAME,${p},DIRECT`),
  ...ACADEMIC.map(d => `DOMAIN-SUFFIX,${d},DIRECT`),
  // 3. 自定义代理域名
  ...EXTRA_PROXY_DOMAINS.map(d => `DOMAIN-SUFFIX,${d},${G.PROXY}`),
  // 4. AI 服务域名（放在广告拦截前，避免风控/遥测域名被误拦导致客户端异常）
  ...AI_GROUPS.flatMap(group => AI_DOMAINS[group].map(d => `DOMAIN-SUFFIX,${d},${group}`)),
  ...AI_GROUPS.map(group => `RULE-SET,${aiSetName(group)},${group}`),
  // 5. AI 客户端进程：除境内连接外全部走对应 AI 组，出口 IP 与 AI 服务保持一致
  ...AI_GROUPS.map(group => `AND,((RULE-SET,${processSetName(group)}),${AI_PROCESS_EXCEPT}),${group}`),
  // 6. 常用软件、私有网络、广告拦截（Loyalsoldier）
  "RULE-SET,applications,DIRECT",
  "RULE-SET,private,DIRECT",
  ...(OPTIONS.blockAds ? ["RULE-SET,reject,REJECT"] : []),
  // 7. 各服务（广告拦截之后，google、proxy、direct 列表之前）
  ...SERVICE_RULES,
  // 8. Loyalsoldier 白名单模式其余部分（Apple 境内可直连域名交给 Apple 组）
  `RULE-SET,icloud,${SVC.Apple}`,
  `RULE-SET,apple,${SVC.Apple}`,
  `RULE-SET,google,${G.PROXY}`,
  `RULE-SET,proxy,${G.PROXY}`,
  "RULE-SET,direct,DIRECT",
  "RULE-SET,lancidr,DIRECT",
  "RULE-SET,cncidr,DIRECT",
  `RULE-SET,telegramcidr,${SVC.Telegram}`,
  ...SERVICE_IP_RULES,
  "GEOIP,LAN,DIRECT",
  "GEOIP,CN,DIRECT",
  `MATCH,${G.PROXY}`
];

// ================= DNS =================
const DNS_POLICY = { "*": "system" }; // "*" 只匹配无点号的单级主机名
for (const d of [...LOCAL_DOMAINS, ...CAMPUS_ALL]) DNS_POLICY["+." + d] = "system";
for (const d of [...APP_DIRECT_DOMAINS, ...ACADEMIC]) DNS_POLICY["+." + d] = DOMESTIC_DNS;
for (const group of AI_GROUPS) {
  for (const d of AI_DOMAINS[group]) DNS_POLICY["+." + d] = foreignDns(group);
  DNS_POLICY["rule-set:" + aiSetName(group)] = foreignDns(group);
}
// 境内域名：Loyalsoldier 境内列表、Bilibili、Microsoft / Steam 的境内部分
const DOMESTIC_SETS = [
  "private", "direct", "apple", "icloud",
  siteSetName("bilibili"),
  ...SERVICES.flatMap(s => (s.directSets || []).map(siteSetName))
];
DNS_POLICY["rule-set:" + DOMESTIC_SETS.join(",")] = DOMESTIC_DNS;

const DIRECT_FILTER = [...LOCAL_DOMAINS, ...CAMPUS_ALL].map(d => "+." + d);
const DNS_CONFIG = {
  enable: true,
  listen: "127.0.0.1:1053",
  ipv6: false,
  "enhanced-mode": OPTIONS.fakeIp ? "fake-ip" : "redir-host",
  "use-hosts": true,
  "use-system-hosts": true,
  "prefer-h3": false,
  "default-nameserver": ["https://223.5.5.5/dns-query", "https://1.12.12.12/dns-query"],
  // 解析机场节点域名，必须直连
  "proxy-server-nameserver": DOMESTIC_DNS,
  // 直连流量按 nameserver-policy 解析：本地/校园网用系统 DNS，其余用国内 DoH
  "direct-nameserver": DOMESTIC_DNS,
  "direct-nameserver-follow-policy": true,
  // 其余域名一律经 Proxy 向境外 DoH 查询
  nameserver: foreignDns(G.PROXY),
  "nameserver-policy": DNS_POLICY
};
if (OPTIONS.fakeIp) {
  Object.assign(DNS_CONFIG, {
    "fake-ip-range": "198.18.0.1/16",
    "fake-ip-filter-mode": "blacklist",
    // 以下域名返回真实 IP：本地与校园网、NTP、联网检测、QQ / 微信本机服务、STUN
    "fake-ip-filter": [
      "*", ...DIRECT_FILTER,
      "time.*.com", "ntp.*.com", "+.pool.ntp.org", "+.ntp.org.cn", "+.msftconnecttest.com", "+.msftncsi.com",
      "localhost.ptlogin2.qq.com", "localhost.sec.qq.com", "localhost.work.weixin.qq.com", "stun.*.*", "stun.*.*.*"
    ]
  });
}

const SNIFFER_CONFIG = OPTIONS.sniff ? {
  enable: true,
  "force-dns-mapping": true,
  "parse-pure-ip": true,
  "override-destination": false,
  sniff: {
    HTTP: { ports: [80, "8080-8880"], "override-destination": true },
    TLS: { ports: [443, 8443] },
    QUIC: { ports: [443, 8443] }
  },
  "skip-domain": [...DIRECT_FILTER, "Mijia Cloud", "+.push.apple.com"],
  "skip-dst-address": [...LOCAL_CIDRS, ...EXTRA_DIRECT_CIDRS]
} : { enable: false };

// ================= 入口 =================
// Clash Verge Rev、clash.md 传入 (config, profileName)；FlClash 只传 config
function main(config, profileName) {
  const tag = typeof profileName === "string" && profileName ? `[${profileName}] ` : "";
  const proxies = config && Array.isArray(config.proxies) ? config.proxies : [];

  // 与策略组或内置出站重名的节点会使内核拒绝整个配置，改名后照常使用
  const groupNames = new Set([...AI_GROUPS, G.PROXY, G.AUTO, ...SERVICES.map(s => s.name), ...REGION_DISPLAY_ORDER, "DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE"]);
  const usedNames = new Set(proxies.map(p => p && p.name));
  const renamed = {};
  for (const p of proxies) {
    const n = p && p.name;
    if (typeof n !== "string" || !groupNames.has(n)) continue;
    let alt = `${n} 节点`;
    for (let i = 2; usedNames.has(alt) || groupNames.has(alt); i++) alt = `${n} 节点${i}`;
    p.name = alt;
    usedNames.add(alt);
    renamed[n] = alt;
    log(`${tag}节点名与策略组名冲突，已改名：${n} → ${alt}`);
  }
  for (const p of proxies) {
    if (p && typeof p["dialer-proxy"] === "string" && renamed[p["dialer-proxy"]]) p["dialer-proxy"] = renamed[p["dialer-proxy"]];
  }
  const nodes = [];
  for (const p of proxies) {
    const n = p && p.name;
    if (typeof n !== "string" || INFO_NODE_RE.test(n)) continue;
    nodes.push(n);
  }
  if (nodes.length === 0) {
    // 纯 proxy-providers 订阅或空订阅：不做改动，避免生成空策略组
    log(`${tag}未找到可用节点，脚本未生效`);
    return config;
  }

  // 节点按地区关键字分组
  const matchers = REGIONS.map(r => ({ key: r.key, test: buildMatcher(r) }));
  const members = {};
  REGION_DISPLAY_ORDER.forEach(k => (members[k] = []));
  for (const n of nodes) {
    const r = matchers.find(m => m.test(n));
    members[r ? r.key : "other"].push(n);
  }
  const nonEmpty = REGION_DISPLAY_ORDER.filter(k => members[k].length > 0);

  // AI 选项：只列地区组（默认 sg），不列具体节点；含受限节点的地区组（如混有俄罗斯节点的 other）不列入
  const isAiBlocked = buildMatcher(AI_BLOCKED);
  let aiChoices = AI_REGION_ORDER.filter(k => members[k].length > 0 && !members[k].some(isAiBlocked));
  if (aiChoices.length === 0) {
    log(`${tag}警告：未识别到 AI 可用地区，AI 策略组已放入全部非空地区组，请手动选择非香港地区`);
    aiChoices = nonEmpty.filter(k => k !== "hk");
    if (aiChoices.length === 0) aiChoices = nonEmpty;
  }

  const serviceChoices = s => {
    switch (s.choices) {
      case "ai":
        return aiChoices.includes(s.prefer) ? [s.prefer, ...aiChoices.filter(k => k !== s.prefer)] : aiChoices;
      case "bilibili":
        return ["DIRECT", ...["hk", "tw"].filter(k => members[k].length > 0)];
      case "proxyDirect":
        return [G.PROXY, "DIRECT", ...nonEmpty];
      case "directFirst":
        return ["DIRECT", G.PROXY, ...nonEmpty];
      default:
        return [G.PROXY, ...nonEmpty];
    }
  };
  const select = (name, list, icon) => ({ name, type: "select", proxies: list, icon });

  config["proxy-groups"] = [
    ...AI_GROUPS.map(name => select(name, aiChoices, ICONS[name])),
    // Proxy 只列 auto 和地区组，不列具体节点；节点在地区组内选择
    select(G.PROXY, [G.AUTO, ...nonEmpty], ICONS[G.PROXY]),
    ...SERVICES.map(s => select(s.name, serviceChoices(s), s.icon)),
    // 空地区组指向 REJECT，保持分组完整且不会误走直连
    ...REGION_DISPLAY_ORDER.map(k => select(k, members[k].length ? members[k] : ["REJECT"], ICONS[k])),
    { name: G.AUTO, type: "url-test", proxies: nodes, url: TEST_URL, interval: 300, timeout: 5000, tolerance: 50, lazy: true, icon: ICONS[G.AUTO] }
  ];

  config["rule-providers"] = RULE_PROVIDERS;
  config.rules = RULES;
  config.dns = DNS_CONFIG;
  config.sniffer = SNIFFER_CONFIG;
  config["find-process-mode"] = "strict"; // FlClash 以界面中的「查找进程」设置为准
  config["tcp-concurrent"] = true;
  config.profile = { ...(config.profile || {}), "store-selected": true, "store-fake-ip": OPTIONS.fakeIp };
  return config;
}
