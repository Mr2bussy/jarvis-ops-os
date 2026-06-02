/**
 * One OpenAI-compatible `/chat/completions` call. OpenAI, Mistral and DeepSeek share
 * this exact wire format, so the three near-identical branches in routedComplete
 * collapse to a single call here. Pure given `fetch` → unit-testable with a stub.
 * Throws `"<label> <status>: <body>"` on a non-2xx response.
 */
export async function openAICompatComplete(o: {
  baseUrl: string;
  apiKey: string;
  model: string;
  label: string;
  messages: { role: string; content: string }[];
  system?: string;
  maxTokens: number;
}): Promise<string> {
  const messages = o.system ? [{ role: 'system', content: o.system }, ...o.messages] : o.messages;
  const res = await fetch(`${o.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${o.apiKey}` },
    body: JSON.stringify({ model: o.model, max_tokens: o.maxTokens, messages }),
  });
  if (!res.ok) throw new Error(`${o.label} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? '';
}
