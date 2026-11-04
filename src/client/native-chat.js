/**
 * Bridge from the panel to Harness's own session / workspace services:
 * creates (or re-attaches to) a native session and hands back a retain
 * reference so the embedded conversation stays alive while the panel is open.
 */
export function nativeChatBridge(ctx) {
  let services;
  const listeners = new Set();
  ctx.inject(['sessions', 'uiSession', 'uiWorkspace'], (scope) => {
    services = scope;
    for (const notify of listeners) notify();
    return () => { services = undefined; for (const notify of listeners) notify(); };
  });

  const workspaceItems = () => services?.uiWorkspace.workspaces.list.getSnapshot().items ?? [];

  return {
    defaultChatWorkspace() {
      const items = workspaceItems();
      const match = items.find((w) => w.title === 'default-workspace' || /(?:^|\/)default-workspace$/.test(w.path || ''));
      return (match ?? items[0])?.workspaceId;
    },
    watchChatWorkspaces(listener) {
      listeners.add(listener);
      const stop = services?.uiWorkspace.workspaces.list.subscribe(listener) ?? (() => {});
      return () => { listeners.delete(listener); stop(); };
    },
    chatWorkspaces() {
      return workspaceItems().map((w) => ({ id: w.workspaceId, name: w.title || w.name || w.path, path: w.path }));
    },
    async openChat({ workspaceId, sessionId }) {
      if (!services) throw new Error('Harness 对话服务尚未就绪,请稍后重试');
      if (!workspaceId || !workspaceItems().some((w) => w.workspaceId === workspaceId)) {
        throw new Error('请先在 Harness 中打开一个工作区');
      }
      const id = sessionId ?? await services.sessions.create({ workspaceId });
      const reference = services.sessions.retain(id, { source: 'monitor-bi' });
      return { sessionId: id, reference, release: () => reference.release() };
    },
  };
}
