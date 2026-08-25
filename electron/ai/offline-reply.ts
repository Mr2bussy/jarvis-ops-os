/** Deterministic offline JARVIS reply when all cloud/local LLMs fail. */
// @ts-nocheck

export type OfflineJarvisReply = {
  text: string;
  /** Always true — this path is a degraded fallback, never a live model. */
  degraded: true;
  reason: string;
};

export function offlineJarvisReply(userText: string, failReasons: string[] = []): OfflineJarvisReply {
  if (failReasons.length) {
    const why = failReasons
      .slice(0, 3)
      .map((r) => r.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' · ');
    return {
      text: `Kein LLM erreichbar (${why}). Gemini-Quota prüfen, Ollama starten, oder neuen API-Key in Admin setzen.`,
      degraded: true,
      reason: why || 'all providers failed',
    };
  }
  const t = userText.trim().toLowerCase();
  const reason = 'offline-fallback';
  if (!t) {
    return { text: 'Standing by. Speak a directive.', degraded: true, reason };
  }
  if (/^(hi|hello|hey|moin|servus|hallo)\b/.test(t)) {
    return { text: 'Online. Hermes voice channel ready.', degraded: true, reason };
  }
  if (/ping|status|alive|online/.test(t)) {
    return { text: 'Systems nominal. Voice path is live.', degraded: true, reason };
  }
  if (/telegram|hermes/.test(t)) {
    return { text: 'Hermes Router is armed for Telegram outbound.', degraded: true, reason };
  }
  if (/trade|mt5|zeus|market/.test(t)) {
    return {
      text: 'Trading floor reachable from Bridge. Arm Zeus only after HITL.',
      degraded: true,
      reason,
    };
  }
  if (/hilfe|help|was kannst/.test(t)) {
    return {
      text: 'Ask status, trading, agents, or give a short directive.',
      degraded: true,
      reason,
    };
  }
  return {
    text: `Acknowledged: "${userText.trim().slice(0, 80)}". Cloud LLM quota or offline — local ack only.`,
    degraded: true,
    reason,
  };
}
