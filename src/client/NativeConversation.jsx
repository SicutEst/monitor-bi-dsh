/** Renders Harness's stock conversation surface (composer, model picker, approvals) inside this panel. */
function StockChat({ renderSlot }) {
  return renderSlot('conversation.session', { view: 'chat' });
}

/**
 * The embedded native conversation. Props are injected by the slot system
 * when this component is registered under a `scope: 'session'` child slot.
 */
export function NativeConversation({ sessionId, useSession, useConversation, useSessions, renderFactorySlot }) {
  const session = useSession((s) => s);
  const conversation = useConversation((s) => s);
  const knownBlank = useSessions((store) => store.byId[sessionId]?.blank);
  const engaged = conversation.activeTargets.size > 0 || (!session.blank && !session.awaitingFirstTurn) || session.running;
  const opening = !engaged && session.openState === 'loading' && knownBlank !== true;
  const idle = !engaged && (session.openState === 'open' || knownBlank === true);
  const phase = opening ? 'settling' : idle ? 'hero' : 'active';
  return renderFactorySlot('conversation.content', { variant: 'embedded', phase, hero: idle }, { slots: { views: StockChat } });
}
