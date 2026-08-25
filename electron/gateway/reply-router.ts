/** Short inbound messages that should not spawn a full harness agent loop. */
// @ts-nocheck

export function isLightInboundMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^(hi|hello|hey|ping|status|test|ok|thanks|danke|servus|moin)\b/i.test(t)) return true;
  if (
    t.length <= 72 &&
    !/\b(code|fix|refactor|file|mt5|trade|deploy|audit|benchmark|harness|swarm|parallel)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

export const LIGHT_REPLY_SYSTEM =
  'You are JARVIS. Reply in 1-2 short sentences. No tools, no bullet lists, no markdown headers.';
