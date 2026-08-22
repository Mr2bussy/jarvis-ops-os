export async function discordSendMessage(
  botToken: string,
  channelId: string,
  content: string,
): Promise<{ ok: boolean; err?: string }> {
  try {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: content.slice(0, 2000) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, err: txt.slice(0, 200) };
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, err: String((e as Error)?.message ?? e) };
  }
}
