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
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync, writeFileSync as writeFileSync2 } from "node:fs";
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/host/updater.js
import { gunzipSync } from "node:zlib";
import { mkdirSync, writeFileSync, renameSync, existsSync, unlinkSync } from "node:fs";
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
    const tmp = full + ".mbi-tmp";
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(tmp, e.data);
    try {
      renameSync(tmp, full);
      files++;
    } catch (err) {
      try {
        if (existsSync(full)) unlinkSync(full);
        renameSync(tmp, full);
        files++;
      } catch (e2) {
        try {
          unlinkSync(tmp);
        } catch {
        }
        throw e2;
      }
    }
  }
  return files;
}

// src/host/version.js
function versionGt(a, b) {
  const pa = (a || "").split(".").map(Number);
  const pb = (b || "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// src/host/service.js
var here = path2.dirname(fileURLToPath(import.meta.url));
var SKILL_CANDIDATES = [path2.resolve(here, "..", "skill"), path2.resolve(here, "..", "..", "skill")];
var SKILL_DIR = SKILL_CANDIDATES.find((p) => existsSync2(path2.join(p, "SKILL.md"))) || SKILL_CANDIDATES[0];
var TOOLS = path2.join(SKILL_DIR, "tools");
var CLI = path2.join(TOOLS, "bi_api.js");
var WORK = path2.join(SKILL_DIR, "work");
var PLUGIN_ROOT = path2.resolve(SKILL_DIR, "..");
var requireCjs = createRequire(import.meta.url);
var biCli = null;
function getBiCli() {
  if (!biCli) biCli = requireCjs(CLI);
  return biCli;
}
async function run(args) {
  try {
    const out = await getBiCli().runCommand(args);
    return String(out ?? "").trim() || "(\u65E0\u8F93\u51FA)";
  } catch (e) {
    return String(e?.message || e);
  }
}
var BI_CONTEXT_TEXT = [
  "\u3010Monitor BI \u4E13\u7528\u4F1A\u8BDD\u3011\u8FD9\u662F Monitor BI \u62A5\u8868\u5DE5\u4F5C\u5BA4\u7684\u5BF9\u8BDD,\u7528\u6237\u7684\u8BC9\u6C42\u90FD\u56F4\u7ED5 Monitor BI \u62A5\u8868\u3002",
  "\u89C4\u77E9:\u2460\u505A\u4EFB\u4F55 BI \u524D\u5148\u8C03 bi_guide \u8BFB\u64CD\u4F5C\u624B\u518C\u5E76\u9075\u5B88;\u2461\u8FDE\u63A5\u672A\u914D\u7F6E\u65F6,\u95EE\u7528\u6237\u56DB\u9879(\u5B8C\u6574BI\u5730\u5740\u542B\u7AEF\u53E3/\u516C\u53F8\u53F7\u5E26\u70B9\u540E\u7F00\u5982002.1/\u7528\u6237\u540D/\u5BC6\u7801)\u540E\u7528 bi_api \u7684 config \u547D\u4EE4\u914D\u7F6E,\u5DF2\u914D\u7F6E\u5C31\u4E0D\u8981\u518D\u95EE;",
  "\u2462\u4E00\u5207 BI \u64CD\u4F5C\u53EA\u901A\u8FC7 bi_api \u5DE5\u5177\u5B8C\u6210(\u8FDB\u7A0B\u5185\u6267\u884C,\u4E0D\u8C03\u7528\u5B50\u8FDB\u7A0B,\u4E0D\u8981\u7528 shell/PowerShell,\u4E5F\u7EDD\u4E0D\u9700\u8981\u7533\u8BF7\u7CFB\u7EDF\u6743\u9650\u6216 full control\u2014\u2014\u82E5\u6C99\u7BB1\u63D0\u793A,\u8BF4\u660E\u8D70\u9519\u4E86\u8DEF,\u56DE\u5230 bi_api \u5DE5\u5177);",
  '\u2463\u4EA7\u51FA\u5206\u4E24\u79CD:\u65E5\u5E38/\u56E2\u961F\u5171\u7528\u7684\u62A5\u8868\u9ED8\u8BA4\u505A Monitor BI \u770B\u677F;\u6302\u5899\u5927\u5C4F/\u7ED9\u5BA2\u6237\u6216\u9886\u5BFC\u7684\u6C47\u62A5/\u5185\u5BB9\u591A\u7B5B\u9009\u591A/\u70B9\u540D\u8981\u597D\u770B\u7684,\u6539\u7528 ECharts \u6F02\u4EAE\u7248(\u72EC\u7ACB HTML,\u89C1 bi_guide \u7684 ECharts \u4EA7\u7EBF\u8282)\u2014\u2014\u4F46\u6539\u8D70 ECharts \u524D\u5FC5\u987B\u5148\u5411\u7528\u6237\u5B8C\u6574\u544A\u77E5(\u4E0D\u5728\u6807\u51C6 Monitor BI \u9875\u9762/\u5F62\u5F0F\u4E3A\u72EC\u7ACB\u6587\u4EF6\u6216\u7AEF\u53E3\u9875/\u6570\u636E\u662F\u751F\u6210\u65F6\u523B\u5FEB\u7167)\u5E76\u7B49\u7528\u6237\u660E\u786E\u786E\u8BA4,\u786E\u8BA4\u524D\u4E0D\u8BB8\u751F\u6210;\u62FF\u4E0D\u51C6\u5C31\u505A Monitor BI \u5E76\u5728\u4EA4\u4ED8\u65F6\u544A\u77E5\u6709 ECharts \u53EF\u9009;\u2464\u751F\u6210 XML \u7528 bi_write \u5B58\u8349\u7A3F\u518D import/save;\u2465\u6539\u5DF2\u6709\u770B\u677F\u5FC5\u987B\u7528 save(ID/\u7F51\u5740\u4E0D\u53D8),\u53EA\u6709\u7528\u6237\u660E\u8BF4"\u505A\u4E00\u5F20\u65B0\u7684"\u624D import \u65B0\u76D8;\u2466\u90E8\u7F72\u5728\u82F1\u6587\u8BED\u8A00\u73AF\u5883,\u5B8C\u6210\u540E\u5207\u56DE\u4E2D\u6587;\u2467\u9047\u5230\u62A5\u9519\u5148\u67E5 SKILL.md \u7684"\u5E38\u89C1\u62A5\u9519\u901F\u67E5"\u8282(bi_guide \u53EF\u91CD\u8BFB)\u3002'
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
      if (!versionGt(latestVer, localPkg.version)) return { ok: true, updated: false, version: localPkg.version, message: "\u5DF2\u662F\u6700\u65B0\u7248\u672C" };
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
      const updateAvailable = versionGt(latestVer, localVer);
      const readme = typeof remote.readme === "string" ? remote.readme : "";
      const m = readme.match(/## 更新速览 v[\d.]+\n([\s\S]*?)(?=\n## |$)/);
      let releaseNotes = m ? m[1].trim() : "";
      if (releaseNotes.length > 500) {
        releaseNotes = releaseNotes.slice(0, 500);
        releaseNotes = releaseNotes.slice(0, releaseNotes.lastIndexOf(String.fromCharCode(10)) > 0 ? releaseNotes.lastIndexOf(String.fromCharCode(10)) : 500);
      }
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
function readText(full) {
  try {
    const t = readFileSync(full, "utf8");
    const nl = String.fromCharCode(10);
    return t.length > 2e5 ? t.slice(0, 2e5) + nl + "...(\u8FC7\u957F\u5DF2\u622A\u65AD)" : t;
  } catch (e) {
    return "\u8BFB\u53D6\u5931\u8D25: " + e.message;
  }
}
function safeRead(rel) {
  const full = path2.resolve(SKILL_DIR, rel);
  if (full !== SKILL_DIR && !full.startsWith(SKILL_DIR + path2.sep)) return "\u9519\u8BEF:\u8DEF\u5F84\u8D8A\u754C(\u53EA\u80FD\u8BFB skill/ \u5185\u6587\u4EF6)";
  return readText(full);
}
function safeWrite(rel, content) {
  const full = path2.resolve(WORK, rel);
  if (full !== WORK && !full.startsWith(WORK + path2.sep)) return { error: "\u9519\u8BEF:\u53EA\u80FD\u5199 skill/work/ \u5185\u6587\u4EF6" };
  try {
    mkdirSync2(path2.dirname(full), { recursive: true });
    writeFileSync2(full, content, "utf8");
    return { path: full };
  } catch (e) {
    return { error: e.message };
  }
}
var BI_API_HELP = [
  "Monitor BI \u5BA2\u6237\u7AEF\u547D\u4EE4(\u5B8C\u5168\u5728\u63D2\u4EF6\u8FDB\u7A0B\u5185\u6267\u884C,\u4E0D\u8C03\u7528\u5B50\u8FDB\u7A0B,\u65E0\u9700\u7533\u8BF7\u4EFB\u4F55\u7CFB\u7EDF\u6743\u9650/\u6C99\u7BB1\u6388\u6743;\u4E0D\u8981\u6539\u7528 shell \u547D\u4EE4\u884C\u8DD1\u8FD9\u4E9B):",
  "  config <BI\u5730\u5740> <\u516C\u53F8\u53F7> <\u7528\u6237\u540D> <\u5BC6\u7801>   \u9996\u6B21\u5FC5\u8DD1;\u516C\u53F8\u53F7\u5E26\u70B9\u540E\u7F00(\u5982 002.1);\u7AEF\u53E3\u6BCF\u5BB6\u4E0D\u540C,\u95EE\u7528\u6237",
  "  login | list | lang en|zh",
  "  import <\u6807\u9898> <xml\u7EDD\u5BF9\u8DEF\u5F84>               \u65B0\u5EFA\u770B\u677F(\u82F1\u6587\u73AF\u5883\u81EA\u52A8\u5904\u7406)",
  "  save <id> <xml\u7EDD\u5BF9\u8DEF\u5F84> [\u65B0\u6807\u9898]           \u6539\u5DF2\u6709\u770B\u677F,ID/\u7F51\u5740\u4E0D\u53D8(\u6807\u51C6\u6539\u76D8\u6D41\u7A0B)",
  "  get <id> | verify [\u5206\u949F] | backup <id...> | delete <id>",
  "\u8BE6\u7EC6\u89C4\u77E9(\u90E8\u7F72\u7EAA\u5F8B/B\u65B9\u6848/\u94C1\u5F8B/\u62A5\u9519\u901F\u67E5)\u5148\u8C03 bi_guide \u8BFB\u624B\u518C\u3002"
].join(String.fromCharCode(10));
function createToolDefinitions() {
  return [
    defineTool({
      name: "bi_api",
      description: BI_API_HELP,
      parameters: {
        command: { type: "string", description: "\u547D\u4EE4\u540D(config/login/list/import/save/get/verify/backup/delete/lang)", required: true },
        args: { type: "array", items: { type: "string" }, description: '\u547D\u4EE4\u53C2\u6570(\u5B57\u7B26\u4E32\u6570\u7EC4,\u5982 ["https://host:433","002.1","user","pwd"])' }
      },
      output: { schema: { type: "string" }, render: (_a, v) => [{ type: "text", text: String(v) }] },
      execute: async (a) => run([a.command, ...Array.isArray(a.args) ? a.args.map(String) : []])
    }),
    defineTool({
      name: "bi_write",
      description: "\u628A\u751F\u6210\u7684 Dashboard XML(\u6216 SQL \u7B49\u6587\u672C\u8349\u7A3F)\u5199\u5165\u63D2\u4EF6\u5DE5\u4F5C\u533A skill/work/,\u8FD4\u56DE\u7EDD\u5BF9\u8DEF\u5F84\u4F9B bi_api \u7684 import/save \u4F7F\u7528\u3002file \u53EA\u80FD\u662F\u76F8\u5BF9 work/ \u7684\u6587\u4EF6\u540D(\u5982 dash1.xml),\u4E0D\u4F1A\u8D8A\u754C\u3002",
      parameters: {
        file: { type: "string", description: "\u76F8\u5BF9\u6587\u4EF6\u540D,\u5982 purchase_due.xml", required: true },
        content: { type: "string", description: "\u5B8C\u6574\u6587\u4EF6\u5185\u5BB9(XML \u6587\u672C\u7B49)", required: true }
      },
      output: { schema: { type: "string" }, render: (_a, v) => [{ type: "text", text: String(v) }] },
      execute: async (a) => {
        const r = safeWrite(a.file, a.content);
        return r.error ? r.error : "\u5DF2\u5199\u5165: " + r.path;
      }
    }),
    defineTool({
      name: "bi_guide",
      description: "\u8BFB\u53D6 Monitor BI \u62A5\u8868\u751F\u6210\u5668\u5B8C\u6574\u64CD\u4F5C\u624B\u518C(SKILL.md):\u4E94\u6B65\u6D41\u7A0B\u3001\u6539\u76D8\u7EAA\u5F8B(B\u65B9\u6848,ID\u4E0D\u53D8)\u3001\u5341\u5927\u94C1\u5F8B\u3001\u5E38\u89C1\u62A5\u9519\u901F\u67E5\u3001\u5F00\u7BB1\u4F8B\u53E5\u3001\u6A21\u677F\u9009\u578B\u3002\u505A\u4EFB\u4F55 BI \u62A5\u8868\u524D\u5148\u8BFB\u8FD9\u4E2A\u3002",
      parameters: {},
      output: { schema: { type: "string" }, render: (_a, v) => [{ type: "text", text: String(v) }] },
      execute: async () => safeRead("SKILL.md")
    }),
    defineTool({
      name: "bi_read",
      description: "\u8BFB\u53D6\u63D2\u4EF6\u5185\u7F6E\u6280\u80FD\u7684\u4EFB\u610F\u6587\u4EF6:bi-spec-template.md(\u9700\u6C42\u89C4\u683C\u6A21\u677F)\u3001templates/\u6A21\u677FXML\u3001tools/module_dictionary.json(8\u6A21\u5757\u6570\u636E\u5B57\u5178,\u9009\u5217\u5FC5\u67E5)\u3001\u8BF4\u660E\u4E66.md\u3002file \u4E3A\u76F8\u5BF9 skill/ \u7684\u8DEF\u5F84\u3002",
      parameters: {
        file: { type: "string", description: "\u76F8\u5BF9 skill/ \u7684\u8DEF\u5F84,\u5982 templates/poc3_order_trend.xml \u6216 tools/module_dictionary.json", required: true }
      },
      output: { schema: { type: "string" }, render: (_a, v) => [{ type: "text", text: String(v) }] },
      execute: async (a) => safeRead(a.file)
    })
  ];
}
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
