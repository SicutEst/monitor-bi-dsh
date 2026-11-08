/**
 * The ECharts room: same native-conversation pattern as BiPanel, but the
 * session prompt is the ECharts production line (standalone HTML output).
 */
import { useEffect, useRef, useState } from 'react';

const STORE_KEY = 'echarts.chat.session';

export function EChartsPanel({ api, SessionProvider, renderSlot }) {
  const [confirmed, setConfirmed] = useState(typeof localStorage !== 'undefined' && localStorage.getItem(CONFIRM_KEY) === '1');
  const [chat, setChat] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const owned = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (!confirmed || started.current) return;
    started.current = true;
    let current = true;
    (async () => {
      try {
        const workspaceId = api.defaultChatWorkspace?.();
        if (!workspaceId) throw new Error('尚未找到可用工作区,请先在 Harness 中打开一个工作区');
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
        let acquired;
        try {
          acquired = await api.openChat({ workspaceId, sessionId: saved || undefined });
        } catch (cause) {
          if (!saved) throw cause;
          if (typeof localStorage !== 'undefined') localStorage.removeItem(STORE_KEY);
          acquired = await api.openChat({ workspaceId });
        }
        await api.setEchartsContext({ sessionId: acquired.sessionId }).catch(() => {});
        if (!current) { acquired.release(); return; }
        owned.current?.release();
        owned.current = acquired;
        if (typeof localStorage !== 'undefined') localStorage.setItem(STORE_KEY, acquired.sessionId);
        setChat(acquired);
      } catch (cause) {
        if (current) setError(cause?.message ?? String(cause));
      } finally { if (current) setBusy(false); }
    })();
    return () => { current = false; owned.current?.release(); owned.current = null; };
  }, []);

  function confirmDisclaimer() {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CONFIRM_KEY, '1');
    setConfirmed(true);
  }

  async function newSession() {
    setError(''); setBusy(true);
    try {
      const workspaceId = api.defaultChatWorkspace?.();
      if (!workspaceId) throw new Error('尚未找到可用工作区');
      const acquired = await api.openChat({ workspaceId });
      await api.setEchartsContext({ sessionId: acquired.sessionId }).catch(() => {});
      owned.current?.release();
      owned.current = acquired;
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORE_KEY, acquired.sessionId);
      setChat(acquired);
    } catch (cause) { setError(cause?.message ?? String(cause)); } finally { setBusy(false); }
  }

  const shell = { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 };
  const header = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--dsw-alias-separator-solid, rgba(128,128,128,.25))', fontSize: 13 };
  const body = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' };

  return <div style={shell} aria-label="ECharts 图表房间">
    <header style={header}>
      <span aria-hidden="true">📈</span>
      <strong>ECharts 图表房间</strong>
      <span style={{ opacity: 0.6 }}>产出独立 HTML 漂亮版报表</span>
      <span style={{ flex: 1 }} />
      <button type="button" onClick={() => void newSession()} disabled={busy} title="开一个全新的 ECharts 对话">新对话</button>
    </header>
    {confirmed === false && !chat && <div style={{ padding: '32px 40px', maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, marginBottom: 14 }}>📈 ECharts 图表房间</h2>
      <p style={{ fontSize: 13, lineHeight: 2, color: '#1f2d3d' }}>
        本房间产出的报表 <b>使用 Monitor BI 的 PostgreSQL 数据</b>(与 BI 看板同源),但由 ECharts <b>自行生成为一个独立的网页文件</b>:
      </p>
      <ul style={{ fontSize: 13, lineHeight: 2.2, color: '#4a5568', paddingLeft: 20 }}>
        <li><b>不在标准 Monitor BI 页面里</b>——BI 的报表列表中看不到它,也不能在 BI 里编辑</li>
        <li>形式为<b>独立网页文件</b>(双击即可打开、可发微信/U盘)或<b>内网端口页面</b>(需一台常开的机器提供端口)</li>
        <li>数据为<b>生成时刻的快照</b>;可设置<b>刷新频率</b>(生成后页面右下角 ⚙,可选 15/30/60 分钟或手动输入)</li>
      </ul>
      <button type="button" onClick={confirmDisclaimer} style={{
        marginTop: 18, padding: '8px 28px', fontSize: 13, fontWeight: 600,
        border: 'none', borderRadius: 999, background: '#4d6bfe', color: '#fff', cursor: 'pointer',
      }}>明白了,开始</button>
    </div>}
    {confirmed && <div style={body}>
      {error && <div role="alert" style={{ padding: 24 }}>
        <strong>ECharts 房间未能打开</strong>
        <p style={{ whiteSpace: 'pre-wrap' }}>{error}</p>
        <button type="button" onClick={() => { started.current = false; setError(''); setBusy(true); setTimeout(() => { started.current = true; }, 0); }}>重试</button>
      </div>}
      {!error && busy && !chat && <div role="status" style={{ padding: 24, opacity: 0.7 }}>正在打开 ECharts 专用对话…</div>}
      {chat && SessionProvider && renderSlot && <SessionProvider session={chat.reference}>
        {renderSlot('echarts.chat', {})}
      </SessionProvider>}
    </div>}
  </div>;
}
