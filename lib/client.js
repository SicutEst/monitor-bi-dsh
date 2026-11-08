window.__ModuleLoader__.load({
	id: "monitor-bi-dsh",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  BiSidebarIcon: () => BiSidebarIcon,
  ECHARTS_PANEL_ID: () => ECHARTS_PANEL_ID,
  EChartsSidebarIcon: () => EChartsSidebarIcon,
  PANEL_ID: () => PANEL_ID,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react3 = require("react");

// src/client/BiPanel.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var BI_STORE = "monitorbi.chat.session";
var EC_STORE = "monitorbi.echarts.session";
function BiPanel({ api, SessionProvider, renderSlot, biChatSlot, echartsChatSlot }) {
  const [mode, setMode] = (0, import_react.useState)("bi");
  const [updateInfo, setUpdateInfo] = (0, import_react.useState)(null);
  const [copied, setCopied] = (0, import_react.useState)(false);
  const [updState, setUpdState] = (0, import_react.useState)("idle");
  const [updMsg, setUpdMsg] = (0, import_react.useState)("");
  const hoverStyle = ".mbi-upd:hover .mbi-pop{display:block} .mbi-pop{display:none;position:absolute;top:calc(100% + 6px);right:0;width:400px;max-width:calc(100vw - 48px);z-index:99;background:#fff3cd;border:1px solid #ffe69c;border-radius:10px;padding:14px 18px;box-shadow:0 8px 24px rgba(15,23,42,.18);font-size:12px;line-height:1.7;color:#1f2d3d;max-height:300px;overflow-y:auto;white-space:pre-wrap}";
  const notes = (updateInfo?.releaseNotes || "").trim();
  (0, import_react.useEffect)(() => {
    if (!api?.checkUpdate) return;
    api.checkUpdate().then((r) => {
      if (r && r.updateAvailable) setUpdateInfo(r);
    }).catch(() => {
    });
  }, []);
  async function runUpdate() {
    setUpdState("doing");
    try {
      const r = await api.performUpdate();
      if (r && r.ok) {
        setUpdState("done");
        if (r.message) setUpdMsg(r.message);
      } else {
        setUpdState("fail");
        setUpdMsg(r && r.error || "\u672A\u77E5\u9519\u8BEF");
      }
    } catch (e) {
      setUpdState("fail");
      setUpdMsg(String(e && e.message || e));
    }
  }
  function copyUpdateCmd() {
    if (updateInfo?.updateCommand) {
      navigator.clipboard?.writeText(updateInfo.updateCommand).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2e3);
      }).catch(() => {
      });
    }
  }
  const [bi, setBi] = (0, import_react.useState)(null);
  const [ec, setEc] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const ownedBi = (0, import_react.useRef)(null);
  const ownedEc = (0, import_react.useRef)(null);
  async function openRoom(kind) {
    const workspaceId = api.defaultChatWorkspace?.();
    if (!workspaceId) throw new Error("\u5C1A\u672A\u627E\u5230\u53EF\u7528\u5DE5\u4F5C\u533A,\u8BF7\u5148\u5728 Harness \u4E2D\u6253\u5F00\u4E00\u4E2A\u5DE5\u4F5C\u533A");
    const store = kind === "bi" ? BI_STORE : EC_STORE;
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(store) : null;
    let acquired;
    try {
      acquired = await api.openChat({ workspaceId, sessionId: saved || void 0 });
    } catch (cause) {
      if (!saved) throw cause;
      if (typeof localStorage !== "undefined") localStorage.removeItem(store);
      acquired = await api.openChat({ workspaceId });
    }
    if (kind === "bi") await api.setBiContext({ sessionId: acquired.sessionId }).catch(() => {
    });
    else await api.setEchartsContext({ sessionId: acquired.sessionId }).catch(() => {
    });
    return acquired;
  }
  function keep(kind, acquired) {
    if (kind === "bi") {
      ownedBi.current?.release();
      ownedBi.current = acquired;
    } else {
      ownedEc.current?.release();
      ownedEc.current = acquired;
    }
    if (typeof localStorage !== "undefined") localStorage.setItem(kind === "bi" ? BI_STORE : EC_STORE, acquired.sessionId);
  }
  function activate(kind) {
    setBusy(true);
    (async () => {
      try {
        if (kind === "bi" && ownedBi.current) {
          setBi(ownedBi.current);
          setBusy(false);
          return;
        }
        if (kind === "echarts" && ownedEc.current) {
          setEc(ownedEc.current);
          setBusy(false);
          return;
        }
        const acquired = await openRoom(kind);
        keep(kind, acquired);
        if (kind === "bi") setBi(acquired);
        else setEc(acquired);
      } catch (cause) {
        setError(cause?.message ?? String(cause));
      } finally {
        setBusy(false);
      }
    })();
  }
  (0, import_react.useEffect)(() => {
    activate("bi");
  }, []);
  const pill = (active) => ({
    padding: "3px 14px",
    fontSize: 12,
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 600,
    border: "1px solid " + (active ? "#4d6bfe" : "#dfe4ea"),
    background: active ? "#4d6bfe" : "#fff",
    color: active ? "#fff" : "#1f2d3d"
  });
  const shell = { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 };
  const header = { display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--dsw-alias-separator-solid, rgba(128,128,128,.25))", fontSize: 13 };
  const body = { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: shell, "aria-label": "Monitor BI \u5DE5\u4F5C\u5BA4", children: [
    updateInfo && updateInfo.updateAvailable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "mbi-upd", style: { position: "relative" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: hoverStyle }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "#fff3cd", borderBottom: "1px solid #ffe69c", fontSize: 12 }, role: "status", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: "\u{1F514}" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u65B0\u7248\u672C ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
            "v",
            updateInfo.latest
          ] }),
          " \u53EF\u7528\uFF08\u5F53\u524D v",
          updateInfo.current,
          "\uFF09"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
        updState === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { style: { color: "#27ae60" }, children: [
          "\u2713 ",
          updMsg || "\u5DF2\u66F4\u65B0,\u8BF7\u91CD\u542F DSH \u751F\u6548"
        ] }) : updState === "doing" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { style: { color: "#8492a6" }, children: "\u66F4\u65B0\u4E2D,\u8BF7\u7A0D\u5019\u2026" }) : updState === "fail" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: "#e74c3c" }, children: [
          "\u4E00\u952E\u66F4\u65B0\u5931\u8D25:",
          updMsg,
          "(\u53EF\u590D\u5236\u547D\u4EE4\u515C\u5E95)"
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => void runUpdate(), style: {
          padding: "4px 16px",
          fontSize: 12,
          border: "none",
          borderRadius: 999,
          background: "#4d6bfe",
          color: "#fff",
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontWeight: 600,
          boxShadow: "0 2px 8px rgba(77,107,254,.4)"
        }, onMouseOver: (e) => {
          e.currentTarget.style.background = "#3a56e8";
        }, onMouseOut: (e) => {
          e.currentTarget.style.background = "#4d6bfe";
        }, children: "\u2B07 \u66F4\u65B0" }),
        updState === "fail" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: copyUpdateCmd, style: {
          padding: "3px 12px",
          fontSize: 11,
          border: "1px solid #4d6bfe",
          borderRadius: 999,
          background: copied ? "#d4edda" : "#fff",
          cursor: "pointer",
          whiteSpace: "nowrap"
        }, children: copied ? "\u2713 \u5DF2\u590D\u5236" : "\u590D\u5236\u547D\u4EE4\u515C\u5E95" }),
        notes && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "mbi-pop", role: "tooltip", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
            "v",
            updateInfo.latest,
            " \u66F4\u65B0\u5185\u5BB9:"
          ] }),
          String.fromCharCode(10, 10),
          notes
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { style: header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: "\u{1F4CA}" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Monitor BI \u5DE5\u4F5C\u5BA4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { opacity: 0.45, fontSize: 11 }, children: [
        "v",
        "1.0.1"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: pill(mode === "bi"), onClick: () => setMode("bi"), children: "BI \u770B\u677F" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: pill(mode === "echarts"), onClick: () => setMode("echarts"), children: "ECharts \u6F02\u4EAE\u7248" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { opacity: 0.55, fontSize: 11 }, children: "\u4E24\u79CD\u4EA7\u51FA,\u4E0A\u4E0B\u6587\u5206\u5F00" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => activate(mode === "bi" ? "bi" : "echarts"), disabled: busy, title: "\u5F53\u524D\u6A21\u5F0F\u5F00\u4E00\u4E2A\u65B0\u5BF9\u8BDD", children: "\u65B0\u5BF9\u8BDD" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: body, children: [
      error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { role: "alert", style: { padding: 24 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u672A\u80FD\u6253\u5F00" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { whiteSpace: "pre-wrap" }, children: error }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => activate(mode), children: "\u91CD\u8BD5" })
      ] }),
      !error && busy && !(mode === "bi" ? bi : ec) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { role: "status", style: { padding: 24, opacity: 0.7 }, children: [
        "\u6B63\u5728\u6253\u5F00",
        mode === "bi" ? " BI \u770B\u677F" : " ECharts",
        "\u4F1A\u8BDD\u2026"
      ] }),
      mode === "bi" && bi && SessionProvider && renderSlot && biChatSlot && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionProvider, { session: bi.reference, children: renderSlot(biChatSlot, {}) }),
      mode === "echarts" && ec && SessionProvider && renderSlot && echartsChatSlot && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionProvider, { session: ec.reference, children: renderSlot(echartsChatSlot, {}) })
    ] })
  ] });
}

// src/client/EChartsPanel.jsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");

// src/client/NativeConversation.jsx
function StockChat({ renderSlot }) {
  return renderSlot("conversation.session", { view: "chat" });
}
function NativeConversation({ sessionId, useSession, useConversation, useSessions, renderFactorySlot }) {
  const session = useSession((s) => s);
  const conversation = useConversation((s) => s);
  const knownBlank = useSessions((store) => store.byId[sessionId]?.blank);
  const engaged = conversation.activeTargets.size > 0 || !session.blank && !session.awaitingFirstTurn || session.running;
  const opening = !engaged && session.openState === "loading" && knownBlank !== true;
  const idle = !engaged && (session.openState === "open" || knownBlank === true);
  const phase = opening ? "settling" : idle ? "hero" : "active";
  return renderFactorySlot("conversation.content", { variant: "embedded", phase, hero: idle }, { slots: { views: StockChat } });
}

// src/client/native-chat.js
function nativeChatBridge(ctx) {
  let services;
  const listeners = /* @__PURE__ */ new Set();
  ctx.inject(["sessions", "uiSession", "uiWorkspace"], (scope) => {
    services = scope;
    for (const notify of listeners) notify();
    return () => {
      services = void 0;
      for (const notify of listeners) notify();
    };
  });
  const workspaceItems = () => services?.uiWorkspace.workspaces.list.getSnapshot().items ?? [];
  return {
    defaultChatWorkspace() {
      const items = workspaceItems();
      const match = items.find((w) => w.title === "default-workspace" || /(?:^|\/)default-workspace$/.test(w.path || ""));
      return (match ?? items[0])?.workspaceId;
    },
    watchChatWorkspaces(listener) {
      listeners.add(listener);
      const stop = services?.uiWorkspace.workspaces.list.subscribe(listener) ?? (() => {
      });
      return () => {
        listeners.delete(listener);
        stop();
      };
    },
    chatWorkspaces() {
      return workspaceItems().map((w) => ({ id: w.workspaceId, name: w.title || w.name || w.path, path: w.path }));
    },
    async openChat({ workspaceId, sessionId }) {
      if (!services) throw new Error("Harness \u5BF9\u8BDD\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA,\u8BF7\u7A0D\u540E\u91CD\u8BD5");
      if (!workspaceId || !workspaceItems().some((w) => w.workspaceId === workspaceId)) {
        throw new Error("\u8BF7\u5148\u5728 Harness \u4E2D\u6253\u5F00\u4E00\u4E2A\u5DE5\u4F5C\u533A");
      }
      const id = sessionId ?? await services.sessions.create({ workspaceId });
      const reference = services.sessions.retain(id, { source: "monitor-bi" });
      return { sessionId: id, reference, release: () => reference.release() };
    }
  };
}

// src/client/index.jsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var PLUGIN_ID = "monitor-bi-dsh";
var PANEL_ID = "monitor-bi";
var ECHARTS_PANEL_ID = "monitor-bi-echarts";
var CHAT_SLOT = "monitor-bi.chat";
var passthroughCodec = () => ({
  mode: "strict",
  typeSymbol: `${PLUGIN_ID}#json`,
  create: () => ({ parse: (v) => v, safeParse: (v) => ({ success: true, data: v }) })
});
function descriptor(name, hasParams = true) {
  return {
    id: `${PLUGIN_ID}#monitorbi/${name}`,
    service: "monitorbi",
    namespace: "monitorbi",
    method: name,
    invocation: { kind: "direct" },
    ...hasParams ? { parameters: [{ name: "request", wire: "request", source: "json", codec: passthroughCodec() }] } : { parameters: [] },
    result: { mode: "src-json" },
    cancellation: { parameter: "signal" }
  };
}
var REMOTE_SURFACE = {
  package: PLUGIN_ID,
  descriptors: [descriptor("setBiContext"), descriptor("setEchartsContext"), descriptor("getGuide", false), descriptor("checkUpdate", false), descriptor("performUpdate", false)]
};
var inject = ["slots", "layout", "remote"];
async function apply(ctx) {
  await ctx.remote.$mount(REMOTE_SURFACE);
  ctx.inject(["remote.monitorbi"], (child) => mountRoom(child));
}
function mountRoom(ctx) {
  const call = async (name, params) => {
    const svc = ctx.remote.monitorbi;
    if (!svc || typeof svc[name] !== "function") throw new Error("Monitor BI \u670D\u52A1\u672A\u5C31\u7EEA,\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    const outcome = await svc[name](params);
    if (outcome.ok) return outcome.value;
    throw outcome.error;
  };
  const api = {
    ...nativeChatBridge(ctx),
    setBiContext: (params) => call("setBiContext", params),
    setEchartsContext: (params) => call("setEchartsContext", params),
    checkUpdate: () => call("checkUpdate"),
    performUpdate: () => call("performUpdate")
  };
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: PANEL_ID,
    children: { [CHAT_SLOT]: { kind: "single", scope: "session" } },
    inject: () => ({ api })
  }, (props) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BiPanel, { ...props, biChatSlot: "monitor-bi.chat", echartsChatSlot: "echarts.chat" })));
  ctx.slots.inject(CHAT_SLOT, () => ctx.slots.register({ name: CHAT_SLOT }, NativeConversation));
  ctx.slots.inject("echarts.chat", () => ctx.slots.register({ name: "echarts.chat" }, NativeConversation));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 20,
    label: "Monitor BI"
  }, BiSidebarIcon));
}
function EChartsSidebarIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { viewBox: "0 0 24 24", width: "22", height: "22", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M3 17l5-6 4 3 6-8" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4 21h2" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M10 21h2" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M16 21h2" })
  ] });
}
function BiSidebarIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { viewBox: "0 0 24 24", width: "22", height: "22", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4 20h16" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M7 20v-6" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M12 20V8" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M17 20V12" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M14 6l3.2-2.4" })
  ] });
}
		return module.exports;
	}
});
