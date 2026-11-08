/**
 * Monitor BI 工作室面板:一个入口,头栏两个模式切换。
 *   「BI 看板」= DevExpress 产线(留在 BI 界面)
 *   「ECharts」 = 独立 HTML 漂亮版产线
 * 两个模式各自绑定独立会话与提示词,上下文互不混淆。
 */
import { useEffect, useRef, useState } from 'react';

const BI_STORE = 'monitorbi.chat.session';
const EC_STORE = 'monitorbi.echarts.session';

export function BiPanel({ api, SessionProvider, renderSlot, biChatSlot, echartsChatSlot }) {
  const [mode, setMode] = useState('bi'); // 'bi' | 'echarts'
  const [updateInfo, setUpdateInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [updState, setUpdState] = useState('idle');
  const [updMsg, setUpdMsg] = useState('');
  const hoverStyle = '.mbi-upd:hover .mbi-pop{display:block} .mbi-pop{display:none;position:absolute;top:calc(100% + 6px);right:0;width:400px;max-width:calc(100vw - 48px);z-index:99;background:#fff3cd;border:1px solid #ffe69c;border-radius:10px;padding:14px 18px;box-shadow:0 8px 24px rgba(15,23,42,.18);font-size:12px;line-height:1.7;color:#1f2d3d;max-height:300px;overflow-y:auto;white-space:pre-wrap}';
  const notes = (updateInfo?.releaseNotes || '').trim();

  useEffect(() => {
    if (!api?.checkUpdate) return;
    api.checkUpdate().then(r => { if (r && r.updateAvailable) setUpdateInfo(r); }).catch(() => {});
  }, []);

  async function runUpdate() {
    setUpdState('doing');
    try {
      const r = await api.performUpdate();
      if (r && r.ok) { setUpdState('done'); if (r.message) setUpdMsg(r.message); }
      else { setUpdState('fail'); setUpdMsg((r && r.error) || '未知错误'); }
    } catch (e) { setUpdState('fail'); setUpdMsg(String(e && e.message || e)); }
  }

  function copyUpdateCmd() {
    if (updateInfo?.updateCommand) {
      navigator.clipboard?.writeText(updateInfo.updateCommand).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
    }
  }
  const [bi, setBi] = useState(null);
  const [ec, setEc] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ownedBi = useRef(null);
  const ownedEc = useRef(null);

  async function openRoom(kind) {
    const workspaceId = api.defaultChatWorkspace?.();
    if (!workspaceId) throw new Error('尚未找到可用工作区,请先在 Harness 中打开一个工作区');
    const store = kind === 'bi' ? BI_STORE : EC_STORE;
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(store) : null;
    let acquired;
    try {
      acquired = await api.openChat({ workspaceId, sessionId: saved || undefined });
    } catch (cause) {
      if (!saved) throw cause;
      if (typeof localStorage !== 'undefined') localStorage.removeItem(store);
      acquired = await api.openChat({ workspaceId });
    }
    if (kind === 'bi') await api.setBiContext({ sessionId: acquired.sessionId }).catch(() => {});
    else await api.setEchartsContext({ sessionId: acquired.sessionId }).catch(() => {});
    return acquired;
  }

  function keep(kind, acquired) {
    if (kind === 'bi') { ownedBi.current?.release(); ownedBi.current = acquired; }
    else { ownedEc.current?.release(); ownedEc.current = acquired; }
    if (typeof localStorage !== 'undefined') localStorage.setItem(kind === 'bi' ? BI_STORE : EC_STORE, acquired.sessionId);
  }

  function activate(kind) {
    setBusy(true);
    (async () => {
      try {
        // 已有活着的会话直接切
        if (kind === 'bi' && ownedBi.current) { setBi(ownedBi.current); setBusy(false); return; }
        if (kind === 'echarts' && ownedEc.current) { setEc(ownedEc.current); setBusy(false); return; }
        const acquired = await openRoom(kind);
        keep(kind, acquired);
        if (kind === 'bi') setBi(acquired); else setEc(acquired);
      } catch (cause) { setError(cause?.message ?? String(cause)); } finally { setBusy(false); }
    })();
  }

  // 首次进入:打开 BI 房间(默认模式)
  useEffect(() => { activate('bi'); }, []);

  const pill = (active) => ({
    padding: '3px 14px', fontSize: 12, borderRadius: 999, cursor: 'pointer', fontWeight: 600,
    border: '1px solid ' + (active ? '#4d6bfe' : '#dfe4ea'),
    background: active ? '#4d6bfe' : '#fff', color: active ? '#fff' : '#1f2d3d',
  });
  const shell = { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 };
  const header = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--dsw-alias-separator-solid, rgba(128,128,128,.25))', fontSize: 13 };
  const body = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' };

  return <div style={shell} aria-label="Monitor BI 工作室">
    {updateInfo && updateInfo.updateAvailable && <div className="mbi-upd" style={{ position: 'relative' }}><style>{hoverStyle}</style><div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#fff3cd', borderBottom: '1px solid #ffe69c', fontSize: 12 }} role="status">
      <span aria-hidden="true">🔔</span>
      <span>新版本 <strong>v{updateInfo.latest}</strong> 可用（当前 v{updateInfo.current}）</span>
      <span style={{ flex: 1 }} />
      {updState === 'done' ? <strong style={{ color: '#27ae60' }}>✓ {updMsg || '已更新,请重启 DSH 生效'}</strong> :
       updState === 'doing' ? <strong style={{ color: '#8492a6' }}>更新中,请稍候…</strong> :
       updState === 'fail' ? <span style={{ color: '#e74c3c' }}>一键更新失败:{updMsg}(可复制命令兜底)</span> :
       <button type="button" onClick={() => void runUpdate()} style={{
        padding: '4px 16px', fontSize: 12, border: 'none', borderRadius: 999,
        background: '#4d6bfe', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600,
        boxShadow: '0 2px 8px rgba(77,107,254,.4)',
      }} onMouseOver={e => { e.currentTarget.style.background = '#3a56e8'; }} onMouseOut={e => { e.currentTarget.style.background = '#4d6bfe'; }}>⬇ 更新</button>}
      {updState === 'fail' && <button type="button" onClick={copyUpdateCmd} style={{
        padding: '3px 12px', fontSize: 11, border: '1px solid #4d6bfe', borderRadius: 999,
        background: copied ? '#d4edda' : '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
      }}>{copied ? '✓ 已复制' : '复制命令兜底'}</button>}
      {notes && <div className="mbi-pop" role="tooltip"><strong>v{updateInfo.latest} 更新内容:</strong>{String.fromCharCode(10, 10)}{notes}</div>}
    </div></div>}
    <header style={header}>
      <span aria-hidden="true">📊</span>
      <strong>Monitor BI 工作室</strong>
      <span style={{ opacity: 0.45, fontSize: 11 }}>v{__APP_VERSION__}</span>
      <span style={pill(mode === 'bi')} onClick={() => setMode('bi')}>BI 看板</span>
      <span style={pill(mode === 'echarts')} onClick={() => setMode('echarts')}>ECharts 漂亮版</span>
      <span style={{ opacity: 0.55, fontSize: 11 }}>两种产出,上下文分开</span>
      <span style={{ flex: 1 }} />
      <button type="button" onClick={() => activate(mode === 'bi' ? 'bi' : 'echarts')} disabled={busy} title="当前模式开一个新对话">新对话</button>
    </header>
    <div style={body}>
      {error && <div role="alert" style={{ padding: 24 }}>
        <strong>未能打开</strong><p style={{ whiteSpace: 'pre-wrap' }}>{error}</p>
        <button type="button" onClick={() => activate(mode)}>重试</button>
      </div>}
      {!error && busy && !(mode === 'bi' ? bi : ec) && <div role="status" style={{ padding: 24, opacity: 0.7 }}>正在打开{(mode === 'bi' ? ' BI 看板' : ' ECharts')}会话…</div>}
      {mode === 'bi' && bi && SessionProvider && renderSlot && biChatSlot &&
        <SessionProvider session={bi.reference}>{renderSlot(biChatSlot, {})}</SessionProvider>}
      {mode === 'echarts' && ec && SessionProvider && renderSlot && echartsChatSlot &&
        <SessionProvider session={ec.reference}>{renderSlot(echartsChatSlot, {})}</SessionProvider>}
    </div>
  </div>;
}
