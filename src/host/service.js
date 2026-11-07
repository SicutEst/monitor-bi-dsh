/**
 * monitor-bi host service. Extends TypertRemoteService so the web client can
 * call `setBiContext` over the Remote bridge. Registers the bi_* agent tools
 * and attaches a BI system prompt ONLY to sessions opened by the Monitor BI
 * panel (clean-room guarantee: normal conversations stay untouched).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { applyUpdate } from './updater.js';
import { versionGt } from './version.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// 源码布局 src/host -> ../../skill;构建布局 lib -> ../skill。自动探测(坑:写死层级在打包后差一级)
const SKILL_CANDIDATES = [path.resolve(here, '..', 'skill'), path.resolve(here, '..', '..', 'skill')];
export const SKILL_DIR = SKILL_CANDIDATES.find((p) => existsSync(path.join(p, 'SKILL.md'))) || SKILL_CANDIDATES[0];
const TOOLS = path.join(SKILL_DIR, 'tools');
const CLI = path.join(TOOLS, 'bi_api.js');
const WORK = path.join(SKILL_DIR, 'work');
const PLUGIN_ROOT = path.resolve(SKILL_DIR, '..');
const requireCjs = createRequire(import.meta.url);

// In-process BI client (NO child processes → NO sandbox/full-access prompts).
// bi_api.js exports runCommand when required as a module.
let biCli = null;
function getBiCli() {
  if (!biCli) biCli = requireCjs(CLI);
  return biCli;
}
async function run(args) {
  try {
    const out = await getBiCli().runCommand(args);
    return String(out ?? '').trim() || '(无输出)';
  } catch (e) {
    return String(e?.message || e);
  }
}

export const BI_CONTEXT_TEXT = [
  '【Monitor BI 专用会话】这是 Monitor BI 报表工作室的对话,用户的诉求都围绕 Monitor BI 报表。',
  '规矩:①做任何 BI 前先调 bi_guide 读操作手册并遵守;②连接未配置时,问用户四项(完整BI地址含端口/公司号带点后缀如002.1/用户名/密码)后用 bi_api 的 config 命令配置,已配置就不要再问;',
  '③一切 BI 操作只通过 bi_api 工具完成(进程内执行,不调用子进程,不要用 shell/PowerShell,也绝不需要申请系统权限或 full control——若沙箱提示,说明走错了路,回到 bi_api 工具);',
  '④生成 XML 用 bi_write 存草稿再 import/save;⑤改已有看板必须用 save(ID/网址不变),只有用户明说"做一张新的"才 import 新盘;⑥部署在英文语言环境,完成后切回中文;⑦遇到报错先查 SKILL.md 的"常见报错速查"节(bi_guide 可重读)。',
].join('\n');

export class MonitorBiService extends TypertRemoteService {
  static inject = ['tools'];

  constructor(ctx, config = {}) {
    super(ctx, 'monitorbi');
    this.ctx = ctx;
    this.config = config;
    /** session ids opened by the BI panel → get the BI system prompt */
    this.biSessions = new Set();

    for (const tool of createToolDefinitions()) {
      ctx.tools.register(tool);
    }

    ctx.inject(['systemPrompt'], (scope) => {
      scope.systemPrompt.context({
        name: 'monitor-bi-builder:session',
        order: 9400,
        interpolate: false,
        text: ({ agent }) => (this.biSessions.has(agent?.session?.id) ? BI_CONTEXT_TEXT : ''),
      });
    });

    ctx.logger?.info?.('monitor-bi-dsh: service started (tools: bi_api/bi_write/bi_guide/bi_read)');
  }

  /** Called by the web panel right after it opens a native session. */
  async setBiContext(request) {
    const { sessionId } = request ?? {};
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 160) throw new Error('无效会话');
    this.biSessions.add(sessionId);
    if (this.biSessions.size > 50) {
      // bound the set; oldest entries first (Set keeps insertion order)
      const first = this.biSessions.values().next().value;
      this.biSessions.delete(first);
    }
    return { ok: true };
  }

  async getGuide() {
    return { text: readText(path.join(SKILL_DIR, 'SKILL.md')) };
  }
  /**
   * 一键更新:进程内下载 npm 最新 tgz → 解 tar 覆盖自身文件 → 提示重启。
   * 无子进程、无权限提示;失败时返回错误,面板回退到“复制更新命令”。
   */
  async performUpdate() {
    try {
      const localPkg = JSON.parse(readFileSync(path.join(SKILL_DIR, '..', 'package.json'), 'utf8'));
      const res = await fetch('https://registry.npmjs.org/monitor-bi-dsh', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('npm 注册表无响应(' + res.status + ')');
      const remote = await res.json();
      const latestVer = (remote['dist-tags'] && remote['dist-tags'].latest) || '';
      if (!(versionGt(latestVer, localPkg.version))) return { ok: true, updated: false, version: localPkg.version, message: '已是最新版本' };
      const tarballUrl = remote.versions && remote.versions[latestVer] && remote.versions[latestVer].dist && remote.versions[latestVer].dist.tarball;
      if (!tarballUrl) throw new Error('registry 未提供下载地址');
      const tgzRes = await fetch(tarballUrl, { signal: AbortSignal.timeout(120000) });
      if (!tgzRes.ok) throw new Error('下载失败 HTTP ' + tgzRes.status);
      const buf = Buffer.from(await tgzRes.arrayBuffer());
      const files = applyUpdate(buf, PLUGIN_ROOT);
      this.ctx.logger?.info?.('monitor-bi-dsh: self-updated to ' + latestVer + ' (' + files + ' files)');
      return { ok: true, updated: true, version: latestVer, files, message: '已更新到 ' + latestVer + ',请重启 DSH 生效' };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  /** Check npm registry for a newer version; called by the panel on open. */
  async checkUpdate() {
    try {
      const localPkg = JSON.parse(readFileSync(path.join(SKILL_DIR, '..', 'package.json'), 'utf8'));
      const localVer = localPkg.version;
      // 拉完整 packument:dist-tags 给最新版本号;readme 给"更新速览"段(随包发布,不依赖 GitHub)
      const res = await fetch('https://registry.npmjs.org/monitor-bi-dsh', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { current: localVer, latest: localVer, releaseNotes: '', updateAvailable: false };
      const remote = await res.json();
      const latestVer = (remote['dist-tags'] && remote['dist-tags'].latest) || localVer;
      const updateAvailable = versionGt(latestVer, localVer);
      const readme = typeof remote.readme === 'string' ? remote.readme : '';
      const m = readme.match(/## 更新速览 v[\d.]+\n([\s\S]*?)(?=\n## |$)/);
      let releaseNotes = m ? m[1].trim() : '';
      if (releaseNotes.length > 500) { releaseNotes = releaseNotes.slice(0, 500); releaseNotes = releaseNotes.slice(0, releaseNotes.lastIndexOf(String.fromCharCode(10)) > 0 ? releaseNotes.lastIndexOf(String.fromCharCode(10)) : 500); }
      return {
        current: localVer,
        latest: latestVer,
        releaseNotes,
        updateAvailable,
        updateCommand: updateAvailable ? 'dsh plugin --profile desktop add monitor-bi-dsh' : null,
      };
    } catch (e) {
      return { current: 'unknown', latest: 'unknown', releaseNotes: '', updateAvailable: false };
    }
  }
}


function readText(full) {
  try {
    const t = readFileSync(full, 'utf8');
    const nl = String.fromCharCode(10);
    return t.length > 200000 ? t.slice(0, 200000) + nl + '...(过长已截断)' : t;
  } catch (e) { return '读取失败: ' + e.message; }
}

function safeRead(rel) {
  const full = path.resolve(SKILL_DIR, rel);
  if (full !== SKILL_DIR && !full.startsWith(SKILL_DIR + path.sep)) return '错误:路径越界(只能读 skill/ 内文件)';
  return readText(full);
}

function safeWrite(rel, content) {
  const full = path.resolve(WORK, rel);
  if (full !== WORK && !full.startsWith(WORK + path.sep)) return { error: '错误:只能写 skill/work/ 内文件' };
  try {
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
    return { path: full };
  } catch (e) { return { error: e.message }; }
}

const BI_API_HELP = [
  'Monitor BI 客户端命令(完全在插件进程内执行,不调用子进程,无需申请任何系统权限/沙箱授权;不要改用 shell 命令行跑这些):',
  '  config <BI地址> <公司号> <用户名> <密码>   首次必跑;公司号带点后缀(如 002.1);端口每家不同,问用户',
  '  login | list | lang en|zh',
  '  import <标题> <xml绝对路径>               新建看板(英文环境自动处理)',
  '  save <id> <xml绝对路径> [新标题]           改已有看板,ID/网址不变(标准改盘流程)',
  '  get <id> | verify [分钟] | backup <id...> | delete <id>',
  '详细规矩(部署纪律/B方案/铁律/报错速查)先调 bi_guide 读手册。',
].join(String.fromCharCode(10));

function createToolDefinitions() {
  return [
    defineTool({
      name: 'bi_api',
      description: BI_API_HELP,
      parameters: {
        command: { type: 'string', description: '命令名(config/login/list/import/save/get/verify/backup/delete/lang)', required: true },
        args: { type: 'array', items: { type: 'string' }, description: '命令参数(字符串数组,如 ["https://host:433","002.1","user","pwd"])' },
      },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (a) => run([a.command, ...(Array.isArray(a.args) ? a.args.map(String) : [])]),
    }),
    defineTool({
      name: 'bi_write',
      description: '把生成的 Dashboard XML(或 SQL 等文本草稿)写入插件工作区 skill/work/,返回绝对路径供 bi_api 的 import/save 使用。file 只能是相对 work/ 的文件名(如 dash1.xml),不会越界。',
      parameters: {
        file: { type: 'string', description: '相对文件名,如 purchase_due.xml', required: true },
        content: { type: 'string', description: '完整文件内容(XML 文本等)', required: true },
      },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (a) => {
        const r = safeWrite(a.file, a.content);
        return r.error ? r.error : '已写入: ' + r.path;
      },
    }),
    defineTool({
      name: 'bi_guide',
      description: '读取 Monitor BI 报表生成器完整操作手册(SKILL.md):五步流程、改盘纪律(B方案,ID不变)、十大铁律、常见报错速查、开箱例句、模板选型。做任何 BI 报表前先读这个。',
      parameters: {},
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async () => safeRead('SKILL.md'),
    }),
    defineTool({
      name: 'bi_read',
      description: '读取插件内置技能的任意文件:bi-spec-template.md(需求规格模板)、templates/模板XML、tools/module_dictionary.json(8模块数据字典,选列必查)、说明书.md。file 为相对 skill/ 的路径。',
      parameters: {
        file: { type: 'string', description: '相对 skill/ 的路径,如 templates/poc3_order_trend.xml 或 tools/module_dictionary.json', required: true },
      },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (a) => safeRead(a.file),
    }),
  ];
}

// Typert Remote 装饰

// Typert Remote 装饰(照 qiaomu-rss):把要暴露给网页面板的方法装饰成 Remote
export function applyRemoteDecorators() {
  const names = ['setBiContext', 'getGuide', 'checkUpdate', 'performUpdate'];
  const prototype = MonitorBiService.prototype;
  for (const name of names) {
    Remote(name)(prototype[name], {
      name,
      private: false,
      static: false,
      addInitializer(fn) { fn.call(Object.create(prototype)); },
    });
  }
}
