// BI API 客户端(自包含版):登录/导入/列表/B方案就地保存/备份/删除/体检
// 配置:同目录 bi_config.env——每台机器的 BI 地址/端口/公司号/账号都不一样,
//       首次使用必须问用户,然后: node bi_api.js config <地址> <公司号> <用户名> <密码>
// 依赖:同目录先执行 npm install(装 undici)
// 用法:
//   node bi_api.js config <地址> <公司号> <用户名> <密码> → 保存配置并立即试登录(首次必跑)
//   node bi_api.js login                      → 登录并保存 session(其余命令会自动登录)
//   node bi_api.js list                       → 列出仪表盘
//   node bi_api.js import <标题> <xml文件> [categoryId] → 导入新仪表盘,返回新ID
//   node bi_api.js save <id> <xml文件> [新标题] → B方案就地保存(ID/网址不变,标准改盘流程)
//   node bi_api.js get <id> [输出文件]         → 取仪表盘 JSON(不给文件只打摘要)
//   node bi_api.js get-xml <id> [输出文件]     → 从库里导出原始 XML 定义(需 PG_PSQL 配置)
//   node bi_api.js verify [分钟数=30]          → 查服务端日志最近取数SQL与报错(需 BI_LOG_DIR)
//   node bi_api.js backup <id...>             → 官方接口打包 zip 到 backups/
//   node bi_api.js delete <id>                → 删除
//   node bi_api.js lang en|zh                 → 切换管理语言(部署纪律:英文导入,中文切回)
const fs = require('fs');
const path = require('path');

// ---------- 配置:bi_config.env(config 命令生成/更新) ----------
const CFG = {};
const envFile = path.join(__dirname, 'bi_config.env');
const IS_MAIN = require.main === module; // 被 DSH 插件等 require 时=false,禁止 process.exit
let LOG = (...a) => console.log(...a); // CLI 模式直印;插件 runCommand 模式换成收集器
function reloadConfig() {
  for (const k of Object.keys(CFG)) delete CFG[k];
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#')) CFG[m[1]] = m[2];
    }
  }
}
reloadConfig();
function needConfig() {
  const text = [
    '【还没有连接配置——每台机器的 BI 地址/公司号/账号都不一样,必须问用户,禁止猜默认值】',
    '问用户要四项(就是平时浏览器打开 BI 登录用的信息):',
    '  1. BI 完整地址:浏览器里开 BI 用的完整网址,含端口(端口每家不一样,433/88/85 都有)',
    '  2. 公司号:登录页公司下拉框的完整编号,带点后缀(如 002.1 / 003.1,只写 002 会 401)',
    '  3. 用户名',
    '  4. 密码',
    '拿到后运行(自动保存并立即试登录,只需配一次):',
    '  node bi_api.js config <地址> <公司号> <用户名> <密码>',
  ].join('\n');
  if (IS_MAIN) { console.error(text); process.exit(2); }
  throw new Error(text);
}
if (IS_MAIN && process.argv[2] !== 'config') {
  for (const k of ['BI_URL', 'BI_COMPANY', 'BI_USER', 'BI_PASSWORD']) {
    if (!CFG[k]) needConfig();
  }
}
let BASE = (CFG.BI_URL || '').replace(/\/+$/, '');

// ---------- undici:本地 node_modules 优先,其次全局查找 ----------
let undici;
try {
  undici = require(path.join(__dirname, 'node_modules', 'undici'));
} catch {
  try { undici = require('undici'); } catch {
    console.error('缺依赖:在 tools/ 目录执行  npm install');
    process.exit(1);
  }
}
const { fetch, Agent } = undici;
const dispatcher = new Agent({ connect: { rejectUnauthorized: false } }); // BI 自签证书

const SESSION_FILE = path.join(__dirname, 'session.json');
let session;

function loadSession() {
  try { session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); } catch { session = null; }
}

async function login() {
  let res;
  try {
    res = await fetch(BASE + '/api/account/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: CFG.BI_USER, password: CFG.BI_PASSWORD, companyNumber: CFG.BI_COMPANY, forceRelogin: true }),
      dispatcher,
    });
  } catch (e) {
    const code = (e.cause && e.cause.code) || e.message;
    throw new Error('连不上 BI(' + code + '):多半是地址或端口不对。和用户确认浏览器打开 BI 用的完整网址后,重跑 node bi_api.js config <地址> <公司号> <用户名> <密码>');
  }
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('登录失败 HTTP ' + res.status + ': ' + JSON.stringify(body)
    + '\n常见原因:401=公司号没带点后缀(要 002.1 不是 002)或密码错;403=账号没有 BI 权限。修正后重跑 config 命令');
  session = { cookie: setCookie.map(c => c.split(';')[0]).join('; '), ts: Date.now() };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session));
  LOG('登录 OK, 用户', body.username || CFG.BI_USER, '@', BASE);
  return session;
}

async function api(method, p, body) {
  loadSession();
  if (!session) await login();
  const doCall = () => fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
    dispatcher,
  });
  let res = await doCall();
  if (res.status === 401) { await login(); res = await doCall(); }
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${p}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function setLang(lang) {
  await api('PUT', '/api/admin/language/' + lang);
}

// B方案就地保存:英文环境→临时导入→取裸Dashboard→POST回原ID→删临时→切回中文(坑23)
async function saveInPlace(id, xmlFile, newTitle) {
  const xml = fs.readFileSync(xmlFile, 'utf8');
  await setLang('en');
  try {
    // 保留原标题(不给新标题时)
    let title = newTitle;
    if (!title) {
      const cur = await api('GET', '/api/dashboard/dashboards/' + id);
      title = cur.Dashboard && cur.Dashboard.Title && cur.Dashboard.Title['@Text'] || '未命名';
    }
    const r1 = await api('POST', '/api/userdashboard/import', { Name: title, Xml: xml, CategoryId: null });
    const tempId = r1.dashboardId;
    const r2 = await api('GET', '/api/dashboard/dashboards/' + tempId);
    const bare = r2.Dashboard; // 裸 Dashboard,坑17:POST 只认这个,带壳会把盘清成52字节空壳
    const r3 = await api('POST', '/api/dashboard/dashboards/' + id, bare);
    if (r3 === undefined || r3 === '') throw new Error('就地保存 POST 返回空');
    await api('DELETE', '/api/userdashboard/' + tempId).catch(() => {});
    return title;
  } finally {
    await setLang('zh').catch(() => {});
  }
}

// 从库里导出原始 XML 定义(bytea hex → xml 文件),需 bi_config.env 配 PG_*
function exportXml(id, outFile) {
  if (!CFG.PG_PSQL) throw new Error('get-xml 需要 bi_config.env 配置 PG_PSQL(本机装 PostgreSQL 客户端)');
  const { execSync } = require('child_process');
  const hexFile = path.join(__dirname, '_export.hex');
  execSync(`"${CFG.PG_PSQL}" -h ${CFG.PG_HOST || '127.0.0.1'} -p ${CFG.PG_PORT || 5432} -U ${CFG.PG_USER} -d ${CFG.PG_DB || 'BusinessIntelligence'} -tAc "\\copy (select definition from settings.dashboard where id='${id}') to '${hexFile}'"`,
    { env: { ...process.env, PGPASSWORD: CFG.PG_PASSWORD || '' }, cwd: __dirname, encoding: 'utf8', stdio: 'pipe' });
  let t = fs.readFileSync(hexFile, 'utf8').trim().replace(/^[\\]+x/, '').replace(/\s+/g, '');
  const xml = Buffer.from(t, 'hex').toString('utf8').replace(/^\uFEFF/, '');
  fs.unlinkSync(hexFile);
  fs.writeFileSync(outFile, xml);
  return xml;
}

async function main(argv) {
  const cmd = argv[0];
  const args = argv.slice(1);
  if (cmd === 'config') {
    if (args.length < 4) throw new Error('用法: node bi_api.js config <BI地址> <公司号> <用户名> <密码>');
    const [url, company, user, pwd] = args;
    fs.writeFileSync(envFile, [
      '# Monitor BI 连接配置(由 config 命令生成;换环境/换密码重跑 config 即可)',
      'BI_URL=' + url,
      'BI_COMPANY=' + company,
      'BI_USER=' + user,
      'BI_PASSWORD=' + pwd,
      '',
      '# 可选:BI 服务器日志目录(verify 命令用;BI 不在本机就保持注释)',
      '# BI_LOG_DIR=<BI安装目录>\\Logs',
      '',
      '# 可选:直连 BI 库导出原始 XML 定义(get-xml / check_bindings 用;各机器端口/账号/密码不同,用到时向用户或其 IT 要,取消注释逐项填)',
      '# PG_PSQL=C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe',
      '# PG_HOST=127.0.0.1',
      '# PG_PORT=5432',
      '# PG_USER=BIuser',
      '# PG_DB=BusinessIntelligence',
      '# PG_PASSWORD=',
      '',
    ].join('\r\n'));
    CFG.BI_URL = url; CFG.BI_COMPANY = company; CFG.BI_USER = user; CFG.BI_PASSWORD = pwd;
    BASE = url.replace(/\/+$/, '');
    LOG('配置已保存 → ' + envFile + ',正在试登录…');
    return login();
  }
  if (cmd === 'login') return login();
  if (cmd === 'list') {
    const r = await api('GET', '/api/userdashboard/dashboards');
    let n = 0;
    for (const cat of r) for (const d of cat.dashboards) {
      LOG(`[${cat.category}] ${d.name} id=${d.id} std=${d.isStandard}`); n++;
    }
    LOG(`共 ${n} 张`); return;
  }
  if (cmd === 'import') {
    if (args.length < 2) throw new Error('用法: node bi_api.js import <标题> <xml文件> [categoryId]');
    await setLang('en'); // 坑23:必须英文环境导入
    try {
      const r = await api('POST', '/api/userdashboard/import', { Name: args[0], Xml: fs.readFileSync(args[1], 'utf8'), CategoryId: args[2] || null });
      LOG('导入成功:', JSON.stringify(r));
      fs.writeFileSync(path.join(__dirname, 'last_import.json'), JSON.stringify(r));
      return r;
    } finally { await setLang('zh').catch(() => {}); }
  }
  if (cmd === 'save') {
    if (args.length < 2) throw new Error('用法: node bi_api.js save <id> <xml文件> [新标题]');
    const title = await saveInPlace(args[0], path.resolve(args[1]), args[2]);
    const back = await api('GET', '/api/dashboard/dashboards/' + args[0]);
    const s = JSON.stringify(back);
    LOG('就地保存完成 | 标题:', title, '| ID 不变:', args[0].slice(0, 8));
    LOG('读回验证:', back.Dashboard && back.Dashboard.Title && back.Dashboard.Title['@Text'] === title ? '✅ 标题一致' : '⚠️ 标题不符,人工检查');
    return;
  }
  if (cmd === 'get') {
    const r = await api('GET', '/api/dashboard/dashboards/' + args[0]);
    if (args[1]) {
      fs.writeFileSync(args[1], JSON.stringify(r, null, 1));
      LOG('已写入', args[1], JSON.stringify(r).length, '字符');
    } else {
      LOG(JSON.stringify(r).slice(0, 500));
    }
    return r;
  }
  if (cmd === 'get-xml') {
    const out = args[1] || (args[0].slice(0, 8) + '.xml');
    const xml = exportXml(args[0], out);
    LOG('已导出', out, xml.length, '字符'); return;
  }
  if (cmd === 'verify') {
    // spec §3.5 第一道关:服务端日志最近取数 SQL 与报错
    const minutes = parseInt(args[0] || '30', 10);
    const dir = CFG.BI_LOG_DIR;
    if (!dir || !fs.existsSync(dir)) { LOG('未配置 BI_LOG_DIR 或目录不存在,跳过日志检查(不影响使用)'); return; }
    const logFile = path.join(dir, 'BIServerLog-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.txt');
    const lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter(l => l.trim());
    const cutoff = Date.now() - minutes * 60000;
    const recent = lines.filter(l => {
      const m = l.match(/^([\d-]+ [\d:.]+) /);
      if (!m) return false;
      return new Date(m[1].replace(/ (\d)/, ' T$1').replace(' ', '') + '+08:00').getTime() >= cutoff
        || new Date(m[1] + '+08:00').getTime() >= cutoff;
    });
    const sql = recent.filter(l => /Dashboard SQL/.test(l));
    const err = recent.filter(l => /\[ERR\]|responded 5\d\d/.test(l));
    LOG(`近 ${minutes} 分钟:取数 SQL ${sql.length} 条,错误 ${err.length} 条`);
    for (const l of sql.slice(-6)) LOG('  SQL:', l.slice(l.indexOf('DBG') + 4).trim().slice(0, 150));
    for (const l of err.slice(-4)) LOG('  ERR:', l.slice(0, 200));
    if (!sql.length) LOG('  (无取数记录:先在浏览器打开仪表盘,或检查是否刚导入未访问)');
    return;
  }
  if (cmd === 'backup') {
    if (!args.length) throw new Error('用法: node bi_api.js backup <dashboardId...>');
    loadSession(); if (!session) await login();
    const res = await fetch(BASE + '/api/userdashboard/backup', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
      body: JSON.stringify(args), dispatcher,
    });
    if (!res.ok) throw new Error(`备份失败 HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const dir = path.join(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'dashboards-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16) + '.zip');
    fs.writeFileSync(file, buf);
    LOG('备份完成:', file, buf.length, 'bytes'); return;
  }
  if (cmd === 'delete') {
    const r = await api('DELETE', '/api/userdashboard/' + args[0]);
    LOG('已删除', args[0]); return;
  }
  if (cmd === 'lang') {
    await setLang(args[0]);
    LOG('语言已切换:', args[0]); return;
  }
  LOG('未知命令。可用:login list import save get get-xml verify backup delete lang');
}

if (require.main === module) {
  const [,, ...argv] = process.argv;
  main(argv).catch(e => { console.error(e.message); process.exit(1); });
}
// 供 DSH 插件等宿主进程内调用(免子进程/免沙箱权限):
// const { runCommand } = require('<此文件>'); await runCommand(['list'])
async function runCommand(argv) {
  reloadConfig();
  if (argv[0] !== 'config') {
    for (const k of ['BI_URL', 'BI_COMPANY', 'BI_USER', 'BI_PASSWORD']) {
      if (!CFG[k]) needConfig();
    }
    BASE = (CFG.BI_URL || '').replace(/\/+$/, '');
  }
  const lines = [];
  const prevLog = LOG;
  LOG = (...a) => lines.push(a.map(String).join(' '));
  try {
    await main(argv);
    return lines.join('\n');
  } finally { LOG = prevLog; }
}
module.exports = { api, login, CFG, dispatcher, fetch, saveInPlace, exportXml, runCommand };
