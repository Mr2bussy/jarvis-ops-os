import re

path = r"C:\Users\Administrator\Desktop\master jarvis app project oggg\electron\main.ts"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find old block boundaries
old_start_marker = "let client: Anthropic | null = null;"
old_end_marker = "ipcMain.handle('jarvis:has-key', () => Boolean(getDecryptedKey('ANTHROPIC_API_KEY')));"

s = content.index(old_start_marker)
e = content.index(old_end_marker) + len(old_end_marker)

print(f"Block found: bytes {s} to {e}, length {e-s}")
print("Old block preview:", content[s:s+80])

new_block = """let client: Anthropic | null = null;
function getModel(): string { return getDecryptedKey('JARVIS_MODEL') || process.env.JARVIS_MODEL || 'claude-haiku-4-5'; }
function getClient(): Anthropic {
  const key = getDecryptedKey('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not set. Open Admin > Models to configure.');
  if (!client) client = new Anthropic({ apiKey: key });
  return client;
}

// Multi-provider routing ───────────────────────────────────────────────────
function detectProvider(model: string): 'anthropic' | 'openai' | 'google' | 'mistral' | 'deepseek' | 'ollama' {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gemini')) return 'google';
  if (model.startsWith('codestral') || (model.startsWith('mistral') && !getDecryptedKey('OLLAMA_BASE_URL'))) return 'mistral';
  if (model.startsWith('deepseek') && !getDecryptedKey('OLLAMA_BASE_URL')) return 'deepseek';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4') || model.startsWith('chatgpt')) return 'openai';
  if (getDecryptedKey('OLLAMA_BASE_URL') || model.startsWith('llama') || model.startsWith('phi') || model.startsWith('qwen')) return 'ollama';
  return 'anthropic';
}

async function routedComplete(payload: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  system?: string; maxTokens?: number;
}): Promise<string> {
  const model = getModel();
  const provider = detectProvider(model);
  const msgs = compressMsgs(payload.messages) as any[];
  const sys = payload.system ? compressSystem(payload.system) : undefined;
  const maxTok = payload.maxTokens ?? 512;

  if (provider === 'anthropic') {
    const c = getClient();
    const res = await c.messages.create({ model, max_tokens: maxTok, system: sys, messages: msgs });
    return res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\\n');
  }

  if (provider === 'openai') {
    const apiKey = getDecryptedKey('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not set. Open Admin > Models to configure.');
    const baseUrl = getDecryptedKey('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    const msgs2 = sys ? [{ role: 'system', content: sys }, ...msgs] : msgs;
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTok, messages: msgs2 }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content ?? '';
  }

  if (provider === 'mistral') {
    const apiKey = getDecryptedKey('MISTRAL_API_KEY');
    if (!apiKey) throw new Error('MISTRAL_API_KEY not set. Open Admin > Models to configure.');
    const baseUrl = getDecryptedKey('MISTRAL_BASE_URL') || 'https://api.mistral.ai/v1';
    const msgs2 = sys ? [{ role: 'system', content: sys }, ...msgs] : msgs;
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTok, messages: msgs2 }),
    });
    if (!res.ok) throw new Error(`Mistral ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content ?? '';
  }

  if (provider === 'deepseek') {
    const apiKey = getDecryptedKey('DEEPSEEK_API_KEY');
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set. Open Admin > Models to configure.');
    const baseUrl = getDecryptedKey('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
    const msgs2 = sys ? [{ role: 'system', content: sys }, ...msgs] : msgs;
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTok, messages: msgs2 }),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content ?? '';
  }

  if (provider === 'ollama') {
    const baseUrl = getDecryptedKey('OLLAMA_BASE_URL') || 'http://localhost:11434';
    const msgs2 = sys ? [{ role: 'system', content: sys }, ...msgs] : msgs;
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, messages: msgs2 }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json() as any;
    return data.message?.content ?? '';
  }

  // fallback
  const c = getClient();
  const res = await c.messages.create({ model: 'claude-haiku-4-5', max_tokens: maxTok, system: sys, messages: msgs });
  return res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\\n');
}

ipcMain.handle('jarvis:complete', async (_evt, payload: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  system?: string; maxTokens?: number;
}) => {
  const model = getModel();
  const provider = detectProvider(model);
  pushActivity(provider.toUpperCase(), 'RESPOND', payload.messages[payload.messages.length - 1]?.content?.slice(0, 60) || '');
  return routedComplete(payload);
});
ipcMain.handle('jarvis:has-key', () =>
  Boolean(getDecryptedKey('ANTHROPIC_API_KEY') || getDecryptedKey('OPENAI_API_KEY') ||
          getDecryptedKey('GEMINI_API_KEY')     || getDecryptedKey('DEEPSEEK_API_KEY')));"""

new_content = content[:s] + new_block + content[e:]
print(f"New file size: {len(new_content)} (was {len(content)})")

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done!")
