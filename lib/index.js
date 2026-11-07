import { createRequire as __cr } from "node:module";
import { fileURLToPath as __fu } from "node:url";
import { dirname as __dn } from "node:path";
const __filename = __fu(import.meta.url);
const __dirname = __dn(__filename);
const require = __cr(import.meta.url);

// src/host/service.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import { defineTool } from "@deepseek-ai/dsh-tools";
var here = path.dirname(fileURLToPath(import.meta.url));
var SKILL_CANDIDATES = [path.resolve(here, "..", "skill"), path.resolve(here, "..", "..", "skill")];
var SKILL_DIR = SKILL_CANDIDATES.find((p) => existsSync(path.join(p, "SKILL.md"))) || SKILL_CANDIDATES[0];
var TOOLS = path.join(SKILL_DIR, "tools");
var CLI = path.join(TOOLS, "bi_api.js");
var WORK = path.join(SKILL_DIR, "work");
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
    return { text: readText(path.join(SKILL_DIR, "SKILL.md")) };
  }
};
function readText(full) {
  try {
    const t = readFileSync(full, "utf8");
    return t.length > 2e5 ? t.slice(0, 2e5) + "\n...(\u8FC7\u957F\u5DF2\u622A\u65AD)" : t;
  } catch (e) {
    return "\u8BFB\u53D6\u5931\u8D25: " + e.message;
  }
}
function safeRead(rel) {
  const full = path.resolve(SKILL_DIR, rel);
  if (full !== SKILL_DIR && !full.startsWith(SKILL_DIR + path.sep)) return "\u9519\u8BEF:\u8DEF\u5F84\u8D8A\u754C(\u53EA\u80FD\u8BFB skill/ \u5185\u6587\u4EF6)";
  return readText(full);
}
function safeWrite(rel, content) {
  const full = path.resolve(WORK, rel);
  if (full !== WORK && !full.startsWith(WORK + path.sep)) return { error: "\u9519\u8BEF:\u53EA\u80FD\u5199 skill/work/ \u5185\u6587\u4EF6" };
  try {
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
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
].join("\n");
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
  const names = ["setBiContext", "getGuide"];
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
