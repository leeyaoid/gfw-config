/**
 * Clash Verge Rev 全局扩展脚本（mihomo 内核）
 * 策略组：ChatGPT（含 Codex）、Claude（含 Claude Code）、Gemini（含 Antigravity）、Proxy（除 AI 外的境外连接）
 * 地区组：us / hk / jp / tw / sg / eu / other，auto 为全节点测速
 * 分流：本地与北京工业大学（含 VPN、WebVPN）直连 → AI 域名与客户端进程 → Loyalsoldier/clash-rules 白名单模式
 * AI：只选择 AI 可用地区组（默认 us），节点在地区组内手动选定，出口 IP 不随测速跳变
 * DNS：境外域名经代理加密解析；境内域名用国内 DoH；本地与校园网用系统 DNS
 * 入站：系统代理即可，TUN 模式也兼容；端口、TUN、IPv6 由 Verge 界面控制
 */

// ================= 开关 =================
const OPTIONS = {
  blockAds: true, // Loyalsoldier reject 广告拦截；个别网站异常时改为 false
  academicDirect: true, // 学术数据库直连，保留校园 IP 授权
  fakeIp: false, // 仅在开启 TUN 时考虑；只用系统代理时保持 false
  sniff: false // 仅在开启 TUN 时考虑
};

// ================= 自定义（只填域名或 CIDR，不含协议和路径） =================
// 北京工业大学：主站、图书馆、VPN（vpn.bjut.edu.cn）、WebVPN（webvpn.bjut.edu.cn）均为其子域名
const CAMPUS_DOMAINS = ["bjut.edu.cn"];
// 校园 VPN 客户端直连：Array MotionPro（北工大 VPN）、深信服 EasyConnect / aTrust
const CAMPUS_VPN_PROCESS = "(?i)^(motionpro|easyconnect|ecagent|atrust)";
// 学术数据库：按来源 IP 识别校园订阅权限，直连才能使用学校授权
const ACADEMIC_DOMAINS = [
  "cnki.net", "wanfangdata.com.cn", "cqvip.com",
  "ieee.org", "acm.org", "sciencedirect.com", "elsevier.com", "springer.com", "springernature.com",
  "nature.com", "science.org", "wiley.com", "tandfonline.com", "sagepub.com", "webofscience.com",
  "clarivate.com", "scopus.com", "jstor.org", "iop.org", "aps.org", "acs.org", "rsc.org",
  "oup.com", "cambridge.org", "proquest.com", "ebsco.com", "ebscohost.com", "emerald.com", "siam.org"
];
const EXTRA_DIRECT_DOMAINS = [];
const EXTRA_DIRECT_CIDRS = [];
const EXTRA_PROXY_DOMAINS = [];

// ================= 基础参数 =================
const TEST_URL = "https://www.gstatic.com/generate_204";

// 策略组图标
const QURE_ICON_BASE = "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color";
const LOBEHUB_ICON_BASE = "https://unpkg.com/@lobehub/icons-static-svg@1.90.0/icons";
const ICONS = {
  ChatGPT: `${QURE_ICON_BASE}/ChatGPT.png`,
  Claude: `${LOBEHUB_ICON_BASE}/claude-color.svg`,
  Gemini: `${LOBEHUB_ICON_BASE}/gemini-color.svg`,
  Proxy: `${QURE_ICON_BASE}/Proxy.png`,
  us: `${QURE_ICON_BASE}/United_States.png`,
  hk: `${QURE_ICON_BASE}/Hong_Kong.png`,
  jp: `${QURE_ICON_BASE}/Japan.png`,
  tw: `${QURE_ICON_BASE}/Taiwan.png`,
  sg: `${QURE_ICON_BASE}/Singapore.png`,
  eu: `${QURE_ICON_BASE}/European_Union.png`,
  other: `${QURE_ICON_BASE}/World_Map.png`,
  auto: `${QURE_ICON_BASE}/Auto.png`
};

// 策略组名称：功能组首字母大写，地区组与 auto 为小写
const G = { CHATGPT: "ChatGPT", CLAUDE: "Claude", GEMINI: "Gemini", PROXY: "Proxy", AUTO: "auto" };
const AI_GROUPS = [G.CHATGPT, G.CLAUDE, G.GEMINI];

// 订阅中的流量、到期等提示用“伪节点”，不参与任何策略组
const INFO_NODE_RE = /剩余|到期|过期|流量|官网|套餐|重置|Traffic|Expire|Reset/i;

// 地区关键字：中文/英文名称不区分大小写；英文代码区分大小写且前后不能是字母（避免 AUS、Plus 误判为 US）
// 数组顺序即识别优先级，每个节点只归入第一个匹配的地区；都不匹配的归入 other
const REGIONS = [
  { key: "hk", words: "香港|Hong ?Kong", codes: "HK|HKG" },
  { key: "tw", words: "台湾|台灣|臺灣|台北|臺北|高雄|Taiwan|Taipei|Kaohsiung", codes: "TW|TWN|TPE" },
  { key: "jp", words: "日本|东京|東京|大阪|埼玉|Japan|Tokyo|Osaka|Saitama", codes: "JP|JPN" },
  { key: "sg", words: "新加坡|狮城|獅城|Singapore", codes: "SG|SGP" },
  { key: "us", words: "美国|美國|洛杉矶|洛杉磯|圣何塞|聖何塞|硅谷|矽谷|西雅图|西雅圖|纽约|紐約|芝加哥|达拉斯|達拉斯|United ?States|America|Los ?Angeles|San ?Jose|Seattle|New ?York|Dallas", codes: "US|USA" },
  {
    key: "eu",
    words: "欧洲|歐洲|英国|英國|德国|德國|法国|法國|荷兰|荷蘭|瑞士|瑞典|芬兰|芬蘭|挪威|丹麦|丹麥|意大利|義大利|西班牙|葡萄牙|爱尔兰|愛爾蘭|奥地利|奧地利|比利时|比利時|波兰|波蘭|捷克|卢森堡|盧森堡|伦敦|倫敦|法兰克福|法蘭克福|巴黎|阿姆斯特丹|Europe|United ?Kingdom|Britain|Germany|France|Netherlands|Switzerland|Sweden|Finland|Norway|Denmark|Italy|Spain|Portugal|Ireland|Austria|Belgium|Poland|Czech|Luxembourg|London|Frankfurt|Paris|Amsterdam",
    codes: "EU|UK|GB|GBR|DE|DEU|FR|FRA|NL|NLD|CHE|SWE|FIN|NOR|DNK|ITA|ESP|PRT|IRL|AUT|BEL|POL|CZE|LUX"
  }
];
const REGION_DISPLAY_ORDER = ["us", "hk", "jp", "tw", "sg", "eu", "other"];

// AI 服务不支持的地区（香港、澳门、俄罗斯等）。不能按 CN 排除：部分机场台湾节点标注为中国，CN2 线路也含 CN
const AI_BLOCKED = {
  words: "香港|澳门|澳門|俄罗斯|俄羅斯|Russia|伊朗|Iran|朝鲜|叙利亚|古巴|白俄|Belarus|回国|大陆",
  codes: "HK|HKG|MO|MAC|RU|RUS|IR|IRN|KP|PRK|SY|SYR|CU|CUB|BY|BLR"
};
// AI 地区组顺序，第一个为默认值
const AI_REGION_ORDER = ["us", "jp", "sg", "tw", "eu", "other"];

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

// AI 客户端进程（macOS / Windows / Linux）；不按 node、electron、python 等通用名称匹配
// 路径分隔符写作 [/\\]，同时兼容 / 和 \
const AI_PROCESSES = {
  [G.CHATGPT]: [
    // ChatGPT、Codex 主程序与 Helper，Codex CLI（codex / codex.exe / codex-<平台>）
    "PROCESS-NAME-REGEX,(?i)^(chatgpt|codex)(-[a-z0-9_.-]+)?( helper| service)?( \\([^)]*\\))?(\\.exe)?$",
    "PROCESS-PATH-REGEX,(?i)[/\\\\](ChatGPT|Codex)\\.app[/\\\\]", // macOS 应用包（含内置 codex、node）
    "PROCESS-PATH-REGEX,(?i)[/\\\\]WindowsApps[/\\\\]OpenAI\\.", // Windows 应用商店版
    "PROCESS-PATH-REGEX,(?i)[/\\\\]@openai[/\\\\]codex[/\\\\]" // npm 安装的 Codex CLI
  ],
  [G.CLAUDE]: [
    // Claude 桌面版与 Helper、Claude Code（claude / claude.exe）、Linux 社区版 claude-desktop
    "PROCESS-NAME-REGEX,(?i)^claude(-desktop)?( helper)?( \\([^)]*\\))?(\\.exe)?$",
    "PROCESS-PATH-REGEX,(?i)[/\\\\]Claude\\.app[/\\\\]", // macOS 应用包，及桌面版内置的 Claude Code
    "PROCESS-PATH-REGEX,(?i)[/\\\\]AnthropicClaude[/\\\\]", // Windows 桌面版
    "PROCESS-PATH-REGEX,(?i)[/\\\\]\\.local[/\\\\]share[/\\\\]claude[/\\\\]versions[/\\\\]", // Claude Code 原生安装（进程名为版本号）
    "PROCESS-PATH-REGEX,(?i)[/\\\\]@anthropic-ai[/\\\\]claude-code[/\\\\]" // npm 安装的 Claude Code
  ],
  [G.GEMINI]: [
    // Gemini 桌面版、Antigravity 主程序与 Helper、Antigravity 远程服务端
    "PROCESS-NAME-REGEX,(?i)^(gemini|antigravity|antigravity-server|agy)( helper)?( \\([^)]*\\))?(\\.exe)?$",
    "PROCESS-PATH-REGEX,(?i)[/\\\\](Gemini|Antigravity)\\.app[/\\\\]", // macOS 应用包（含 language_server）
    // Windows / Linux 的 Antigravity 安装目录，只匹配其自身的程序和语言服务器
    "PROCESS-PATH-REGEX,(?i)[/\\\\](antigravity|\\.antigravity-server)[/\\\\](.*[/\\\\])?(antigravity[^/\\\\]*|language_server[^/\\\\]*|node(\\.exe)?)$"
  ]
};

// 本机与局域网
const LOCAL_DOMAINS = ["localhost", "local", "lan", "localdomain", "home.arpa", "test"];
const LOCAL_CIDRS = ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "100.64.0.0/10", "::1/128", "fc00::/7", "fe80::/10"];

// DNS 服务器（均用 IP 形式的 DoH；# 后为该 DNS 查询的出站策略）
const DOMESTIC_DNS = ["https://223.5.5.5/dns-query#DIRECT", "https://1.12.12.12/dns-query#DIRECT"]; // 阿里、腾讯
const foreignDns = group => [`https://1.1.1.1/dns-query#${group}`, `https://8.8.8.8/dns-query#${group}`]; // Cloudflare、Google

// ================= 工具函数 =================
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
const cidrRule = (cidr, target) => `${cidr.includes(":") ? "IP-CIDR6" : "IP-CIDR"},${cidr},${target},no-resolve`;

// ================= 规则集 =================
// 经 Proxy 从 GitHub 原始地址下载，无 jsDelivr 的缓存延迟
const LS = "https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release";
const META = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite";
const RULE_PROVIDERS = {
  reject: ruleProvider("domain", LS + "/reject.txt", "./ruleset/loyalsoldier/reject.yaml"),
  icloud: ruleProvider("domain", LS + "/icloud.txt", "./ruleset/loyalsoldier/icloud.yaml"),
  apple: ruleProvider("domain", LS + "/apple.txt", "./ruleset/loyalsoldier/apple.yaml"),
  google: ruleProvider("domain", LS + "/google.txt", "./ruleset/loyalsoldier/google.yaml"),
  proxy: ruleProvider("domain", LS + "/proxy.txt", "./ruleset/loyalsoldier/proxy.yaml"),
  direct: ruleProvider("domain", LS + "/direct.txt", "./ruleset/loyalsoldier/direct.yaml"),
  private: ruleProvider("domain", LS + "/private.txt", "./ruleset/loyalsoldier/private.yaml"),
  telegramcidr: ruleProvider("ipcidr", LS + "/telegramcidr.txt", "./ruleset/loyalsoldier/telegramcidr.yaml"),
  cncidr: ruleProvider("ipcidr", LS + "/cncidr.txt", "./ruleset/loyalsoldier/cncidr.yaml"),
  lancidr: ruleProvider("ipcidr", LS + "/lancidr.txt", "./ruleset/loyalsoldier/lancidr.yaml"),
  applications: ruleProvider("classical", LS + "/applications.txt", "./ruleset/loyalsoldier/applications.yaml")
};
if (!OPTIONS.blockAds) delete RULE_PROVIDERS.reject;
for (const group of AI_GROUPS) {
  RULE_PROVIDERS[aiSetName(group)] = ruleProvider("domain", `${META}/${AI_RULE_SETS[group]}.yaml`, `./ruleset/metacubex/${AI_RULE_SETS[group]}.yaml`);
  // 进程规则放入内联集合，避免正则中的括号与 AND/NOT 语法冲突
  RULE_PROVIDERS[processSetName(group)] = { type: "inline", behavior: "classical", payload: AI_PROCESSES[group] };
}

// ================= 分流规则（自上而下，命中即止） =================
const CAMPUS_ALL = [...CAMPUS_DOMAINS, ...EXTRA_DIRECT_DOMAINS];
const ACADEMIC = OPTIONS.academicDirect ? ACADEMIC_DOMAINS : [];
// AI 进程例外：境内、私有、Apple 域名不进入 AI 组；未收录域名解析后为境内 IP 的也不进入
const AI_PROCESS_EXCEPT = [
  ...["private", "direct", "apple", "icloud"].map(s => `(NOT,((RULE-SET,${s})))`),
  "(OR,((RULE-SET,proxy),(RULE-SET,google),(NOT,((RULE-SET,cncidr)))))"
].join(",");

const RULES = [
  // 1. 本机、局域网
  ...LOCAL_DOMAINS.map(d => `DOMAIN-SUFFIX,${d},DIRECT`),
  "DOMAIN-REGEX,^[^.]+$,DIRECT", // 无点号的主机名，如 nas、router
  ...[...LOCAL_CIDRS, ...EXTRA_DIRECT_CIDRS].map(c => cidrRule(c, "DIRECT")),
  // 2. 北京工业大学（含 VPN、WebVPN）、校园 VPN 客户端、学术数据库
  ...CAMPUS_ALL.map(d => `DOMAIN-SUFFIX,${d},DIRECT`),
  `PROCESS-NAME-REGEX,${CAMPUS_VPN_PROCESS},DIRECT`,
  ...ACADEMIC.map(d => `DOMAIN-SUFFIX,${d},DIRECT`),
  // 3. 自定义代理域名
  ...EXTRA_PROXY_DOMAINS.map(d => `DOMAIN-SUFFIX,${d},${G.PROXY}`),
  // 4. AI 服务域名（放在广告拦截前，避免风控/遥测域名被误拦导致客户端异常）
  ...AI_GROUPS.flatMap(group => AI_DOMAINS[group].map(d => `DOMAIN-SUFFIX,${d},${group}`)),
  ...AI_GROUPS.map(group => `RULE-SET,${aiSetName(group)},${group}`),
  // 5. AI 客户端进程：除境内连接外全部走对应 AI 组，出口 IP 与 AI 服务保持一致
  ...AI_GROUPS.map(group => `AND,((RULE-SET,${processSetName(group)}),${AI_PROCESS_EXCEPT}),${group}`),
  // 6. Loyalsoldier/clash-rules 白名单模式（按仓库 README 顺序）
  "RULE-SET,applications,DIRECT",
  "DOMAIN,clash.razord.top,DIRECT",
  "DOMAIN,yacd.haishan.me,DIRECT",
  "RULE-SET,private,DIRECT",
  ...(OPTIONS.blockAds ? ["RULE-SET,reject,REJECT"] : []),
  "RULE-SET,icloud,DIRECT",
  "RULE-SET,apple,DIRECT",
  `RULE-SET,google,${G.PROXY}`,
  `RULE-SET,proxy,${G.PROXY}`,
  "RULE-SET,direct,DIRECT",
  "RULE-SET,lancidr,DIRECT",
  "RULE-SET,cncidr,DIRECT",
  `RULE-SET,telegramcidr,${G.PROXY}`,
  "GEOIP,LAN,DIRECT",
  "GEOIP,CN,DIRECT",
  `MATCH,${G.PROXY}`
];

// ================= DNS =================
const DNS_POLICY = { "*": "system" }; // "*" 只匹配无点号的单级主机名
for (const d of [...LOCAL_DOMAINS, ...CAMPUS_ALL]) DNS_POLICY["+." + d] = "system";
for (const d of ACADEMIC) DNS_POLICY["+." + d] = DOMESTIC_DNS;
for (const group of AI_GROUPS) {
  for (const d of AI_DOMAINS[group]) DNS_POLICY["+." + d] = foreignDns(group);
  DNS_POLICY["rule-set:" + aiSetName(group)] = foreignDns(group);
}
DNS_POLICY["rule-set:private,direct,apple,icloud"] = DOMESTIC_DNS;

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
function main(config, profileName) {
  const proxies = Array.isArray(config.proxies) ? config.proxies : [];
  const nodes = proxies.map(p => p && p.name).filter(n => typeof n === "string" && !INFO_NODE_RE.test(n));
  if (nodes.length === 0) {
    // 纯 proxy-providers 订阅或空订阅：不做改动，避免生成空策略组
    console.log(`[${profileName}] 未找到可用节点，全局脚本未生效`);
    return config;
  }

  const groupNames = new Set([...AI_GROUPS, G.PROXY, G.AUTO, ...REGION_DISPLAY_ORDER]);
  const clash = nodes.find(n => groupNames.has(n));
  if (clash) throw new Error(`节点名与策略组名冲突：${clash}`);

  // 节点按地区关键字分组
  const matchers = REGIONS.map(r => ({ key: r.key, test: buildMatcher(r) }));
  const members = {};
  REGION_DISPLAY_ORDER.forEach(k => (members[k] = []));
  for (const n of nodes) {
    const r = matchers.find(m => m.test(n));
    members[r ? r.key : "other"].push(n);
  }
  const nonEmpty = REGION_DISPLAY_ORDER.filter(k => members[k].length > 0);

  // AI 选项：只列地区组（默认 us），不列具体节点；含受限节点的地区组（如混有俄罗斯节点的 other）不列入
  const isAiBlocked = buildMatcher(AI_BLOCKED);
  let aiChoices = AI_REGION_ORDER.filter(k => members[k].length > 0 && !members[k].some(isAiBlocked));
  if (aiChoices.length === 0) {
    console.log("警告：未识别到 AI 可用地区，AI 策略组已放入全部非空地区组，请手动选择非香港地区");
    aiChoices = nonEmpty.filter(k => k !== "hk");
    if (aiChoices.length === 0) aiChoices = nonEmpty;
  }

  config["proxy-groups"] = [
    ...AI_GROUPS.map(name => ({ name, type: "select", proxies: aiChoices, icon: ICONS[name] })),
    { name: G.PROXY, type: "select", proxies: [G.AUTO, ...nonEmpty, ...nodes], icon: ICONS.Proxy },
    // 空地区组指向 REJECT，保持分组完整且不会误走直连
    ...REGION_DISPLAY_ORDER.map(k => ({ name: k, type: "select", proxies: members[k].length ? members[k] : ["REJECT"], icon: ICONS[k] })),
    { name: G.AUTO, type: "url-test", proxies: nodes, url: TEST_URL, interval: 300, timeout: 5000, tolerance: 50, lazy: true, icon: ICONS.auto }
  ];

  config["rule-providers"] = RULE_PROVIDERS;
  config.rules = RULES;
  config.dns = DNS_CONFIG;
  config.sniffer = SNIFFER_CONFIG;
  config["find-process-mode"] = "strict";
  config["tcp-concurrent"] = true;
  config.profile = { ...(config.profile || {}), "store-selected": true, "store-fake-ip": OPTIONS.fakeIp };
  return config;
}
