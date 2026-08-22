export interface TelegramSendResult {
  ok: boolean;
  err?: string;
}

export async function telegramSendMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<TelegramSendResult> {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096) }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await r.json()) as { ok?: boolean; description?: string };
    return { ok: Boolean(j.ok), err: j.ok ? undefined : (j.description ?? `HTTP ${r.status}`) };
  } catch (e: unknown) {
    return { ok: false, err: String((e as Error)?.message ?? e) };
  }
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    from?: { id: number; username?: string };
  };
}

export async function telegramGetUpdates(
  token: string,
  offset: number,
): Promise<{ ok: boolean; updates: TelegramUpdate[]; err?: string }> {
  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=0&offset=${offset}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const j = (await r.json()) as { ok?: boolean; result?: TelegramUpdate[]; description?: string };
    if (!j.ok) return { ok: false, updates: [], err: j.description };
    return { ok: true, updates: j.result ?? [] };
  } catch (e: unknown) {
    return { ok: false, updates: [], err: String((e as Error)?.message ?? e) };
  }
}
