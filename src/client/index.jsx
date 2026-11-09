/**
 * monitor-bi client half.
 * 1) Mounts the `monitorbi` Remote namespace so the browser can call the host service.
 * 2) Registers the left-navigation entry ("Monitor BI") and the room page: a slim
 *    header plus Harness's own native conversation bound to a BI-only session.
 */
import { useEffect, useRef, useState } from 'react';
import { BiPanel } from './BiPanel.jsx';
import { EChartsPanel } from './EChartsPanel.jsx';
import { NativeConversation } from './NativeConversation.jsx';
import { nativeChatBridge } from './native-chat.js';

const PLUGIN_ID = 'monitor-bi-dsh';
export const PANEL_ID = 'monitor-bi';
export const ECHARTS_PANEL_ID = 'monitor-bi-echarts';
const CHAT_SLOT = 'monitor-bi.chat';
const ECHARTS_CHAT_SLOT = 'echarts.chat';

/** Minimal JSON pass-through codec: the client forwards payloads verbatim. */
const passthroughCodec = () => ({
  mode: 'strict',
  typeSymbol: `${PLUGIN_ID}#json`,
  create: () => ({ parse: (v) => v, safeParse: (v) => ({ success: true, data: v }) }),
});

/** One Remote descriptor pointing at a host method of the monitorbi service. */
function descriptor(name, hasParams = true) {
  return {
    id: `${PLUGIN_ID}#monitorbi/${name}`,
    service: 'monitorbi',
    namespace: 'monitorbi',
    method: name,
    invocation: { kind: 'direct' },
    ...(hasParams
      ? { parameters: [{ name: 'request', wire: 'request', source: 'json', codec: passthroughCodec() }] }
      : { parameters: [] }),
    result: { mode: 'src-json' },
  };
}

const REMOTE_SURFACE = {
  package: PLUGIN_ID,
  descriptors: [descriptor('setBiContext'), descriptor('setEchartsContext'), descriptor('checkUpdate', false), descriptor('performUpdate', false)],
};

export const inject = ['slots', 'layout', 'remote'];

export async function apply(ctx) {
  await ctx.remote.$mount(REMOTE_SURFACE);
  // Mounting publishes the namespace; consume it in a child fiber once available.
  ctx.inject(['remote.monitorbi'], (child) => mountRoom(child));
}

function mountRoom(ctx) {
  const call = async (name, params) => {
    const svc = ctx.remote.monitorbi;
    if (!svc || typeof svc[name] !== 'function') throw new Error('Monitor BI 服务未就绪,请稍后重试');
    const outcome = await svc[name](params);
    if (outcome.ok) return outcome.value;
    throw outcome.error;
  };
  // 所有 remote 调用包 try/catch:出错不冻结界面、错误可诊断(transfer-dsh 1.4.2/1.4.3 教训)
  const safeCall = (name, fn) => async (...args) => {
    try { return await fn(...args); }
    catch (e) { console.error(`[monitor-bi-dsh] ${name} 失败:`, e); throw e; }
  };
  const api = {
    ...nativeChatBridge(ctx),
    setBiContext: safeCall('setBiContext', (params) => call('setBiContext', params)),
    setEchartsContext: safeCall('setEchartsContext', (params) => call('setEchartsContext', params)),
    checkUpdate: safeCall('checkUpdate', () => call('checkUpdate')),
    performUpdate: safeCall('performUpdate', () => call('performUpdate')),
  };

  // Main room page (owns one BI session) + its native-conversation child slot.
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    children: { [CHAT_SLOT]: { kind: 'single', scope: 'session' }, [ECHARTS_CHAT_SLOT]: { kind: 'single', scope: 'session' } },
    inject: () => ({ api }),
  }, (props) => <BiPanel {...props} biChatSlot={CHAT_SLOT} echartsChatSlot={ECHARTS_CHAT_SLOT} />));
  ctx.slots.inject(CHAT_SLOT, () => ctx.slots.register({ name: CHAT_SLOT }, NativeConversation));
  ctx.slots.inject('echarts.chat', () => ctx.slots.register({ name: 'echarts.chat' }, NativeConversation));

  // Left navigation entry (single — dual modes live inside the room header).
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 20,
    label: 'Monitor BI',
  }, BiSidebarIcon));
}

/** Chart glyph for the ECharts navigation entry. */
export function EChartsSidebarIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M3 17l5-6 4 3 6-8" />
    <path d="M4 21h2" /><path d="M10 21h2" /><path d="M16 21h2" />
  </svg>;
}

/** Bar-chart glyph shown in the left navigation. */
export function BiSidebarIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M4 20h16" />
    <path d="M7 20v-6" />
    <path d="M12 20V8" />
    <path d="M17 20V12" />
    <path d="M14 6l3.2-2.4" />
  </svg>;
}
