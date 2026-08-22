export async function slackWebhookSend(
  webhookUrl: string,
  text: string,
): Promise<{ ok: boolean; err?: string }> {
  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return { ok: false, err: `HTTP ${r.status}` };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, err: String((e as Error)?.message ?? e) };
  }
}
