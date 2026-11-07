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
      if (!(latestVer > localPkg.version)) return { ok: true, updated: false, version: localPkg.version, message: '已是最新版本' };
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
      const updateAvailable = latestVer > localVer;
      const readme = typeof remote.readme === 'string' ? remote.readme : '';
      const m = readme.match(/## 更新速览 v[\d.]+\n([\s\S]*?)(?=\n## |$)/);
      const releaseNotes = m ? m[1].trim().slice(0, 500) : '';
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
