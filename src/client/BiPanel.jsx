/**
 * The Monitor BI room: a slim header + Harness's native conversation bound to
 * a BI-only session. On open it creates (or resumes) a session in the default
 * workspace and registers it with the host so only THIS session gets the BI
 * system prompt — every other conversation stays untouched.
 */
import { useEffect, useRef, useState } from 'react';

const STORE_KEY = 'monitorbi.chat.session';

export function BiPanel({ api, SessionProvider, renderSlot }) {
  const [chat, setChat] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [updState, setUpdState] = useState('idle'); // idle|doing|done|fail
  const [updMsg, setUpdMsg] = useState('');
  const owned = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (!api?.checkUpdate) return;
    api.checkUpdate().then(r => { if (r && r.updateAvailable) setUpdateInfo(r); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (started.current) return;
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
        await api.setBiContext({ sessionId: acquired.sessionId }).catch(() => {});
        if (!current) { acquired.release(); return; }
        owned.current?.release();
        owned.current = acquired;
        if (typeof localStorage !== 'undefined') localStorage.setItem(STORE_KEY, acquired.sessionId);
        setChat(acquired);
      } catch (cause) {
        if (current) setError(cause?.message ?? String(cause));
      } finally {
        if (current) setBusy(false);
      }
    })();
    return () => { current = false; owned.current?.release(); owned.current = null; };
  }, []);

  async function newSession() {
    setError('');
    setBusy(true);
    try {
      const workspaceId = api.defaultChatWorkspace?.();
      if (!workspaceId) throw new Error('尚未找到可用工作区');
      const acquired = await api.openChat({ workspaceId });
      await api.setBiContext({ sessionId: acquired.sessionId }).catch(() => {});
      owned.current?.release();
      owned.current = acquired;
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORE_KEY, acquired.sessionId);
      setChat(acquired);
    } catch (cause) {
      setError(cause?.message ?? String(cause));
    } finally { setBusy(false); }
  }

  const shell = { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 };

  const hoverStyle = '.mbi-upd:hover .mbi-pop{display:block} .mbi-pop{display:none;position:absolute;top:calc(100% + 6px);left:0;width:400px;max-width:calc(100vw - 48px);z-index:99;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;box-shadow:0 8px 24px rgba(15,23,42,.18);font-size:12px;line-height:1.7;color:#1f2d3d;max-height:300px;overflow-y:auto;white-space:pre-wrap}';

  const header = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--dsw-alias-separator-solid, rgba(128,128,128,.25))', fontSize: 13 };
  const body = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' };

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
      navigator.clipboard?.writeText(updateInfo.updateCommand).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  }

  const notes = (updateInfo?.releaseNotes || '').trim();
  const updateBanner = updateInfo ? {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
    background: '#fff3cd', borderBottom: '1px solid #ffe69c', fontSize: 12,
  } : null;

  return <div style={shell} aria-label="Monitor BI 工作室">
    {updateBanner && <div className="mbi-upd" style={{ position:'relative' }}><style>{hoverStyle}</style><div style={updateBanner} role="status">
      <span aria-hidden="true">🔔</span>
      <span>新版本 <strong>v{updateInfo.latest}</strong> 可用（当前 v{updateInfo.current}）</span>
      {notes && <span style={{ color: '#7a5c00', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>— {notes}</span>}
      <span style={{ flex: 1 }} />
      {updState === 'done' ? <strong style={{ color: '#27ae60' }}>✓ {updMsg || '已更新,请重启 DSH 生效'}</strong> :
       updState === 'doing' ? <strong style={{ color: '#8492a6' }}>更新中,请稍候…</strong> :
       updState === 'fail' ? <span style={{ color: '#e74c3c' }}>一键更新失败:{updMsg}(可用右侧复制命令兜底)</span> :
       <button type="button" onClick={() => void runUpdate()} style={{
        padding: '5px 20px', fontSize: 12, border: 'none', borderRadius: 999,
        background: '#4d6bfe', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600,
        boxShadow: '0 2px 8px rgba(77,107,254,.4)',
      }} onMouseOver={e => { e.currentTarget.style.background = '#3a56e8'; }} onMouseOut={e => { e.currentTarget.style.background = '#4d6bfe'; }}>⚡ 一键更新</button>}
      {updState === 'fail' && <button type="button" onClick={copyUpdateCmd} style={{
        padding: '4px 16px', fontSize: 11, border: '1px solid #4d6bfe', borderRadius: 999,
        background: copied ? '#d4edda' : '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
      }}>{copied ? '✓ 已复制' : '复制命令兜底'}</button>}
      {notes && <div className="mbi-pop" role="tooltip"><strong>v{updateInfo.latest} 更新内容:</strong>{'\n\n'}{notes}</div>}
    </div></div>}
    <header style={header}>
      <span aria-hidden="true">📊</span>
      <strong>Monitor BI 工作室</strong>
      <span style={{ opacity: 0.45, fontSize: 11 }}>v{__APP_VERSION__}</span>
      <span style={{ opacity: 0.6 }}>本房间只做 BI 报表</span>
      <span style={{ flex: 1 }} />
      <button type="button" onClick={() => void newSession()} disabled={busy} title="开一个全新的 BI 对话">新对话</button>
    </header>
    <div style={body}>
      {error && <div role="alert" style={{ padding: 24 }}>
        <strong>Monitor BI 房间未能打开</strong>
        <p style={{ whiteSpace: 'pre-wrap' }}>{error}</p>
        <button type="button" onClick={() => { started.current = false; setError(''); setBusy(true); setTimeout(() => { started.current = true; }, 0); }}>重试</button>
      </div>}
      {!error && busy && !chat && <div role="status" style={{ padding: 24, opacity: 0.7 }}>正在打开 BI 专用对话…</div>}
      {chat && SessionProvider && renderSlot && <SessionProvider session={chat.reference}>
        {renderSlot('monitor-bi.chat', {})}
      </SessionProvider>}
    </div>
  </div>;
}
