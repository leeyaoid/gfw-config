/**
 * Clash Verge Rev 全局扩展脚本 V2.2
 * 按需代理：局域网及国内服务直连，AI / GFW / 自定义网站代理，其余直连。
 * AI 组选择地区组（us / jp 等），再在地区组内手动选择节点，不随 auto 测速切换。
 * 原订阅节点保留，原策略组和 rules 由本脚本接管；只隐藏保留必要依赖组。
 * 同名时新增组使用「名称 · LY」后缀，原有引用不变。
 * 动态提供者在运行时加载，地区组可能暂时为空，空组拒绝连接而不转为直连。
 * main() 不访问网络、不读文件；规则更新和健康检查由 Mihomo 执行。
 */

const QURE_ICON_BASE = "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color";
const LOBEHUB_ICON_BASE = "https://unpkg.com/@lobehub/icons-static-svg@1.90.0/icons";

const GROUP_ICONS = {
  Proxy: `${QURE_ICON_BASE}/Proxy.png`,
  OpenAI: `${QURE_ICON_BASE}/ChatGPT.png`,
  Gemini: `${LOBEHUB_ICON_BASE}/gemini-color.svg`,
  Claude: `${LOBEHUB_ICON_BASE}/claude-color.svg`,
  auto: `${QURE_ICON_BASE}/Auto.png`,
  us: `${QURE_ICON_BASE}/United_States.png`,
  jp: `${QURE_ICON_BASE}/Japan.png`,
  hk: `${QURE_ICON_BASE}/Hong_Kong.png`,
  tw: `${QURE_ICON_BASE}/Taiwan.png`,
  sg: `${QURE_ICON_BASE}/Singapore.png`,
  eu: `${QURE_ICON_BASE}/European_Union.png`,
  ot: `${QURE_ICON_BASE}/World_Map.png`
};

const REGION_DEFINITIONS = [
  {
    code: "us",
    pattern: "🇺🇸|美国|美國|美西|美东|美東|United[ _-]?States|Los[ _-]?Angeles|San[ _-]?Jose|Seattle|New[ _-]?York|\\bUS\\b|\\bUSA\\b|\\bLAX\\b|\\bSJC\\b"
  },
  {
    code: "jp",
    pattern: "🇯🇵|日本|Japan|Tokyo|Osaka|\\bJP\\b|\\bJPN\\b|\\bNRT\\b|\\bHND\\b|\\bKIX\\b"
  },
  {
    code: "hk",
    pattern: "🇭🇰|香港|Hong[ _-]?Kong|\\bHK\\b|\\bHKG\\b"
  },
  {
    code: "tw",
    pattern: "🇹🇼|台湾|台灣|Taiwan|Taipei|\\bTW\\b|\\bTPE\\b"
  },
  {
    code: "sg",
    pattern: "🇸🇬|新加坡|狮城|獅城|Singapore|\\bSG\\b|\\bSGP\\b"
  },
  {
    code: "eu",
    pattern: "🇬🇧|🇩🇪|🇫🇷|🇳🇱|🇮🇹|🇪🇸|🇵🇹|🇮🇪|🇨🇭|🇦🇹|🇧🇪|🇩🇰|🇸🇪|🇳🇴|🇫🇮|🇵🇱|🇨🇿|🇷🇴|🇭🇺|🇬🇷|🇮🇸|🇱🇺|🇺🇦|🇷🇺|欧洲|歐洲|英国|英國|德国|德國|法国|法國|荷兰|荷蘭|意大利|西班牙|葡萄牙|爱尔兰|愛爾蘭|瑞士|奥地利|奧地利|比利时|比利時|丹麦|丹麥|瑞典|挪威|芬兰|芬蘭|波兰|波蘭|捷克|罗马尼亚|羅馬尼亞|匈牙利|希腊|希臘|冰岛|冰島|卢森堡|盧森堡|乌克兰|烏克蘭|俄罗斯|俄羅斯|Europe|European|United[ _-]?Kingdom|Britain|London|Germany|Frankfurt|France|Paris|Netherlands|Amsterdam|Italy|Milan|Spain|Madrid|Portugal|Ireland|Switzerland|Austria|Belgium|Denmark|Sweden|Norway|Finland|Poland|Czech|Romania|Hungary|Greece|Iceland|Luxembourg|Ukraine|Russia|\\bEU\\b|\\bUK\\b|\\bGB\\b|\\bDE\\b|\\bFR\\b|\\bNL\\b|\\bIT\\b|\\bES\\b|\\bPT\\b|\\bIE\\b|\\bCH\\b|\\bAT\\b|\\bBE\\b|\\bDK\\b|\\bSE\\b|\\bNO\\b|\\bFI\\b|\\bPL\\b|\\bCZ\\b|\\bRO\\b|\\bHU\\b|\\bGR\\b|\\bIS\\b|\\bLU\\b|\\bUA\\b|\\bRU\\b"
  }
];

// 排除订阅中的流量、到期时间、官网等提示性“伪节点”。
const EXCLUDED_NODE_PATTERN = "(^|[^a-z])(traffic|expire[sd]?|expiration|reset|remaining)[ _-]*[:：]|剩余流量|流量剩余|套餐到期|到期时间|过期时间|订阅到期|重置时间|流量重置|流量用尽|已过期|官网[:：]|官方网站|客服[:：]|通知[:：]|remaining[ _-]*traffic|traffic[ _-]*(left|remaining|reset)|expire[sd]?[ _-]*(at|on|date)|official[ _-]*website";

// Windows、macOS、CLI 与 Electron Helper 进程匹配。
const AI_PROCESS_RULES = [
  "PROCESS-NAME-REGEX,(?i)^ChatGPT( Classic)?( Helper( \\((Renderer|GPU|Plugin)\\))?)?(\\.exe)?$,OpenAI",
  "PROCESS-NAME-REGEX,(?i)^OpenAI(\\.exe)?$,OpenAI",
  "PROCESS-NAME-REGEX,(?i)^Codex( Helper( \\((Renderer|GPU|Plugin)\\))?)?(\\.exe)?$,OpenAI",
  "PROCESS-NAME-REGEX,(?i)^Claude( Helper( \\((Renderer|GPU|Plugin)\\))?)?(\\.exe)?$,Claude",
  "PROCESS-NAME-REGEX,(?i)^Gemini( Helper( \\((Renderer|GPU|Plugin)\\))?)?(\\.exe)?$,Gemini"
];

const RULE_PROVIDER_BASE = {
  type: "http",
  interval: 86400,
  proxy: "Proxy"
};

const RULE_PROVIDERS = {
  "ly-private-domain": {
    ...RULE_PROVIDER_BASE,
    behavior: "domain",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.yaml",
    path: "./ruleset/metacubex/private-domain.yaml"
  },
  "ly-openai": {
    ...RULE_PROVIDER_BASE,
    behavior: "domain",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/openai.yaml",
    path: "./ruleset/metacubex/openai.yaml"
  },
  "ly-gemini": {
    ...RULE_PROVIDER_BASE,
    behavior: "classical",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/classical/google-gemini.yaml",
    path: "./ruleset/metacubex/google-gemini.yaml"
  },
  "ly-claude": {
    ...RULE_PROVIDER_BASE,
    behavior: "classical",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/classical/anthropic.yaml",
    path: "./ruleset/metacubex/anthropic.yaml"
  },
  "ly-ai-cn": {
    ...RULE_PROVIDER_BASE,
    behavior: "domain",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-cn.yaml",
    path: "./ruleset/metacubex/category-ai-cn.yaml"
  },
  "ly-apple-cn": {
    ...RULE_PROVIDER_BASE,
    behavior: "domain",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple-cn.yaml",
    path: "./ruleset/metacubex/apple-cn.yaml"
  },
  "ly-ntp": {
    ...RULE_PROVIDER_BASE,
    behavior: "domain",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ntp.yaml",
    path: "./ruleset/metacubex/category-ntp.yaml"
  },
  "ly-gfw": {
    ...RULE_PROVIDER_BASE,
    behavior: "domain",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/gfw.yaml",
    path: "./ruleset/metacubex/gfw.yaml"
  },
  "ly-cn-domain": {
    ...RULE_PROVIDER_BASE,
    behavior: "domain",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.yaml",
    path: "./ruleset/metacubex/cn-domain.yaml"
  },
  "ly-private-ip": {
    ...RULE_PROVIDER_BASE,
    behavior: "ipcidr",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/private.yaml",
    path: "./ruleset/metacubex/private-ip.yaml"
  },
  "ly-cn-ip": {
    ...RULE_PROVIDER_BASE,
    behavior: "ipcidr",
    format: "yaml",
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.yaml",
    path: "./ruleset/metacubex/cn-ip.yaml"
  }
};

// 日常调整集中在此处。域名填写主机名，不含协议、端口或路径；后缀包含其子域名。
const SETTINGS = {
  directDomains: [],
  proxyDomains: [],
  aiDomains: { OpenAI: [], Gemini: [], Claude: [] },
  // 精确节点名 -> 地区代码；适用于 config.proxies 中的节点。
  regionOverrides: {},
  // AI 地区组的显示和默认选择顺序；不代表地区内节点已通过 AI 可用性验证。
  aiRegionOrder: ["us", "jp", "sg", "tw", "eu", "ot", "hk"],
  enableProcessRules: true,
  processMode: "strict", // null 为完全保留订阅设置；不匹配 node.exe / python.exe 等通用进程。
  enableSniffer: true, // 仅补充缺失设置，已有的显式开关、端口及例外优先。
  dnsMode: "supplement", // supplement 补充缺失项；preserve 完全保留原 DNS。
  supplementProviderHealthCheck: true,
  testUrl: "https://www.gstatic.com/generate_204",
  testInterval: 300,
  testTimeout: 5000,
  testTolerance: 100,
  ruleUpdateInterval: 86400,
  // Proxy 经通用代理更新，或 DIRECT 直连更新；无可用代理和缓存时仍可能初始化失败。
  ruleDownloadVia: "Proxy"
};

const CORE_AI_DOMAINS = {
  OpenAI: ["openai.com", "chatgpt.com", "oaistatic.com", "oaiusercontent.com", "sora.com"],
  Gemini: ["gemini.google.com", "gemini.google", "aistudio.google.com", "ai.google.dev", "generativelanguage.googleapis.com", "notebooklm.google.com", "notebooklm.google", "notebooklm.googleapis.com", "notebooklm-pa.googleapis.com", "gemini.gstatic.com"],
  Claude: ["anthropic.com", "claude.ai", "claude.com", "clau.de", "claudeusercontent.com", "claudemcpclient.com", "claudemcpcontent.com"]
};
const PRIVATE_RULES = [
  "DOMAIN,localhost,DIRECT", "DOMAIN-SUFFIX,localhost,DIRECT",
  "DOMAIN-SUFFIX,local,DIRECT", "DOMAIN-SUFFIX,lan,DIRECT", "DOMAIN-SUFFIX,home.arpa,DIRECT",
  "IP-CIDR,0.0.0.0/8,DIRECT,no-resolve", "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
  "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve", "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
  "IP-CIDR,169.254.0.0/16,DIRECT,no-resolve", "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
  "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve", "IP-CIDR6,::1/128,DIRECT,no-resolve",
  "IP-CIDR6,fc00::/7,DIRECT,no-resolve", "IP-CIDR6,fe80::/10,DIRECT,no-resolve"
];
const BUILTINS = ["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE", "GLOBAL"];
const SERVICES = ["OpenAI", "Gemini", "Claude"];
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const unique = items => [...new Set(items)];
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function regionDefinitions() {
  // ASCII 字母边界支持 US_01、HK2，同时避免把 AUS、RUSH 等词当作 US。
  return REGION_DEFINITIONS.map(region => ({
    code: region.code,
    pattern: region.pattern.replace(/\\b([A-Z]{2,3})\\b/g, "(^|[^a-z])$1([^a-z]|$)")
  }));
}

function classifyRegion(name, regions) {
  if (own(SETTINGS.regionOverrides, name)) {
    const code = SETTINGS.regionOverrides[name];
    if (![...regions.map(r => r.code), "ot"].includes(code)) throw new Error(`节点 ${name} 的地区代码无效：${code}`);
    return code;
  }
  // 多地区名称按定义顺序只归入一个组；名称不能证明真实出口，必要时用 regionOverrides 修正。
  const match = regions.find(region => new RegExp(region.pattern, "i").test(name));
  return match ? match.code : "ot";
}

function normalizeDomains(items, label) {
  if (!Array.isArray(items)) throw new Error(`${label} 必须为域名数组`);
  return unique(items.map(item => {
    if (typeof item !== "string") throw new Error(`${label} 包含非字符串域名`);
    const domain = item.trim().toLowerCase().replace(/\.$/, "");
    if (domain.length > 253 || !domain.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))) {
      throw new Error(`${label} 域名格式无效：${item}；请填写主机名，国际化域名使用 punycode`);
    }
    return domain;
  }));
}

function supplementDNS(config, providers, names, custom) {
  if (SETTINGS.dnsMode === "preserve") return;
  if (SETTINGS.dnsMode !== "supplement") throw new Error("dnsMode 仅支持 supplement / preserve");
  const old = config.dns || {};
  const domestic = ["https://dns.alidns.com/dns-query", "https://doh.pub/dns-query"];
  const overseas = [`https://1.1.1.1/dns-query#${names.Proxy}`, `https://8.8.8.8/dns-query#${names.Proxy}`];
  const policies = {};
  for (const suffix of ["localhost", "local", "lan", "home.arpa", "arpa", ...custom.direct]) policies[`+.${suffix}`] = ["system"];
  for (const domain of custom.proxy) policies[`+.${domain}`] = overseas;
  for (const service of SERVICES) {
    const resolver = [`https://1.1.1.1/dns-query#${names[service]}`, `https://8.8.8.8/dns-query#${names[service]}`];
    policies[`rule-set:${providers[`ly-${service.toLowerCase()}`]}`] = resolver;
    for (const domain of [...CORE_AI_DOMAINS[service], ...custom.ai[service]]) {
      if (!custom.direct.includes(domain) && !custom.proxy.includes(domain)) policies[`+.${domain}`] = resolver;
    }
  }
  policies[`rule-set:${providers['ly-gfw']}`] = overseas;
  config.dns = {
    enable: true,
    "enhanced-mode": "redir-host",
    "use-hosts": true,
    "use-system-hosts": true,
    ...old,
    // 直连的系统 DNS 保留公司 / 校园网络解析能力，也隔离代理节点解析的启动依赖。
    "default-nameserver": old["default-nameserver"] || ["223.5.5.5", "119.29.29.29"],
    nameserver: old.nameserver || domestic,
    "proxy-server-nameserver": old["proxy-server-nameserver"] || ["system"],
    "direct-nameserver": old["direct-nameserver"] || ["system"],
    "nameserver-policy": { ...policies, ...(old["nameserver-policy"] || {}) }
  };
  // 不改变 whitelist / rule 模式的含义；仅为 blacklist 补充本地域名例外。
  if (config.dns["enhanced-mode"] === "fake-ip" && (!old["fake-ip-filter-mode"] || old["fake-ip-filter-mode"] === "blacklist")) {
    config.dns["fake-ip-filter"] = unique([...(old["fake-ip-filter"] || []), "+.localhost", "+.local", "+.lan", "+.home.arpa", ...custom.direct.map(d => `+.${d}`)]);
  }
}

function validateReferences(config, generatedNames) {
  const groups = config["proxy-groups"];
  const known = new Set([...BUILTINS, ...(config.proxies || []).map(p => p.name), ...groups.map(g => g.name)]);
  const providerNames = new Set(Object.keys(config["proxy-providers"] || {}));
  const check = (target, source) => {
    if (target && !known.has(target)) throw new Error(`${source} 引用了不存在的代理或策略组：${target}`);
  };
  const graph = new Map();
  for (const proxy of config.proxies || []) {
    check(proxy["dialer-proxy"], `节点 ${proxy.name}`);
    graph.set(proxy.name, proxy["dialer-proxy"] ? [proxy["dialer-proxy"]] : []);
  }
  for (const group of groups) {
    for (const target of group.proxies || []) check(target, `策略组 ${group.name}`);
    for (const provider of group.use || []) if (!providerNames.has(provider)) throw new Error(`策略组 ${group.name} 引用了不存在的节点提供者：${provider}`);
    graph.set(group.name, group.proxies || []);
  }
  for (const [name, provider] of Object.entries(config["proxy-providers"] || {})) {
    check(provider.proxy, `节点提供者 ${name}`);
    check((provider.override || {})["dialer-proxy"], `节点提供者 ${name} override`);
    // 若集合内每个节点均依赖一个本脚本生成的组，而该组又引入该集合，会形成运行时环。
    if (generatedNames.has((provider.override || {})["dialer-proxy"])) throw new Error(`节点提供者 ${name} 的 dialer-proxy 与自动纳入集合的策略组形成循环`);
  }
  for (const [name, provider] of Object.entries(config["rule-providers"] || {})) check(provider.proxy, `规则集 ${name}`);
  const done = new Set(), visiting = new Set();
  function visit(name) {
    if (visiting.has(name)) throw new Error(`代理依赖存在循环：${name}`);
    if (done.has(name) || !graph.has(name)) return;
    visiting.add(name);
    for (const child of graph.get(name)) visit(child);
    visiting.delete(name); done.add(name);
  }
  for (const name of graph.keys()) visit(name);
}

// 原分流规则将被替换，不作为保留旧组的理由。节点、DNS、下载代理等引用递归保留。
function retainDependencyGroups(config, oldGroups) {
  const byName = new Map(oldGroups.map(group => [group.name, group]));
  const needed = new Set();
  function retain(name) {
    if (!byName.has(name) || needed.has(name)) return;
    needed.add(name);
    walk(byName.get(name));
  }
  function walk(value) {
    if (typeof value === "string") {
      retain(value);
      // 保留子规则中的目标组，以及 DNS #策略组 / #策略组&参数 引用。
      const segments = value.split(',');
      if (segments.length > 1) {
        const tail = segments[segments.length - 1];
        retain(tail);
        if (tail === "no-resolve" || tail === "src") retain(segments[segments.length - 2]);
      }
      const hash = value.indexOf('#');
      if (hash >= 0) {
        for (const item of value.slice(hash + 1).split('&')) {
          retain(item);
          try { retain(decodeURIComponent(item)); } catch (_) { /* 非 URI 编码名称直接匹配 */ }
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  }
  for (const [key, value] of Object.entries(config)) {
    if (key !== "proxy-groups" && key !== "rules") walk(value);
  }
  return oldGroups.filter(group => needed.has(group.name)).map(group => ({ ...group, hidden: true }));
}

function main(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("订阅配置必须为对象");
  // 在副本上处理，任何校验失败都不对传入配置产生部分修改。
  const config = JSON.parse(JSON.stringify(input));
  const proxies = config.proxies || [];
  const oldGroups = config["proxy-groups"] || [];
  if (!Array.isArray(proxies) || !Array.isArray(oldGroups)) throw new Error("proxies / proxy-groups 必须为数组");
  const providerMap = config["proxy-providers"] || {};
  const providerKeys = Object.keys(providerMap);
  const hasProviders = providerKeys.length > 0;
  const excluded = new RegExp(EXCLUDED_NODE_PATTERN, "i");
  const nodes = proxies.filter(p => p && !excluded.test(p.name) && !["direct", "reject", "reject-drop", "pass", "dns", "compatible"].includes(String(p.type).toLowerCase()));
  if (!nodes.length && !hasProviders) throw new Error("当前订阅没有可用的代理候选节点或节点提供者（提示性节点已过滤）");

  const retainedGroups = retainDependencyGroups(config, oldGroups);
  const used = new Set(BUILTINS);
  for (const entry of [...proxies, ...retainedGroups]) {
    if (!entry || typeof entry.name !== "string" || !entry.name.trim()) throw new Error("订阅存在未命名节点或策略组");
    if (used.has(entry.name)) throw new Error(`订阅原有名称重复或使用保留名称：${entry.name}`);
    used.add(entry.name);
  }
  providerKeys.forEach(name => used.add(name));
  // inline / HTTP fallback payload 名称也纳入冲突检测；未来远端下发的名称只能由内核运行时确认。
  for (const provider of Object.values(providerMap)) {
    for (const node of provider.payload || []) if (node && node.name) used.add(node.name);
  }
  function allocate(base) {
    let name = base, index = 1;
    while (used.has(name)) name = `${base} · LY${index++ === 1 ? "" : ` ${index - 1}`}`;
    used.add(name); return name;
  }
  const regions = regionDefinitions();
  const regionCodes = [...regions.map(r => r.code), "ot"];
  const names = {};
  for (const code of ["Proxy", ...SERVICES, "auto", ...regionCodes]) names[code] = allocate(code);
  const custom = {
    direct: normalizeDomains(SETTINGS.directDomains, "directDomains"),
    proxy: normalizeDomains(SETTINGS.proxyDomains, "proxyDomains"),
    ai: {}
  };
  for (const service of SERVICES) custom.ai[service] = normalizeDomains(SETTINGS.aiDomains[service], `aiDomains.${service}`);
  const assignments = new Map();
  for (const [label, list] of [["DIRECT", custom.direct], ["Proxy", custom.proxy], ...SERVICES.map(s => [s, custom.ai[s]])]) {
    for (const domain of list) {
      if (assignments.has(domain)) throw new Error(`自定义域名 ${domain} 同时配置到 ${assignments.get(domain)} 和 ${label}`);
      assignments.set(domain, label);
    }
  }

  const members = {};
  for (const code of regionCodes) members[code] = nodes.filter(p => classifyRegion(p.name, regions) === code).map(p => p.name);
  const visibleRegions = regionCodes.filter(code => hasProviders || members[code].length);
  const providerFields = hasProviders ? { "include-all-providers": true } : {};
  const health = { url: SETTINGS.testUrl, interval: SETTINGS.testInterval, timeout: SETTINGS.testTimeout, lazy: true, "expected-status": 204 };
  const groups = [{ name: names.Proxy, type: "select", proxies: [names.auto, ...visibleRegions.map(c => names[c])], icon: GROUP_ICONS.Proxy }];
  // AI -> 地区组 -> 节点。三个 AI 引用同一套地区组，地区内选中的节点由它们共享。
  const aiRegions = unique([...SETTINGS.aiRegionOrder, ...visibleRegions]).filter(code => visibleRegions.includes(code));
  for (const service of SERVICES) {
    groups.push({ name: names[service], type: "select", proxies: aiRegions.map(code => names[code]), icon: GROUP_ICONS[service] });
  }
  groups.push({ name: names.auto, type: "url-test", proxies: nodes.map(p => p.name), ...providerFields, "exclude-filter": `(?i)${EXCLUDED_NODE_PATTERN}`, "empty-fallback": "REJECT", ...health, tolerance: SETTINGS.testTolerance, "max-failed-times": 3, icon: GROUP_ICONS.auto });
  for (const code of visibleRegions) {
    const index = regions.findIndex(r => r.code === code);
    const earlier = (index < 0 ? regions : regions.slice(0,index)).map(r => `(?:${r.pattern})`);
    const group = { name: names[code], type: "select", proxies: members[code], ...providerFields, "empty-fallback": "REJECT", icon: GROUP_ICONS[code] };
    if (hasProviders) {
      // filter / exclude-filter 对动态节点按固定优先级排他分类。
      if (index >= 0) group.filter = `(?i)${regions[index].pattern}`;
      group["exclude-filter"] = `(?i)(?:${EXCLUDED_NODE_PATTERN})${earlier.length ? `|${earlier.join('|')}` : ''}`;
      // 静态节点已分类，避免动态过滤器再次排除其手工地区覆盖，使用独立的静态子组。
      if (members[code].length) {
        const staticName = allocate(`${code} · Static`);
        groups.push({ name: staticName, type: "select", proxies: members[code], hidden: true });
        group.proxies = [staticName];
      }
    }
    groups.push(group);
  }
  config["proxy-groups"] = [...groups, ...retainedGroups];
  config.profile = { ...(config.profile || {}), "store-selected": true };

  if (SETTINGS.supplementProviderHealthCheck && hasProviders) {
    for (const provider of Object.values(providerMap)) {
      const existing = provider["health-check"] || {};
      // 保留自定义 URL 对应的状态码语义，显式关闭健康检查也保持不变。
      provider["health-check"] = { enable: true, ...health, ...existing };
      if (existing.url && !own(existing, "expected-status")) delete provider["health-check"]["expected-status"];
    }
  }
  if (SETTINGS.enableProcessRules && SETTINGS.processMode !== null) config["find-process-mode"] = SETTINGS.processMode;
  if (SETTINGS.enableSniffer) {
    const old = config.sniffer || {}, sniff = old.sniff || {};
    config.sniffer = { enable: true, "force-dns-mapping": true, "parse-pure-ip": true, "override-destination": false, ...old,
      sniff: { ...sniff, HTTP: { ports: [80, "8080-8880"], "override-destination": false, ...(sniff.HTTP || {}) }, TLS: { ports: [443, 8443], ...(sniff.TLS || {}) }, QUIC: { ports: [443, 8443], ...(sniff.QUIC || {}) } }
    };
  }

  const ruleProviders = config["rule-providers"] || {};
  const providerNames = {};
  const usedPaths = new Set(Object.values(ruleProviders).map(p => p.path).filter(Boolean));
  for (const [key, value] of Object.entries(RULE_PROVIDERS)) {
    let name = key, index = 1;
    while (own(ruleProviders, name)) name = `${key}-ly-${index++}`;
    let path = `./ruleset/ly-v2/${name}.yaml`, suffix = 1;
    while (usedPaths.has(path)) path = `./ruleset/ly-v2/${name}-${suffix++}.yaml`;
    usedPaths.add(path); providerNames[key] = name;
    if (!["Proxy", "DIRECT"].includes(SETTINGS.ruleDownloadVia)) throw new Error("ruleDownloadVia 仅支持 Proxy / DIRECT");
    ruleProviders[name] = { ...value, path, interval: SETTINGS.ruleUpdateInterval, proxy: SETTINGS.ruleDownloadVia === "DIRECT" ? "DIRECT" : names.Proxy };
  }
  config["rule-providers"] = ruleProviders;
  const ruleSet = (key, target, noResolve = false) => `RULE-SET,${providerNames[key]},${target}${noResolve ? ',no-resolve' : ''}`;
  const suffixRules = (domains, target) => domains.map(domain => `DOMAIN-SUFFIX,${domain},${target}`);
  config.rules = unique([
    ...PRIVATE_RULES,
    ruleSet("ly-private-domain", "DIRECT"), ruleSet("ly-private-ip", "DIRECT", true),
    ...suffixRules(custom.direct, "DIRECT"), ...suffixRules(custom.proxy, names.Proxy),
    ...SERVICES.flatMap(s => suffixRules(custom.ai[s], names[s])),
    ...SERVICES.flatMap(s => [...suffixRules(CORE_AI_DOMAINS[s], names[s]), ruleSet(`ly-${s.toLowerCase()}`, names[s])]),
    "DOMAIN-SUFFIX,cn,DIRECT", ruleSet("ly-ai-cn", "DIRECT"), ruleSet("ly-apple-cn", "DIRECT"), ruleSet("ly-ntp", "DIRECT"), ruleSet("ly-cn-domain", "DIRECT"),
    ...(SETTINGS.enableProcessRules ? AI_PROCESS_RULES.map(rule => rule.replace(/,(OpenAI|Gemini|Claude)$/, (_, name) => `,${names[name]}`)) : []),
    ruleSet("ly-gfw", names.Proxy), ruleSet("ly-cn-ip", "DIRECT", true), "MATCH,DIRECT"
  ]);
  supplementDNS(config, providerNames, names, custom);
  validateReferences(config, new Set(groups.map(g => g.name)));
  return config;
}
