import { createRequire as __cr } from "node:module";
import { fileURLToPath as __fu } from "node:url";
import { dirname as __dn } from "node:path";
const __filename = __fu(import.meta.url);
const __dirname = __dn(__filename);
const require = __cr(import.meta.url);

// src/host/service.js
import path2 from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync, mkdirSync as mkdirSync2, readFileSync, writeFileSync as writeFileSync2 } from "node:fs";
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/host/updater.js
import { gunzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
function parseTar(buf) {
  const entries = [];
  let off = 0;
  let paxPath = null;
  while (off + 512 <= buf.length) {
    const block = buf.subarray(off, off + 512);
    if (block.every((b) => b === 0)) break;
    const name = block.toString("utf8", 0, 100).replace(/\0[\s\S]*$/, "").trim();
    const size = parseInt(block.toString("utf8", 124, 136).replace(/[\0\s]+$/, ""), 8) || 0;
    const type = String.fromCharCode(block[156] || 48);
    const prefix = block.toString("utf8", 345, 500).replace(/\0[\s\S]*$/, "").trim();
    off += 512;
    const data = size > 0 ? buf.subarray(off, off + size) : buf.subarray(0, 0);
    off += Math.ceil(size / 512) * 512;
    if (type === "x" || type === "g") {
      const pax = data.toString("utf8");
      const m = pax.match(/\d+ path=([^\n]+)/);
      if (m && type === "x") paxPath = m[1].trim();
      continue;
    }
    if (type === "0" || type === "\0") {
      const finalPath = (paxPath || (prefix ? prefix + "/" + name : name)).replace(/\/+$/, "");
      paxPath = null;
      if (finalPath) entries.push({ path: finalPath, data });
    } else {
      paxPath = null;
    }
  }
  return entries;
}
function applyUpdate(tgzBuf, pluginRoot) {
  const tar = gunzipSync(tgzBuf);
  const entries = parseTar(tar);
  let files = 0;
  for (const e of entries) {
    const rel = e.path.replace(/^package\//, "");
    if (!rel || rel.includes("..") || path.isAbsolute(rel)) continue;
    const full = path.join(pluginRoot, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, e.data);
    files++;
  }
  return files;
}

// src/host/service.js
var here = path2.dirname(fileURLToPath(import.meta.url));
var SKILL_CANDIDATES = [path2.resolve(here, "..", "skill"), path2.resolve(here, "..", "..", "skill")];
var SKILL_DIR = SKILL_CANDIDATES.find((p) => existsSync(path2.join(p, "SKILL.md"))) || SKILL_CANDIDATES[0];
var TOOLS = path2.join(SKILL_DIR, "tools");
var CLI = path2.join(TOOLS, "bi_api.js");
var WORK = path2.join(SKILL_DIR, "work");
var PLUGIN_ROOT = path2.resolve(SKILL_DIR, "..");
var requireCjs = createRequire(import.meta.url);
var BI_CONTEXT_TEXT = [
  "\u3010Monitor BI \u4E13\u7528\u4F1A\u8BDD\u3011\u8FD9\u662F Monitor BI \u62A5\u8868\u5DE5\u4F5C\u5BA4\u7684\u5BF9\u8BDD,\u7528\u6237\u7684\u8BC9\u6C42\u90FD\u56F4\u7ED5 Monitor BI \u62A5\u8868\u3002",
  "\u89C4\u77E9:\u2460\u505A\u4EFB\u4F55 BI \u524D\u5148\u8C03 bi_guide \u8BFB\u64CD\u4F5C\u624B\u518C\u5E76\u9075\u5B88;\u2461\u8FDE\u63A5\u672A\u914D\u7F6E\u65F6,\u95EE\u7528\u6237\u56DB\u9879(\u5B8C\u6574BI\u5730\u5740\u542B\u7AEF\u53E3/\u516C\u53F8\u53F7\u5E26\u70B9\u540E\u7F00\u5982002.1/\u7528\u6237\u540D/\u5BC6\u7801)\u540E\u7528 bi_api \u7684 config \u547D\u4EE4\u914D\u7F6E,\u5DF2\u914D\u7F6E\u5C31\u4E0D\u8981\u518D\u95EE;",
  "\u2462\u4E00\u5207 BI \u64CD\u4F5C\u53EA\u901A\u8FC7 bi_api \u5DE5\u5177\u5B8C\u6210(\u8FDB\u7A0B\u5185\u6267\u884C,\u4E0D\u8C03\u7528\u5B50\u8FDB\u7A0B,\u4E0D\u8981\u7528 shell/PowerShell,\u4E5F\u7EDD\u4E0D\u9700\u8981\u7533\u8BF7\u7CFB\u7EDF\u6743\u9650\u6216 full control\u2014\u2014\u82E5\u6C99\u7BB1\u63D0\u793A,\u8BF4\u660E\u8D70\u9519\u4E86\u8DEF,\u56DE\u5230 bi_api \u5DE5\u5177);",
  '\u2463\u751F\u6210 XML \u7528 bi_write \u5B58\u8349\u7A3F\u518D import/save;\u2464\u6539\u5DF2\u6709\u770B\u677F\u5FC5\u987B\u7528 save(ID/\u7F51\u5740\u4E0D\u53D8),\u53EA\u6709\u7528\u6237\u660E\u8BF4"\u505A\u4E00\u5F20\u65B0\u7684"\u624D import \u65B0\u76D8;\u2465\u90E8\u7F72\u5728\u82F1\u6587\u8BED\u8A00\u73AF\u5883,\u5B8C\u6210\u540E\u5207\u56DE\u4E2D\u6587;\u2466\u9047\u5230\u62A5\u9519\u5148\u67E5 SKILL.md \u7684"\u5E38\u89C1\u62A5\u9519\u901F\u67E5"\u8282(bi_guide \u53EF\u91CD\u8BFB)\u3002'
].join("\n");
var MonitorBiService = class extends TypertRemoteService {
  static inject = ["tools"];
  constructor(ctx, config = {}) {
    super(ctx, "monitorbi");
    this.ctx = ctx;
    this.config = config;
    this.biSessions = /* @__PURE__ */ new Set();
    for (const tool of createToolDefinitions()) {
      ctx.tools.register(tool);
    }
    ctx.inject(["systemPrompt"], (scope) => {
      scope.systemPrompt.context({
        name: "monitor-bi-builder:session",
        order: 9400,
        interpolate: false,
        text: ({ agent }) => this.biSessions.has(agent?.session?.id) ? BI_CONTEXT_TEXT : ""
      });
    });
    ctx.logger?.info?.("monitor-bi-dsh: service started (tools: bi_api/bi_write/bi_guide/bi_read)");
  }
  /** Called by the web panel right after it opens a native session. */
  async setBiContext(request) {
    const { sessionId } = request ?? {};
    if (typeof sessionId !== "string" || !sessionId || sessionId.length > 160) throw new Error("\u65E0\u6548\u4F1A\u8BDD");
    this.biSessions.add(sessionId);
    if (this.biSessions.size > 50) {
      const first = this.biSessions.values().next().value;
      this.biSessions.delete(first);
    }
    return { ok: true };
  }
  async getGuide() {
    return { text: readText(path2.join(SKILL_DIR, "SKILL.md")) };
  }
  /**
   * 一键更新:进程内下载 npm 最新 tgz → 解 tar 覆盖自身文件 → 提示重启。
   * 无子进程、无权限提示;失败时返回错误,面板回退到“复制更新命令”。
   */
  async performUpdate() {
    try {
      const localPkg = JSON.parse(readFileSync(path2.join(SKILL_DIR, "..", "package.json"), "utf8"));
      const res = await fetch("https://registry.npmjs.org/monitor-bi-dsh", { signal: AbortSignal.timeout(8e3) });
      if (!res.ok) throw new Error("npm \u6CE8\u518C\u8868\u65E0\u54CD\u5E94(" + res.status + ")");
      const remote = await res.json();
      const latestVer = remote["dist-tags"] && remote["dist-tags"].latest || "";
      if (!(latestVer > localPkg.version)) return { ok: true, updated: false, version: localPkg.version, message: "\u5DF2\u662F\u6700\u65B0\u7248\u672C" };
      const tarballUrl = remote.versions && remote.versions[latestVer] && remote.versions[latestVer].dist && remote.versions[latestVer].dist.tarball;
      if (!tarballUrl) throw new Error("registry \u672A\u63D0\u4F9B\u4E0B\u8F7D\u5730\u5740");
      const tgzRes = await fetch(tarballUrl, { signal: AbortSignal.timeout(12e4) });
      if (!tgzRes.ok) throw new Error("\u4E0B\u8F7D\u5931\u8D25 HTTP " + tgzRes.status);
      const buf = Buffer.from(await tgzRes.arrayBuffer());
      const files = applyUpdate(buf, PLUGIN_ROOT);
      this.ctx.logger?.info?.("monitor-bi-dsh: self-updated to " + latestVer + " (" + files + " files)");
      return { ok: true, updated: true, version: latestVer, files, message: "\u5DF2\u66F4\u65B0\u5230 " + latestVer + ",\u8BF7\u91CD\u542F DSH \u751F\u6548" };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }
  /** Check npm registry for a newer version; called by the panel on open. */
  async checkUpdate() {
    try {
      const localPkg = JSON.parse(readFileSync(path2.join(SKILL_DIR, "..", "package.json"), "utf8"));
      const localVer = localPkg.version;
      const res = await fetch("https://registry.npmjs.org/monitor-bi-dsh", { signal: AbortSignal.timeout(8e3) });
      if (!res.ok) return { current: localVer, latest: localVer, releaseNotes: "", updateAvailable: false };
      const remote = await res.json();
      const latestVer = remote["dist-tags"] && remote["dist-tags"].latest || localVer;
      const updateAvailable = latestVer > localVer;
      const readme = typeof remote.readme === "string" ? remote.readme : "";
      const m = readme.match(/## 更新速览 v[\d.]+\n([\s\S]*?)(?=\n## |$)/);
      const releaseNotes = m ? m[1].trim().slice(0, 500) : "";
      return {
        current: localVer,
        latest: latestVer,
        releaseNotes,
        updateAvailable,
        updateCommand: updateAvailable ? "dsh plugin --profile desktop add monitor-bi-dsh" : null
      };
    } catch (e) {
      return { current: "unknown", latest: "unknown", releaseNotes: "", updateAvailable: false };
    }
  }
};
function applyRemoteDecorators() {
  const names = ["setBiContext", "getGuide", "checkUpdate", "performUpdate"];
  const prototype = MonitorBiService.prototype;
  for (const name of names) {
    Remote(name)(prototype[name], {
      name,
      private: false,
      static: false,
      addInitializer(fn) {
        fn.call(Object.create(prototype));
      }
    });
  }
}

// src/host/index.js
applyRemoteDecorators();
var index_default = MonitorBiService;
export {
  MonitorBiService,
  index_default as default
};
