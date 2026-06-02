import { app, BrowserWindow, ipcMain, shell, dialog, Notification, globalShortcut, session } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { spawn, exec } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import * as cron from 'node-cron';
import { isPathInRoots } from './security/paths';
import {
  validate,
  CompletePayload,
  WriteFilePayload,
  ReadFilePath,
  Mt5Payload,
  ConfigSetKey,
  ComposioExecute,
} from './security/ipc';
import { detectProviderFrom, compressSystem, compressMsgs } from './ai/router';
import { openAICompatComplete } from './ai/providers';
import {
  getDecryptedKey,
  setConfigKey,
  deleteConfigKey,
  hasConfigKey,
  ensureBridgeToken,
  getAdvancedMode,
  setAdvancedMode,
} from './config/store';
import { getSystemMetrics } from './system/metrics';
import {
  hasComposio,
  listCatalog,
  executeAction,
  listConnections,
  groupIntoCategories,
  resetComposioClient,
} from './integrations/composio';

// â”€â”€ Chromium flags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-disk-cache');

// â”€â”€ .env loader (dev only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function loadDotEnv() {
  const envPath = path.resolve(app.getAppPath(), '.env');
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadDotEnv();

// â”€â”€ Safe Storage config (OS-keychain backed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Config store, key encryption, the MT5 bridge token, and the Advanced-Mode flag
// live in ./config/store (imported above) — extracted for testability + smaller main.
ipcMain.handle('config:getAdvancedMode', () => getAdvancedMode());
ipcMain.handle('config:setAdvancedMode', (_e, on: unknown) => {
  setAdvancedMode(Boolean(on));
  return getAdvancedMode();
});

ipcMain.handle('config:setKey', async (_evt, raw: unknown) => {
  const { name, value } = validate(ConfigSetKey, raw);
  setConfigKey(name, value);
  if (name === 'ANTHROPIC_API_KEY') {
    process.env.ANTHROPIC_API_KEY = value;
    client = null;
  }
  if (name === 'COMPOSIO_API_KEY') resetComposioClient();
  if (name === 'GEMINI_API_KEY') process.env.GEMINI_API_KEY = value;
  if (name === 'GITHUB_TOKEN') process.env.GITHUB_TOKEN = value;
  if (name === 'DASHSCOPE_API_KEY') process.env.DASHSCOPE_API_KEY = value;
  if (name === 'JARVIS_MODEL') process.env.JARVIS_MODEL = value;
  return true;
});
ipcMain.handle('config:getKey', async (_evt, name: string) => getDecryptedKey(name));
ipcMain.handle('config:hasKey', async (_evt, name: string) => hasConfigKey(name));
ipcMain.handle('config:deleteKey', async (_evt, name: string) => {
  deleteConfigKey(name);
  return true;
});
ipcMain.handle('config:getMt5', async () => ({
  host: getDecryptedKey('MT5_HOST') || 'localhost',
  port: parseInt(getDecryptedKey('MT5_PORT') || '1234', 10),
}));
ipcMain.handle('config:setMt5', async (_evt, payload: { host: string; port: number }) => {
  // preload sends a { host, port } object; read from it (previously mis-read as
  // positional args, so MT5 host/port never actually saved).
  setConfigKey('MT5_HOST', String(payload?.host ?? 'localhost'));
  setConfigKey('MT5_PORT', String(payload?.port ?? 1234));
  return true;
});
ipcMain.handle('config:reload-keys', () => {
  for (const name of [
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'GITHUB_TOKEN',
    'DASHSCOPE_API_KEY',
    'JARVIS_MODEL',
  ]) {
    const v = getDecryptedKey(name);
    if (v) process.env[name] = v;
  }
  client = null;
  return true;
});

// â”€â”€ Activity Ring Buffer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ActivityEntry {
  ts: number;
  who: string;
  action: string;
  target: string;
}
const activityRing: ActivityEntry[] = [];
function pushActivity(who: string, action: string, target: string) {
  activityRing.push({ ts: Date.now(), who, action, target });
  if (activityRing.length > 200) activityRing.shift();
}
ipcMain.handle('jarvis:recent-activity', () => activityRing.slice(-50).reverse());

// â”€â”€ Composio integrations (live catalog + action execution; needs COMPOSIO_API_KEY) â”€â”€
ipcMain.handle('composio:has', () => hasComposio());
ipcMain.handle('composio:catalog', async () => {
  const apps = await listCatalog();
  pushActivity('COMPOSIO', 'CATALOG', `${apps.length} apps`);
  return { apps, byCategory: groupIntoCategories(apps) };
});
ipcMain.handle('composio:execute', async (_e, raw: unknown) => {
  const p = validate(ComposioExecute, raw);
  pushActivity('COMPOSIO', 'EXEC', p.slug);
  return executeAction(p.slug, {
    arguments: p.arguments,
    userId: p.userId,
    connectedAccountId: p.connectedAccountId,
  });
});
ipcMain.handle('composio:connections', async () => listConnections());

// â”€â”€ Paths & isDev â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
const distIndexFallback = path.join(__dirname, '..', 'dist_new', 'index.html');
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

// â”€â”€ Token Compressor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// estTok / compressSystem / compressMsgs now live in ./ai/router (pure + unit-tested).

// â”€â”€ Anthropic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let client: Anthropic | null = null;
function getModel(): string {
  return getDecryptedKey('JARVIS_MODEL') || process.env.JARVIS_MODEL || 'claude-haiku-4-5';
}
function getClient(): Anthropic {
  const key = getDecryptedKey('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not set. Open Admin > Models to configure.');
  if (!client) client = new Anthropic({ apiKey: key });
  return client;
}

// Multi-provider routing — pure core in ./ai/router; this binds the OLLAMA_BASE_URL config.
function detectProvider(model: string) {
  return detectProviderFrom(model, Boolean(getDecryptedKey('OLLAMA_BASE_URL')));
}

async function routedComplete(payload: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  system?: string;
  maxTokens?: number;
}): Promise<string> {
  const model = getModel();
  const provider = detectProvider(model);
  const msgs = compressMsgs(payload.messages) as any[];
  const sys = payload.system ? compressSystem(payload.system) : undefined;
  const maxTok = payload.maxTokens ?? 512;

  if (provider === 'anthropic') {
    const c = getClient();
    const res = await c.messages.create({ model, max_tokens: maxTok, system: sys, messages: msgs });
    return res.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
  }

  if (provider === 'openai') {
    const apiKey = getDecryptedKey('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not set. Open Admin > Models to configure.');
    return openAICompatComplete({
      baseUrl: getDecryptedKey('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
      apiKey,
      model,
      label: 'OpenAI',
      messages: msgs,
      system: sys,
      maxTokens: maxTok,
    });
  }

  if (provider === 'mistral') {
    const apiKey = getDecryptedKey('MISTRAL_API_KEY');
    if (!apiKey) throw new Error('MISTRAL_API_KEY not set. Open Admin > Models to configure.');
    return openAICompatComplete({
      baseUrl: getDecryptedKey('MISTRAL_BASE_URL') || 'https://api.mistral.ai/v1',
      apiKey,
      model,
      label: 'Mistral',
      messages: msgs,
      system: sys,
      maxTokens: maxTok,
    });
  }

  if (provider === 'deepseek') {
    const apiKey = getDecryptedKey('DEEPSEEK_API_KEY');
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set. Open Admin > Models to configure.');
    return openAICompatComplete({
      baseUrl: getDecryptedKey('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1',
      apiKey,
      model,
      label: 'DeepSeek',
      messages: msgs,
      system: sys,
      maxTokens: maxTok,
    });
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
    const data = (await res.json()) as any;
    return data.message?.content ?? '';
  }

  // fallback
  const c = getClient();
  const res = await c.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTok,
    system: sys,
    messages: msgs,
  });
  return res.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');
}

ipcMain.handle('jarvis:complete', async (_evt, raw: unknown) => {
  const payload = validate(CompletePayload, raw);
  const model = getModel();
  const provider = detectProvider(model);
  pushActivity(
    provider.toUpperCase(),
    'RESPOND',
    payload.messages[payload.messages.length - 1]?.content?.slice(0, 60) || '',
  );
  return routedComplete(payload);
});

// ── Streaming completion ──────────────────────────────────────────────────────
ipcMain.handle(
  'jarvis:complete-stream',
  async (
    _evt,
    payload: {
      messages: { role: 'user' | 'assistant'; content: string }[];
      system?: string;
      maxTokens?: number;
      streamId: string;
    },
  ) => {
    const { streamId, messages, system: sys, maxTokens } = payload;
    const model = getModel();
    const provider = detectProvider(model);
    const msgs = compressMsgs(messages) as any[];
    const sysStr = sys ? compressSystem(sys) : undefined;
    const maxTok = maxTokens ?? 512;
    pushActivity(
      provider.toUpperCase(),
      'STREAM',
      messages[messages.length - 1]?.content?.slice(0, 60) || '',
    );

    if (provider === 'anthropic') {
      const c = getClient();
      let full = '';
      const stream = c.messages.stream({
        model,
        max_tokens: maxTok,
        ...(sysStr ? { system: sysStr } : {}),
        messages: msgs,
      });
      for await (const event of stream as any) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const text = event.delta.text as string;
          full += text;
          mainWin?.webContents.send('stream:chunk', { id: streamId, text });
        }
      }
      await stream.finalMessage();
      mainWin?.webContents.send('stream:done', { id: streamId });
      return full;
    }

    // Non-Anthropic: get full response then emit chunks to simulate streaming
    const full = await routedComplete({ messages, system: sys, maxTokens });
    const CHUNK = 6;
    for (let i = 0; i < full.length; i += CHUNK) {
      mainWin?.webContents.send('stream:chunk', { id: streamId, text: full.slice(i, i + CHUNK) });
      await new Promise((r) => setTimeout(r, 10));
    }
    mainWin?.webContents.send('stream:done', { id: streamId });
    return full;
  },
);

// ── Web Search ────────────────────────────────────────────────────────────────
ipcMain.handle('search:web', async (_evt, { query }: { query: string }) => {
  const braveKey = getDecryptedKey('BRAVE_API_KEY');
  if (braveKey) {
    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`,
        { headers: { Accept: 'application/json', 'X-Subscription-Token': braveKey } },
      );
      if (res.ok) {
        const data = (await res.json()) as any;
        return (data.web?.results || []).slice(0, 5).map((r: any) => ({
          title: r.title as string,
          url: r.url as string,
          snippet: (r.description || '') as string,
        }));
      }
    } catch {
      /* fallback */
    }
  }
  // DuckDuckGo Instant Answers fallback
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { Accept: 'application/json' } },
    );
    if (res.ok) {
      const data = (await res.json()) as any;
      const results: { title: string; url: string; snippet: string }[] = [];
      if (data.AbstractText)
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || '',
          snippet: data.AbstractText as string,
        });
      (data.RelatedTopics || []).slice(0, 4).forEach((t: any) => {
        if (t.Text)
          results.push({
            title: (t.Text as string).slice(0, 60),
            url: t.FirstURL || '',
            snippet: t.Text as string,
          });
      });
      return results;
    }
  } catch {
    /* noop */
  }
  return [];
});
ipcMain.handle('jarvis:has-key', () =>
  Boolean(
    getDecryptedKey('ANTHROPIC_API_KEY') ||
    getDecryptedKey('OPENAI_API_KEY') ||
    getDecryptedKey('GEMINI_API_KEY') ||
    getDecryptedKey('DEEPSEEK_API_KEY'),
  ),
);

// â”€â”€ Gemini IPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle(
  'jarvis:gemini',
  async (
    _evt,
    payload: {
      messages: { role: 'user' | 'model'; text: string }[];
      system?: string;
    },
  ) => {
    const apiKey = getDecryptedKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const msgs = compressMsgs(payload.messages);
    const body: any = { contents: msgs.map((m) => ({ role: m.role, parts: [{ text: m.text }] })) };
    if (payload.system) body.systemInstruction = { parts: [{ text: compressSystem(payload.system) }] };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      const errText = await res.text();
      const m = errText.match(/retryDelay["\s:]+(["|']?)(\d+)s/);
      throw new Error(
        `RATE_LIMIT:${m ? parseInt(m[2], 10) : parseInt(res.headers.get('retry-after') || '60', 10)}:${errText.slice(0, 120)}`,
      );
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    pushActivity(
      'GEMINI',
      'RESPOND',
      payload.messages[payload.messages.length - 1]?.text?.slice(0, 60) || '',
    );
    return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  },
);

ipcMain.handle(
  'jarvis:gemini-audio',
  async (
    _evt,
    payload: {
      audioBase64: string;
      mimeType: string;
      system?: string;
    },
  ) => {
    const apiKey = getDecryptedKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body: any = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'The audio contains a spoken command or question. Respond as JARVIS: tactical, direct, 1-3 sentences max.',
            },
            { inlineData: { mimeType: payload.mimeType, data: payload.audioBase64 } },
          ],
        },
      ],
    };
    if (payload.system) body.systemInstruction = { parts: [{ text: payload.system }] };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      const errText = await res.text();
      const m = errText.match(/retryDelay["\s:]+(["']?)(\d+)s/);
      throw new Error(
        `RATE_LIMIT:${m ? parseInt(m[2], 10) : parseInt(res.headers.get('retry-after') || '60', 10)}:${errText.slice(0, 120)}`,
      );
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  },
);

ipcMain.handle('jarvis:has-gemini', () => Boolean(getDecryptedKey('GEMINI_API_KEY')));

// â”€â”€ GitHub Models IPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle(
  'jarvis:github',
  async (
    _evt,
    payload: {
      messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
      system?: string;
      maxTokens?: number;
    },
  ) => {
    const token = getDecryptedKey('GITHUB_TOKEN');
    if (!token) throw new Error('GITHUB_TOKEN missing');
    const model = process.env.GITHUB_MODEL || 'gpt-4.1-mini';
    const fallbackModel = process.env.GITHUB_FALLBACK_MODEL || 'gpt-4o-mini';
    const url = 'https://models.inference.ai.azure.com/chat/completions';
    const msgs = compressMsgs(payload.messages);
    const finalMsgs: { role: string; content: string }[] = [];
    if (payload.system) finalMsgs.push({ role: 'system', content: compressSystem(payload.system) });
    finalMsgs.push(...msgs);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const mkBody = (m: string) =>
      JSON.stringify({
        model: m,
        messages: finalMsgs,
        max_tokens: payload.maxTokens ?? 256,
        temperature: 0.7,
      });
    let res = await fetch(url, { method: 'POST', headers, body: mkBody(model) });
    if (res.status === 429 && model !== fallbackModel)
      res = await fetch(url, { method: 'POST', headers, body: mkBody(fallbackModel) });
    if (res.status === 429) {
      const errText = await res.text();
      throw new Error(
        `RATE_LIMIT:${parseInt(res.headers.get('retry-after') || '30', 10)}:${errText.slice(0, 120)}`,
      );
    }
    if (!res.ok) throw new Error(`GitHub Models ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    return (data.choices?.[0]?.message?.content ?? '').trim();
  },
);
ipcMain.handle('jarvis:has-github', () => Boolean(getDecryptedKey('GITHUB_TOKEN')));

// â”€â”€ Qwen / DashScope IPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle(
  'jarvis:qwen',
  async (
    _evt,
    payload: {
      messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
      system?: string;
      maxTokens?: number;
    },
  ) => {
    const apiKey = getDecryptedKey('DASHSCOPE_API_KEY');
    if (!apiKey) throw new Error('DASHSCOPE_API_KEY missing');
    const model = process.env.QWEN_MODEL || 'qwen-plus';
    const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
    const msgs = compressMsgs(payload.messages);
    const finalMsgs: { role: string; content: string }[] = [];
    if (payload.system) finalMsgs.push({ role: 'system', content: compressSystem(payload.system) });
    finalMsgs.push(...msgs);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: finalMsgs,
        max_tokens: payload.maxTokens ?? 256,
        temperature: 0.7,
      }),
    });
    if (res.status === 429)
      throw new Error(`RATE_LIMIT:${parseInt(res.headers.get('retry-after') || '30', 10)}:Qwen rate limit`);
    if (!res.ok) throw new Error(`Qwen ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    return (data.choices?.[0]?.message?.content ?? '').trim();
  },
);
ipcMain.handle('jarvis:has-qwen', () => Boolean(getDecryptedKey('DASHSCOPE_API_KEY')));

// â”€â”€ Ollama IPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle(
  'jarvis:ollama',
  async (
    _evt,
    payload: {
      messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
      system?: string;
      maxTokens?: number;
    },
  ) => {
    const host = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
    const apiKey = process.env.OLLAMA_API_KEY || '';
    const model = process.env.OLLAMA_MODEL || 'qwen3-coder-next';
    const url = `${host}/v1/chat/completions`;
    const msgs = compressMsgs(payload.messages);
    const finalMsgs: { role: string; content: string }[] = [];
    if (payload.system) finalMsgs.push({ role: 'system', content: compressSystem(payload.system) });
    finalMsgs.push(...msgs);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: finalMsgs,
        max_tokens: payload.maxTokens ?? 256,
        temperature: 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 429)
      throw new Error(`RATE_LIMIT:${parseInt(res.headers.get('retry-after') || '10', 10)}:Ollama rate limit`);
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    return (data.choices?.[0]?.message?.content ?? '').trim();
  },
);
ipcMain.handle('jarvis:has-ollama', async () => {
  if (process.env.OLLAMA_API_KEY) return true;
  try {
    const host = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
    return (await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(1200) })).ok;
  } catch {
    return false;
  }
});

// â”€â”€ Gemini Transcribe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle(
  'jarvis:gemini-transcribe',
  async (_evt, payload: { audioBase64: string; mimeType: string }) => {
    const apiKey = getDecryptedKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');
    const model = process.env.GEMINI_STT_MODEL || 'gemini-2.0-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Transcribe the spoken audio exactly as heard. Return only the transcription.' },
            { inlineData: { mimeType: payload.mimeType, data: payload.audioBase64 } },
          ],
        },
      ],
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      const errText = await res.text();
      const m = errText.match(/retryDelay["\s:]+(["']?)(\d+)s/);
      throw new Error(
        `RATE_LIMIT:${m ? parseInt(m[2], 10) : parseInt(res.headers.get('retry-after') || '60', 10)}:${errText.slice(0, 120)}`,
      );
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  },
);

// â”€â”€ Ollama Transcribe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle(
  'jarvis:ollama-transcribe',
  async (_evt, payload: { audioBase64: string; mimeType: string }) => {
    const host = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
    const apiKey = process.env.OLLAMA_API_KEY || '';
    const model = process.env.OLLAMA_STT_MODEL || 'whisper';
    const url = `${host}/v1/audio/transcriptions`;
    const audioBuf = Buffer.from(payload.audioBase64, 'base64');
    const ext = payload.mimeType.includes('mp4') ? 'mp4' : payload.mimeType.includes('ogg') ? 'ogg' : 'webm';
    const form = new FormData();
    form.append('file', new Blob([audioBuf], { type: payload.mimeType }), `audio.${ext}`);
    form.append('model', model);
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(url, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Ollama STT ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (((await res.json()) as any).text ?? '').trim();
  },
);

// â”€â”€ Voice Diagnostics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle('jarvis:voice-diag', async () => {
  const hasGemini = Boolean(getDecryptedKey('GEMINI_API_KEY'));
  const hasAnthropic = Boolean(getDecryptedKey('ANTHROPIC_API_KEY'));
  const hasGithub = Boolean(getDecryptedKey('GITHUB_TOKEN'));
  const hasQwen = Boolean(getDecryptedKey('DASHSCOPE_API_KEY'));
  let hasOllama = Boolean(process.env.OLLAMA_API_KEY);
  if (!hasOllama) {
    try {
      const host = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
      hasOllama = (await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(1200) })).ok;
    } catch {
      hasOllama = false;
    }
  }
  return {
    hasGemini,
    geminiOk: hasGemini,
    geminiErr: hasGemini ? '' : 'GEMINI_API_KEY missing',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    sttModel: process.env.GEMINI_STT_MODEL || 'gemini-2.0-flash-lite',
    hasAnthropic,
    hasGithub,
    githubModel: process.env.GITHUB_MODEL || 'gpt-4.1-mini',
    githubFallback: process.env.GITHUB_FALLBACK_MODEL || 'gpt-4o-mini',
    hasQwen,
    qwenModel: process.env.QWEN_MODEL || 'qwen-plus',
    hasOllama,
    ollamaModel: process.env.OLLAMA_MODEL || 'qwen3-coder-next',
    ollamaSTTModel: process.env.OLLAMA_STT_MODEL || 'whisper',
  };
});

// â”€â”€ System Metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle('system:metrics', () => getSystemMetrics());

// â”€â”€ Apps Registry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function appsRegistryPath() {
  return path.join(app.getPath('userData'), 'apps-registry.json');
}
type AppEntry = {
  id: string;
  name: string;
  path: string;
  kind: 'exe' | 'url' | 'folder' | 'cmd';
  tag?: string;
  addedAt: number;
};
function readRegistry(): AppEntry[] {
  try {
    return JSON.parse(fs.readFileSync(appsRegistryPath(), 'utf8'));
  } catch {
    return [];
  }
}
function writeRegistry(list: AppEntry[]) {
  fs.mkdirSync(path.dirname(appsRegistryPath()), { recursive: true });
  fs.writeFileSync(appsRegistryPath(), JSON.stringify(list, null, 2), 'utf8');
}

ipcMain.handle('apps:list', () => readRegistry());
ipcMain.handle('apps:add', (_e, entry: Omit<AppEntry, 'id' | 'addedAt'>) => {
  const list = readRegistry();
  const e: AppEntry = { ...entry, id: 'A-' + Math.random().toString(36).slice(2, 9), addedAt: Date.now() };
  list.unshift(e);
  writeRegistry(list);
  return e;
});
ipcMain.handle('apps:remove', (_e, id: string) => {
  writeRegistry(readRegistry().filter((x) => x.id !== id));
  return true;
});
ipcMain.handle('apps:pick', async (_e, kind: 'exe' | 'folder') => {
  const win = BrowserWindow.getFocusedWindow();
  const r = await dialog.showOpenDialog(win!, {
    properties: kind === 'folder' ? ['openDirectory'] : ['openFile'],
    filters:
      kind === 'exe'
        ? [
            { name: 'Executables', extensions: ['exe', 'bat', 'cmd', 'ps1', 'lnk'] },
            { name: 'All', extensions: ['*'] },
          ]
        : undefined,
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('apps:launch', async (_e, entry: AppEntry) => {
  try {
    if (entry.kind === 'url') {
      await shell.openExternal(entry.path);
      return { ok: true };
    }
    if (entry.kind === 'folder' || entry.kind === 'exe') {
      const r = await shell.openPath(entry.path);
      return { ok: r === '', err: r || undefined };
    }
    if (entry.kind === 'cmd') {
      spawn(entry.path, [], { shell: true, detached: true, stdio: 'ignore' }).unref();
      return { ok: true };
    }
    return { ok: false, err: 'unknown kind' };
  } catch (err: any) {
    return { ok: false, err: String(err?.message || err) };
  }
});
ipcMain.handle('apps:scan-common', async () => {
  if (process.platform !== 'win32') return [];
  const roots = [
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    path.join(os.homedir(), 'AppData', 'Local', 'Programs'),
  ];
  const found: { name: string; path: string }[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    try {
      for (const dir of fs.readdirSync(root).slice(0, 80)) {
        const full = path.join(root, dir);
        try {
          if (!fs.statSync(full).isDirectory()) continue;
          const exe = fs
            .readdirSync(full)
            .slice(0, 40)
            .find((f) => f.toLowerCase().endsWith('.exe'));
          if (exe) found.push({ name: dir, path: path.join(full, exe) });
        } catch {
          /* skip */
        }
        if (found.length >= 60) break;
      }
    } catch {
      /* skip */
    }
    if (found.length >= 60) break;
  }
  return found;
});

// â”€â”€ Agents Filesystem Scanner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ScannedAgent {
  id: string;
  name: string;
  desc: string;
  tools: string[];
  file: string;
  cat: string;
}

function parseAgentFrontmatter(content: string, file: string): ScannedAgent | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const yaml = match[1];
  const nameM = yaml.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
  const descM =
    yaml.match(/^description:\s*["'](.+?)["']\s*$/ms) || yaml.match(/^description:\s*(.+?)[\r\n]/m);
  const toolsM = yaml.match(/^tools:\s*\[([^\]]*)\]/m);
  const name = nameM?.[1]?.trim() || file.replace(/\.agent\.md$/, '');
  const desc = descM?.[1]?.trim() || '';
  const tools = toolsM
    ? toolsM[1]
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const lower = (name + ' ' + desc).toLowerCase();
  let cat = 'SPECIALIST';
  if (/trading|market|finance|cfo|tax|steuer/.test(lower)) cat = 'TRADING';
  else if (/security|cyber|red.team|pentest|vuln/.test(lower)) cat = 'SECURITY';
  else if (/frontend|react|vue|angular|css|ui/.test(lower)) cat = 'FRONTEND';
  else if (/backend|api|node|python|rust|java/.test(lower)) cat = 'BACKEND';
  else if (/cloud|azure|aws|gcp|terraform|bicep/.test(lower)) cat = 'CLOUD';
  else if (/data|sql|db|analytic|ml|ai|llm/.test(lower)) cat = 'DATA';
  else if (/debug|qa|test|review/.test(lower)) cat = 'DEBUG';
  else if (/content|social|media|blog|seo|youtube/.test(lower)) cat = 'CONTENT';
  else if (/orchestrat|meta|agent|workflow|planner/.test(lower)) cat = 'META';
  const id = 'RA-' + file.replace(/\.agent\.md$/, '').replace(/[^A-Za-z0-9]/g, '-');
  return { id, name, desc, tools, file, cat };
}

ipcMain.handle('jarvis:workspace', async () => {
  const agentsPath = process.env.JARVIS_AGENTS_PATH || '';
  const skillsIndexPath = process.env.JARVIS_SKILLS_INDEX || '';
  let agentCount = 0,
    skillsTotal = 0;
  if (agentsPath && fs.existsSync(agentsPath)) {
    try {
      agentCount = fs.readdirSync(agentsPath).filter((f) => f.endsWith('.agent.md')).length;
    } catch {}
  }
  if (skillsIndexPath && fs.existsSync(skillsIndexPath)) {
    try {
      skillsTotal = (JSON.parse(fs.readFileSync(skillsIndexPath, 'utf8')) as any).total || 0;
    } catch {}
  }
  return { agentsPath, skillsIndexPath, agentCount, skillsTotal };
});

ipcMain.handle('jarvis:scan-agents', async () => {
  const agentsPath = process.env.JARVIS_AGENTS_PATH || '';
  const agents: ScannedAgent[] = [];
  if (!agentsPath || !fs.existsSync(agentsPath)) return agents;
  try {
    for (const file of fs.readdirSync(agentsPath).filter((f) => f.endsWith('.agent.md'))) {
      try {
        const agent = parseAgentFrontmatter(fs.readFileSync(path.join(agentsPath, file), 'utf8'), file);
        if (agent) agents.push(agent);
      } catch {
        /* skip */
      }
    }
    pushActivity('JARVIS', 'SCAN', `${agents.length} agents loaded`);
  } catch {}
  return agents;
});

ipcMain.handle('jarvis:live-scan', async () => {
  const agentsPath = process.env.JARVIS_AGENTS_PATH || '';
  const result = { total: 0, byCategory: {} as Record<string, number>, lastModTs: 0, scanTs: Date.now() };
  if (!agentsPath || !fs.existsSync(agentsPath)) return result;
  try {
    const files = fs.readdirSync(agentsPath).filter((f) => f.endsWith('.agent.md'));
    result.total = files.length;
    let lastMod = 0;
    for (const file of files) {
      const lower = file.toLowerCase();
      let cat = 'SPECIALIST';
      if (/trading|market|finance|cfo|tax|zeus/.test(lower)) cat = 'TRADING';
      else if (/security|cyber|red.team|pentest|vuln/.test(lower)) cat = 'SECURITY';
      else if (/frontend|react|vue|angular|css|ui|web/.test(lower)) cat = 'FRONTEND';
      else if (/backend|api|node|python|rust|java|server/.test(lower)) cat = 'BACKEND';
      else if (/cloud|azure|aws|gcp|terraform|bicep/.test(lower)) cat = 'CLOUD';
      else if (/data|sql|db|analytic|ml|ai|llm/.test(lower)) cat = 'DATA';
      else if (/debug|qa|test|review/.test(lower)) cat = 'DEBUG';
      else if (/content|social|media|blog|seo|youtube/.test(lower)) cat = 'CONTENT';
      else if (/orchestrat|meta|agent|workflow|planner/.test(lower)) cat = 'META';
      result.byCategory[cat] = (result.byCategory[cat] || 0) + 1;
      try {
        const mt = fs.statSync(path.join(agentsPath, file)).mtimeMs;
        if (mt > lastMod) lastMod = mt;
      } catch {}
    }
    result.lastModTs = lastMod;
  } catch {}
  return result;
});

ipcMain.handle('jarvis:rebuild-index', async () => {
  const agentsPath = process.env.JARVIS_AGENTS_PATH || '';
  const empty = {
    generated: '',
    total: 0,
    byCat: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    entries: [] as any[],
  };
  if (!agentsPath || !fs.existsSync(agentsPath)) return empty;
  pushActivity('ARSENAL', 'INDEX', 'full rebuild started');
  const entries: any[] = [];
  const byCat: Record<string, number> = {};
  const byType: Record<string, number> = {};
  try {
    for (const file of fs.readdirSync(agentsPath).filter((f) => f.endsWith('.agent.md'))) {
      try {
        const agent = parseAgentFrontmatter(fs.readFileSync(path.join(agentsPath, file), 'utf8'), file);
        if (agent) {
          entries.push(agent);
          byCat[agent.cat] = (byCat[agent.cat] || 0) + 1;
          for (const t of agent.tools) byType[t] = (byType[t] || 0) + 1;
        }
      } catch {
        /* skip */
      }
    }
  } catch {}
  pushActivity('ARSENAL', 'INDEX', `${entries.length} entries indexed`);
  return { generated: new Date().toISOString(), total: entries.length, byCat, byType, entries };
});

// â”€â”€ Native Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle('app:notify', (_evt, { title, body }: { title: string; body: string }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
  return true;
});

ipcMain.handle('shell:openExternal', (_evt, url: string) => {
  const allowed = /^https?:\/\//i.test(url);
  if (allowed) shell.openExternal(url);
  return allowed;
});

// â”€â”€ MT5 Bridge Auto-Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let mt5BridgeProc: ReturnType<typeof spawn> | null = null;
function tryStartMt5Bridge() {
  const bridgePath = app.isPackaged
    ? path.join(process.resourcesPath, 'mt5_bridge', 'bridge.py')
    : path.join(app.getAppPath(), 'mt5_bridge', 'bridge.py');
  if (!fs.existsSync(bridgePath) || mt5BridgeProc) return;
  try {
    mt5BridgeProc = spawn('python', [bridgePath], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, JARVIS_BRIDGE_TOKEN: ensureBridgeToken() },
    });
    mt5BridgeProc.unref();
    pushActivity('MT5-BRIDGE', 'START', bridgePath);
  } catch {
    /* python not found â€” silent */
  }
}
ipcMain.handle('mt5:start-bridge', () => {
  tryStartMt5Bridge();
  return true;
});

// â”€â”€ Path Safety Validator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isPathAllowed(targetPath: string): boolean {
  return isPathInRoots(targetPath, [
    app.getPath('userData'),
    app.getAppPath(),
    process.env.JARVIS_AGENTS_PATH ?? '',
    process.env.JARVIS_SKILLS_INDEX ? path.dirname(process.env.JARVIS_SKILLS_INDEX) : '',
  ]);
}

ipcMain.handle('jarvis:write-file', async (_e, raw: unknown) => {
  try {
    const { filePath, content } = validate(WriteFilePayload, raw);
    if (!isPathAllowed(filePath))
      return { ok: false, err: 'Access denied: path outside allowed directories' };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    pushActivity('ARSENAL', 'WRITE', path.basename(filePath));
    return { ok: true };
  } catch (err: any) {
    return { ok: false, err: String(err?.message || err) };
  }
});

ipcMain.handle('jarvis:read-file-content', async (_e, raw: unknown) => {
  try {
    const filePath = validate(ReadFilePath, raw);
    if (!isPathAllowed(filePath))
      return { ok: false, content: '', err: 'Access denied: path outside allowed directories' };
    if (!fs.existsSync(filePath)) return { ok: false, content: '', err: 'File not found' };
    return { ok: true, content: fs.readFileSync(filePath, 'utf8') };
  } catch (err: any) {
    return { ok: false, content: '', err: String(err?.message || err) };
  }
});

// â”€â”€ Zeus / MT5 REST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle('zeus:ping', async (_e, url: string) => {
  try {
    const r = await fetch(url, { method: 'GET' });
    return { ok: r.ok, status: r.status, body: (await r.text()).slice(0, 500) };
  } catch (err: any) {
    return { ok: false, status: 0, err: String(err?.message || err) };
  }
});

ipcMain.handle('zeus:mt5', async (_e, raw: unknown) => {
  const payload = validate(Mt5Payload, raw);
  const safeHost = String(payload.host).replace(/[^a-zA-Z0-9._-]/g, '');
  const safePort = Math.max(1, Math.min(65535, Number(payload.port) || 1234));
  const url = `http://${safeHost}:${safePort}/api/v1/${payload.endpoint}`;
  try {
    const init: RequestInit = {
      method: payload.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-JARVIS-Token': ensureBridgeToken(),
      },
      signal: AbortSignal.timeout(5000),
    };
    if (payload.body !== undefined) init.body = JSON.stringify(payload.body);
    const r = await fetch(url, init);
    const txt = await r.text();
    let data: unknown;
    try {
      data = JSON.parse(txt);
    } catch {
      data = txt;
    }
    pushActivity('MT5-BRIDGE', 'POLL', payload.endpoint);
    return { ok: r.ok, status: r.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, err: String(err?.message || err) };
  }
});

// ── System Tools ──────────────────────────────────────────────────────────
const SAFE_TOOL_CMDS: Record<string, string> = {
  'task-manager': 'taskmgr.exe',
  'resource-monitor': 'resmon.exe',
  'event-viewer': 'eventvwr.exe',
  'disk-cleanup': 'cleanmgr.exe',
  'device-manager': 'devmgmt.msc',
  'registry-editor': 'regedit.exe',
  services: 'services.msc',
  'task-scheduler': 'taskschd.msc',
  'system-info': 'msinfo32.exe',
  'env-vars': 'rundll32.exe sysdm.cpl,EditEnvironmentVariables',
  'windows-update': 'ms-settings:windowsupdate',
  'startup-apps': 'ms-settings:startupapps',
  'storage-sense': 'ms-settings:storagepolicies',
  'network-adapter': 'ncpa.cpl',
  firewall: 'firewall.cpl',
};
ipcMain.handle('system:openTool', (_e, toolId: string) => {
  const cmd = SAFE_TOOL_CMDS[toolId];
  if (!cmd) return { ok: false, err: 'Unknown tool' };
  try {
    if (cmd.startsWith('ms-')) shell.openExternal(cmd);
    else exec(cmd);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, err: String(err?.message || err) };
  }
});
ipcMain.handle(
  'system:getProcs',
  () =>
    new Promise<{ ok: boolean; data?: unknown[]; err?: string }>((resolve) => {
      exec(
        'powershell -NoProfile -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 25 Name,Id,CPU,WorkingSet | ConvertTo-Json -Compress"',
        { timeout: 8000 },
        (err, stdout) => {
          if (err) {
            resolve({ ok: false, err: String(err?.message || err) });
            return;
          }
          try {
            const raw: any[] = JSON.parse(stdout);
            resolve({
              ok: true,
              data: raw.map((p) => ({
                name: p.Name || '—',
                pid: p.Id,
                cpu: typeof p.CPU === 'number' ? Math.round(p.CPU * 10) / 10 : 0,
                mem_mb: Math.round((p.WorkingSet || 0) / 1_048_576),
              })),
            });
          } catch {
            resolve({ ok: false, err: 'parse error' });
          }
        },
      );
    }),
);
ipcMain.handle(
  'system:clearTemp',
  () =>
    new Promise<{ ok: boolean; freed?: string; err?: string }>((resolve) => {
      exec(
        'powershell -NoProfile -Command "Remove-Item -Path $env:TEMP\\* -Recurse -Force -ErrorAction SilentlyContinue; Write-Output done"',
        { timeout: 15000 },
        (err) => {
          if (err) {
            resolve({ ok: false, err: String(err?.message || err) });
            return;
          }
          resolve({ ok: true, freed: 'Temp files cleared' });
        },
      );
    }),
);
ipcMain.handle(
  'system:memReduce',
  () =>
    new Promise<{ ok: boolean; msg?: string; err?: string }>((resolve) => {
      exec(
        'powershell -NoProfile -Command "[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers(); Write-Output OK"',
        { timeout: 8000 },
        (err, stdout) => {
          if (err) {
            resolve({ ok: false, err: String(err?.message || err) });
            return;
          }
          resolve({ ok: true, msg: stdout.trim() });
        },
      );
    }),
);
ipcMain.handle(
  'system:fileSearch',
  (_e, query: string) =>
    new Promise<{ ok: boolean; results?: string[]; err?: string }>((resolve) => {
      const safe = (query || '').replace(/[;&|`$'"\\]/g, '').slice(0, 80);
      exec(
        `powershell -NoProfile -Command "Get-ChildItem -Path C:\\ -Recurse -Filter '*${safe}*' -ErrorAction SilentlyContinue | Select-Object -First 25 FullName | ForEach-Object { $_.FullName }"`,
        { timeout: 12000 },
        (err, stdout) => {
          if (err) {
            resolve({ ok: false, err: String(err?.message || err) });
            return;
          }
          resolve({
            ok: true,
            results: stdout
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 25),
          });
        },
      );
    }),
);
ipcMain.handle(
  'system:netScan',
  () =>
    new Promise<{ ok: boolean; data?: string[]; err?: string }>((resolve) => {
      exec(
        'powershell -NoProfile -Command "netstat -an | Select-String LISTENING"',
        { timeout: 8000 },
        (err, stdout) => {
          if (err) {
            resolve({ ok: false, err: String(err?.message || err) });
            return;
          }
          resolve({
            ok: true,
            data: stdout
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 50),
          });
        },
      );
    }),
);
ipcMain.handle(
  'console:runCmd',
  (_e, cmd: unknown) =>
    new Promise<{ ok: boolean; stdout?: string; stderr?: string; err?: string }>((resolve) => {
      if (!getAdvancedMode()) {
        resolve({ ok: false, err: 'Advanced Mode is OFF — enable it (🔒 ADV) to allow shell execution.' });
        return;
      }
      if (typeof cmd !== 'string' || !cmd.trim()) {
        resolve({ ok: false, err: 'Empty command' });
        return;
      }
      pushActivity('CONSOLE', 'EXEC', cmd.slice(0, 80)); // audit every executed command
      exec(cmd, { timeout: 30000, maxBuffer: 1024 * 512, cwd: os.homedir() }, (err, stdout, stderr) => {
        if (err && !stdout) {
          resolve({ ok: false, stderr: stderr || '', err: String(err?.message || err) });
          return;
        }
        resolve({ ok: true, stdout: stdout || '', stderr: stderr || '' });
      });
    }),
);

// â”€â”€ Window State Persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function windowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}
function loadWindowState(): { x?: number; y?: number; width: number; height: number } {
  try {
    return JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
  } catch {
    return { width: 1600, height: 920 };
  }
}
function saveWindowState(win: BrowserWindow) {
  try {
    fs.writeFileSync(windowStatePath(), JSON.stringify(win.getBounds()), 'utf8');
  } catch {}
}

// â”€â”€ Window â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let mainWin: BrowserWindow | null = null;
function createWindow() {
  const ws = loadWindowState();
  const win = new BrowserWindow({
    width: ws.width,
    height: ws.height,
    x: ws.x,
    y: ws.y,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#070912',
    autoHideMenuBar: true,
    title: 'JARVIS Operations OS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWin = win;

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Block renderer-initiated navigation away from the app's own pages. External
  // links are routed to the OS browser by setWindowOpenHandler instead.
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'microphone', 'audioCapture'].includes(permission));
  });
  win.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return ['media', 'microphone', 'audioCapture'].includes(permission);
  });

  // Always handle Yahoo Finance CORS (dev+prod); CSP only in prod
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders: Record<string, string[]> = {
      ...(details.responseHeaders as Record<string, string[]>),
    };
    if (/query[12]\.finance\.yahoo\.com/.test(details.url)) {
      responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      responseHeaders['Access-Control-Allow-Methods'] = ['GET'];
      delete responseHeaders['x-frame-options'];
      delete responseHeaders['X-Frame-Options'];
    }
    if (!isDev) {
      responseHeaders['Content-Security-Policy'] = [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "connect-src 'self' https://api.anthropic.com https://generativelanguage.googleapis.com " +
          'https://models.inference.ai.azure.com https://dashscope-intl.aliyuncs.com ' +
          'https://query1.finance.yahoo.com https://query2.finance.yahoo.com ' +
          'http://localhost:* http://127.0.0.1:*; ' +
          "img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com;",
      ];
    }
    callback({ responseHeaders });
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });

  win.webContents.on('console-message', (_e, level, msg, line, src) => {
    if (level >= 2) console.error(`[RENDERER ${level}] ${src}:${line} -> ${msg}`);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[LOAD FAIL] ${code} ${desc} -- ${url}`);
  });

  win.on('close', () => saveWindowState(win));

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(fs.existsSync(distIndex) ? distIndex : distIndexFallback);
  }
}

// â”€â”€ App Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Workflow Scheduler (node-cron) ──────────────────────────────────────────
interface ScheduledJob {
  id: string;
  expression: string;
  workflowId: string;
  workflowName: string;
  prompt: string;
  channel: string;
  createdAt: number;
  lastRun?: number;
  runCount: number;
}
const scheduledJobs = new Map<string, { job: cron.ScheduledTask; meta: ScheduledJob }>();

function scheduledJobsPath() {
  return path.join(app.getPath('userData'), 'scheduled-jobs.json');
}

// Persist all job metadata to disk so schedules survive an app restart.
function persistScheduledJobs() {
  try {
    const metas = Array.from(scheduledJobs.values()).map(({ meta }) => meta);
    fs.mkdirSync(path.dirname(scheduledJobsPath()), { recursive: true });
    fs.writeFileSync(scheduledJobsPath(), JSON.stringify(metas, null, 2), 'utf8');
  } catch {
    /* best-effort persistence */
  }
}

// Register (or re-register) a cron task for one job meta and track it in the map.
// Shared by the IPC handler and the on-startup loader so behaviour can't drift.
function registerScheduledJob(meta: ScheduledJob): void {
  if (scheduledJobs.has(meta.id)) {
    scheduledJobs.get(meta.id)!.job.stop();
    scheduledJobs.delete(meta.id);
  }
  const task = cron.schedule(
    meta.expression,
    async () => {
      meta.lastRun = Date.now();
      meta.runCount++;
      persistScheduledJobs(); // keep lastRun/runCount durable
      pushActivity('SCHEDULER', 'RUN', `${meta.workflowName} · ${meta.channel}`);
      try {
        const result = await routedComplete({
          messages: [{ role: 'user', content: meta.prompt }],
          system: `You are JARVIS. Generate scheduled content for ${meta.channel}. Be concise and platform-optimized.`,
          maxTokens: 800,
        });
        pushActivity('SCHEDULER', 'DONE', `${meta.workflowName}: ${result.slice(0, 60)}`);
      } catch (e: any) {
        pushActivity('SCHEDULER', 'ERROR', String(e?.message || e).slice(0, 60));
      }
    },
    { timezone: 'UTC' },
  );
  scheduledJobs.set(meta.id, { job: task, meta });
}

// Re-arm persisted jobs on startup. Invalid/corrupt entries are skipped, not fatal.
function loadScheduledJobs(): void {
  let metas: unknown;
  try {
    metas = JSON.parse(fs.readFileSync(scheduledJobsPath(), 'utf8'));
  } catch {
    return;
  }
  if (!Array.isArray(metas)) return;
  for (const m of metas as ScheduledJob[]) {
    if (m && typeof m.expression === 'string' && cron.validate(m.expression)) {
      registerScheduledJob({ ...m, runCount: m.runCount ?? 0 });
    }
  }
  if (scheduledJobs.size) pushActivity('SCHEDULER', 'RESTORE', `${scheduledJobs.size} job(s) reloaded`);
}

ipcMain.handle(
  'workflow:schedule',
  async (
    _evt,
    config: {
      id: string;
      expression: string;
      workflowId: string;
      workflowName: string;
      prompt: string;
      channel: string;
    },
  ) => {
    if (!cron.validate(config.expression)) throw new Error(`Invalid cron expression: ${config.expression}`);
    registerScheduledJob({ ...config, createdAt: Date.now(), runCount: 0 });
    persistScheduledJobs();
    return { ok: true, id: config.id };
  },
);

ipcMain.handle('workflow:cancel', async (_evt, id: string) => {
  if (scheduledJobs.has(id)) {
    scheduledJobs.get(id)!.job.stop();
    scheduledJobs.delete(id);
    persistScheduledJobs();
    return true;
  }
  return false;
});

ipcMain.handle('workflow:list-scheduled', async () =>
  Array.from(scheduledJobs.values()).map(({ meta }) => meta),
);

// ── Provider connectivity test (A4) ──────────────────────────────────────────────────
ipcMain.handle('config:test-provider', async (_evt, provider: string) => {
  try {
    if (provider === 'openai') {
      const key = getDecryptedKey('OPENAI_API_KEY');
      if (!key) return { ok: false, error: 'No key stored' };
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      return { ok: r.ok, status: r.status };
    }
    if (provider === 'qwen') {
      const key = getDecryptedKey('DASHSCOPE_API_KEY');
      if (!key) return { ok: false, error: 'No key stored' };
      const r = await fetch('https://dashscope.aliyuncs.com/api/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      return { ok: r.ok, status: r.status };
    }
    if (provider === 'n8n') {
      const url = getDecryptedKey('N8N_WEBHOOK_URL') ?? '';
      const key = getDecryptedKey('N8N_API_KEY') ?? '';
      if (!url && !key) return { ok: false, error: 'No URL/key stored' };
      const base = (url || 'http://localhost:5678').replace(/\/webhook.*/, '');
      const r = await fetch(`${base}/api/v1/workflows?limit=1`, { headers: { 'X-N8N-API-KEY': key } });
      return { ok: r.ok, status: r.status };
    }
    return { ok: false, error: 'Provider not supported for live test' };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 100) };
  }
});

// ── Social Media Posting (B2) ─────────────────────────────────────────────────────
ipcMain.handle(
  'social:post-x',
  async (
    _evt,
    {
      text,
      apiKey,
      apiSecret,
      accessToken,
      accessSecret,
    }: { text: string; apiKey: string; apiSecret: string; accessToken: string; accessSecret: string },
  ) => {
    try {
      const { createHmac, randomBytes } = await import('node:crypto');
      const ts = Math.floor(Date.now() / 1000).toString();
      const nonce = randomBytes(16)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '');
      const params: Record<string, string> = {
        oauth_consumer_key: apiKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: ts,
        oauth_token: accessToken,
        oauth_version: '1.0',
      };
      const sorted = Object.keys(params)
        .sort()
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
        .join('&');
      const sigBase = `POST&${encodeURIComponent('https://api.twitter.com/2/tweets')}&${encodeURIComponent(sorted)}`;
      const sigKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
      params.oauth_signature = createHmac('sha1', sigKey).update(sigBase).digest('base64');
      const authHeader =
        'OAuth ' +
        Object.keys(params)
          .sort()
          .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
          .join(', ');
      const r = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = (await r.json().catch(() => ({}))) as Record<string, any>;
      if (!r.ok)
        return { ok: false, error: json?.detail ?? json?.errors?.[0]?.message ?? `HTTP ${r.status}` };
      return { ok: true, id: json?.data?.id };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  },
);

ipcMain.handle(
  'social:post-ig',
  async (
    _evt,
    {
      imageUrl,
      caption,
      accessToken,
      igUserId,
    }: { imageUrl: string; caption: string; accessToken: string; igUserId: string },
  ) => {
    try {
      const s1 = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
      });
      const s1j = (await s1.json().catch(() => ({}))) as Record<string, any>;
      if (!s1.ok || !s1j?.id) return { ok: false, error: `Container: ${JSON.stringify(s1j).slice(0, 100)}` };
      const s2 = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: s1j.id, access_token: accessToken }),
      });
      const s2j = (await s2.json().catch(() => ({}))) as Record<string, any>;
      if (!s2.ok) return { ok: false, error: `Publish: ${JSON.stringify(s2j).slice(0, 100)}` };
      return { ok: true, id: s2j?.id };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  },
);

app.whenReady().then(() => {
  for (const name of [
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'GITHUB_TOKEN',
    'DASHSCOPE_API_KEY',
    'JARVIS_MODEL',
  ]) {
    const v = getDecryptedKey(name);
    if (v) process.env[name] = v;
  }
  createWindow();
  tryStartMt5Bridge();
  loadScheduledJobs();

  // Auto morning briefing — 07:00 UTC daily (B3)
  cron.schedule(
    '0 7 * * *',
    async () => {
      pushActivity('JARVIS', 'BRIEFING', 'Morning Intel scheduled run');
      try {
        const brief = await routedComplete({
          messages: [
            {
              role: 'user',
              content:
                'Morning intel briefing: top 3 market moves (crypto+equities), 2 breaking tech/AI stories, 1 actionable insight. Under 220 words, structured.',
            },
          ],
          system:
            'You are JARVIS, elite morning intelligence analyst. High-signal briefings for a tech+trading power user. Factual, dense, no filler.',
          maxTokens: 450,
        });
        pushActivity('JARVIS', 'BRIEFING', 'Morning Intel ready');
        mainWin?.webContents.send('briefing:new', { type: 'MORNING_AUTO', text: brief, ts: Date.now() });
      } catch (e: any) {
        pushActivity('JARVIS', 'ERROR', `Morning briefing: ${String(e?.message ?? e).slice(0, 50)}`);
      }
    },
    { timezone: 'UTC' },
  );

  globalShortcut.register('Alt+Space', () => mainWin?.webContents.send('shortcut:voice'));
  globalShortcut.register('Alt+J', () => {
    if (mainWin?.isVisible()) mainWin.hide();
    else mainWin?.show();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
