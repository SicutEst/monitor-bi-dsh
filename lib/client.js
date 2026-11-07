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
  PANEL_ID: () => PANEL_ID,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");

// src/client/BiPanel.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var STORE_KEY = "monitorbi.chat.session";
function BiPanel({ api, SessionProvider, renderSlot }) {
  const [chat, setChat] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(true);
  const [updateInfo, setUpdateInfo] = (0, import_react.useState)(null);
  const [copied, setCopied] = (0, import_react.useState)(false);
  const [updState, setUpdState] = (0, import_react.useState)("idle");
  const [updMsg, setUpdMsg] = (0, import_react.useState)("");
  const owned = (0, import_react.useRef)(null);
  const started = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    if (!api?.checkUpdate) return;
    api.checkUpdate().then((r) => {
      if (r && r.updateAvailable) setUpdateInfo(r);
    }).catch(() => {
    });
  }, []);
  (0, import_react.useEffect)(() => {
    if (started.current) return;
    started.current = true;
    let current = true;
    (async () => {
      try {
        const workspaceId = api.defaultChatWorkspace?.();
        if (!workspaceId) throw new Error("\u5C1A\u672A\u627E\u5230\u53EF\u7528\u5DE5\u4F5C\u533A,\u8BF7\u5148\u5728 Harness \u4E2D\u6253\u5F00\u4E00\u4E2A\u5DE5\u4F5C\u533A");
        const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORE_KEY) : null;
        let acquired;
        try {
          acquired = await api.openChat({ workspaceId, sessionId: saved || void 0 });
        } catch (cause) {
          if (!saved) throw cause;
          if (typeof localStorage !== "undefined") localStorage.removeItem(STORE_KEY);
          acquired = await api.openChat({ workspaceId });
        }
        await api.setBiContext({ sessionId: acquired.sessionId }).catch(() => {
        });
        if (!current) {
          acquired.release();
          return;
        }
        owned.current?.release();
        owned.current = acquired;
        if (typeof localStorage !== "undefined") localStorage.setItem(STORE_KEY, acquired.sessionId);
        setChat(acquired);
      } catch (cause) {
        if (current) setError(cause?.message ?? String(cause));
      } finally {
        if (current) setBusy(false);
      }
    })();
    return () => {
      current = false;
      owned.current?.release();
      owned.current = null;
    };
  }, []);
  async function newSession() {
    setError("");
    setBusy(true);
    try {
      const workspaceId = api.defaultChatWorkspace?.();
      if (!workspaceId) throw new Error("\u5C1A\u672A\u627E\u5230\u53EF\u7528\u5DE5\u4F5C\u533A");
      const acquired = await api.openChat({ workspaceId });
      await api.setBiContext({ sessionId: acquired.sessionId }).catch(() => {
      });
      owned.current?.release();
      owned.current = acquired;
      if (typeof localStorage !== "undefined") localStorage.setItem(STORE_KEY, acquired.sessionId);
      setChat(acquired);
    } catch (cause) {
      setError(cause?.message ?? String(cause));
    } finally {
      setBusy(false);
    }
  }
  const shell = { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 };
  const hoverStyle = ".mbi-upd:hover .mbi-pop{display:block} .mbi-pop{display:none;position:absolute;top:calc(100% + 6px);right:0;width:380px;max-width:calc(100vw - 48px);z-index:99;background:#fff3cd;border:1px solid #ffe69c;border-radius:10px;padding:14px 18px;box-shadow:0 8px 24px rgba(15,23,42,.18);font-size:12px;line-height:1.7;color:#1f2d3d;max-height:300px;overflow-y:auto;white-space:pre-wrap}";
  const header = { display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: "1px solid var(--dsw-alias-separator-solid, rgba(128,128,128,.25))", fontSize: 13 };
  const body = { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" };
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
  const notes = (updateInfo?.releaseNotes || "").trim();
  const updateBanner = updateInfo ? {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    background: "#fff3cd",
    borderBottom: "1px solid #ffe69c",
    fontSize: 12
  } : null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: shell, "aria-label": "Monitor BI \u5DE5\u4F5C\u5BA4", children: [
    updateBanner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "mbi-upd", style: { position: "relative" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: hoverStyle }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: updateBanner, role: "status", children: [
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
          "(\u53EF\u7528\u53F3\u4FA7\u590D\u5236\u547D\u4EE4\u515C\u5E95)"
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => void runUpdate(), style: {
          padding: "4px 16px",
          fontSize: 11,
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
          padding: "4px 16px",
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
          "\n\n",
          notes
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { style: header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: "\u{1F4CA}" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Monitor BI \u5DE5\u4F5C\u5BA4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { opacity: 0.45, fontSize: 11 }, children: [
        "v",
        "0.7.1"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { opacity: 0.6 }, children: "\u672C\u623F\u95F4\u53EA\u505A BI \u62A5\u8868" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => void newSession(), disabled: busy, title: "\u5F00\u4E00\u4E2A\u5168\u65B0\u7684 BI \u5BF9\u8BDD", style: {
        padding: "4px 16px",
        fontSize: 12,
        border: "none",
        borderRadius: 999,
        background: "#4d6bfe",
        color: "#fff",
        cursor: busy ? "wait" : "pointer",
        whiteSpace: "nowrap",
        fontWeight: 600,
        boxShadow: "0 2px 8px rgba(77,107,254,.35)"
      }, onMouseOver: (e) => {
        if (!busy) e.currentTarget.style.background = "#3a56e8";
      }, onMouseOut: (e) => {
        e.currentTarget.style.background = "#4d6bfe";
      }, children: "\u65B0\u5BF9\u8BDD" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: body, children: [
      error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { role: "alert", style: { padding: 24 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Monitor BI \u623F\u95F4\u672A\u80FD\u6253\u5F00" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { whiteSpace: "pre-wrap" }, children: error }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => {
          started.current = false;
          setError("");
          setBusy(true);
          setTimeout(() => {
            started.current = true;
          }, 0);
        }, children: "\u91CD\u8BD5" })
      ] }),
      !error && busy && !chat && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "status", style: { padding: 24, opacity: 0.7 }, children: "\u6B63\u5728\u6253\u5F00 BI \u4E13\u7528\u5BF9\u8BDD\u2026" }),
      chat && SessionProvider && renderSlot && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionProvider, { session: chat.reference, children: renderSlot("monitor-bi.chat", {}) })
    ] })
  ] });
}

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
var import_jsx_runtime2 = require("react/jsx-runtime");
var PLUGIN_ID = "monitor-bi-dsh";
var PANEL_ID = "monitor-bi";
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
  descriptors: [descriptor("setBiContext"), descriptor("getGuide", false), descriptor("checkUpdate", false), descriptor("performUpdate", false)]
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
    checkUpdate: () => call("checkUpdate"),
    performUpdate: () => call("performUpdate")
  };
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: PANEL_ID,
    children: { [CHAT_SLOT]: { kind: "single", scope: "session" } },
    inject: () => ({ api })
  }, BiPanel));
  ctx.slots.inject(CHAT_SLOT, () => ctx.slots.register({ name: CHAT_SLOT }, NativeConversation));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 20,
    label: "Monitor BI"
  }, BiSidebarIcon));
}
function BiSidebarIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { viewBox: "0 0 24 24", width: "22", height: "22", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M4 20h16" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M7 20v-6" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M12 20V8" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M17 20V12" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M14 6l3.2-2.4" })
  ] });
}
		return module.exports;
	}
});
