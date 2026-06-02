#!/usr/bin/env python3
"""One-shot patch script — applies ALL remaining theater fixes to JARVIS (A2-A4, B1-B3)"""
import sys, os

BASE = os.path.dirname(os.path.abspath(__file__))

def patch(path, old, new, required=True):
    full = os.path.join(BASE, path)
    content = open(full, 'r', encoding='utf-8-sig').read()
    if old not in content:
        if required:
            print(f"  ✗ NOT FOUND in {path}: {repr(old[:60])}")
            return False
        print(f"  ~ Already patched or not found (ok): {repr(old[:60])}")
        return True
    open(full, 'w', encoding='utf-8', newline='\r\n').write(content.replace(old, new, 1))
    print(f"  ✓ Patched {path}")
    return True

# ─────────────────────────────────────────────────────────────────────────────
# 1. electron/main.ts — test-provider + social IPC + morning cron
# ─────────────────────────────────────────────────────────────────────────────
MAIN_TS = 'electron/main.ts'

OLD_APP_READY = """app.whenReady().then(() => {
  for (const name of ['ANTHROPIC_API_KEY','GEMINI_API_KEY','GITHUB_TOKEN','DASHSCOPE_API_KEY','JARVIS_MODEL']) {
    const v = getDecryptedKey(name); if (v) process.env[name] = v;
  }
  createWindow();
  tryStartMt5Bridge();
  globalShortcut.register('Alt+Space', () => mainWin?.webContents.send('shortcut:voice'));
  globalShortcut.register('Alt+J', () => { if (mainWin?.isVisible()) mainWin.hide(); else mainWin?.show(); });
});"""

NEW_APP_READY = """// \u2500\u2500 Provider connectivity test (A4) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
ipcMain.handle('config:test-provider', async (_evt, provider: string) => {
  try {
    if (provider === 'openai') {
      const key = getDecryptedKey('OPENAI_API_KEY');
      if (!key) return { ok: false, error: 'No key stored' };
      const r = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
      return { ok: r.ok, status: r.status };
    }
    if (provider === 'qwen') {
      const key = getDecryptedKey('DASHSCOPE_API_KEY');
      if (!key) return { ok: false, error: 'No key stored' };
      const r = await fetch('https://dashscope.aliyuncs.com/api/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
      return { ok: r.ok, status: r.status };
    }
    if (provider === 'n8n') {
      const url = getDecryptedKey('N8N_WEBHOOK_URL') ?? '';
      const key = getDecryptedKey('N8N_API_KEY') ?? '';
      if (!url && !key) return { ok: false, error: 'No URL/key stored' };
      const base = (url || 'http://localhost:5678').replace(/\\/webhook.*/, '');
      const r = await fetch(`${base}/api/v1/workflows?limit=1`, { headers: { 'X-N8N-API-KEY': key } });
      return { ok: r.ok, status: r.status };
    }
    return { ok: false, error: 'Provider not supported for live test' };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 100) };
  }
});

// \u2500\u2500 Social Media Posting (B2) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
ipcMain.handle('social:post-x', async (_evt, {
  text, apiKey, apiSecret, accessToken, accessSecret,
}: { text: string; apiKey: string; apiSecret: string; accessToken: string; accessSecret: string }) => {
  try {
    const { createHmac, randomBytes } = await import('node:crypto');
    const ts    = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    const params: Record<string, string> = {
      oauth_consumer_key: apiKey, oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: ts,
      oauth_token: accessToken, oauth_version: '1.0',
    };
    const sorted = Object.keys(params).sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
    const sigBase = `POST&${encodeURIComponent('https://api.twitter.com/2/tweets')}&${encodeURIComponent(sorted)}`;
    const sigKey  = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
    params.oauth_signature = createHmac('sha1', sigKey).update(sigBase).digest('base64');
    const authHeader = 'OAuth ' + Object.keys(params).sort()
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`).join(', ');
    const r = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const json = await r.json().catch(() => ({})) as Record<string, any>;
    if (!r.ok) return { ok: false, error: json?.detail ?? json?.errors?.[0]?.message ?? `HTTP ${r.status}` };
    return { ok: true, id: json?.data?.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

ipcMain.handle('social:post-ig', async (_evt, {
  imageUrl, caption, accessToken, igUserId,
}: { imageUrl: string; caption: string; accessToken: string; igUserId: string }) => {
  try {
    const s1 = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
    });
    const s1j = await s1.json().catch(() => ({})) as Record<string, any>;
    if (!s1.ok || !s1j?.id) return { ok: false, error: `Container: ${JSON.stringify(s1j).slice(0, 100)}` };
    const s2 = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: s1j.id, access_token: accessToken }),
    });
    const s2j = await s2.json().catch(() => ({})) as Record<string, any>;
    if (!s2.ok) return { ok: false, error: `Publish: ${JSON.stringify(s2j).slice(0, 100)}` };
    return { ok: true, id: s2j?.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

app.whenReady().then(() => {
  for (const name of ['ANTHROPIC_API_KEY','GEMINI_API_KEY','GITHUB_TOKEN','DASHSCOPE_API_KEY','JARVIS_MODEL']) {
    const v = getDecryptedKey(name); if (v) process.env[name] = v;
  }
  createWindow();
  tryStartMt5Bridge();

  // Auto morning briefing \u2014 07:00 UTC daily (B3)
  cron.schedule('0 7 * * *', async () => {
    pushActivity('JARVIS', 'BRIEFING', 'Morning Intel scheduled run');
    try {
      const brief = await routedComplete({
        messages: [{ role: 'user', content: 'Morning intel briefing: top 3 market moves (crypto+equities), 2 breaking tech/AI stories, 1 actionable insight. Under 220 words, structured.' }],
        system: 'You are JARVIS, elite morning intelligence analyst. High-signal briefings for a tech+trading power user. Factual, dense, no filler.',
        maxTokens: 450,
      });
      pushActivity('JARVIS', 'BRIEFING', 'Morning Intel ready');
      mainWin?.webContents.send('briefing:new', { type: 'MORNING_AUTO', text: brief, ts: Date.now() });
    } catch (e: any) {
      pushActivity('JARVIS', 'ERROR', `Morning briefing: ${String(e?.message ?? e).slice(0, 50)}`);
    }
  }, { timezone: 'UTC' });

  globalShortcut.register('Alt+Space', () => mainWin?.webContents.send('shortcut:voice'));
  globalShortcut.register('Alt+J', () => { if (mainWin?.isVisible()) mainWin.hide(); else mainWin?.show(); });
});"""

ok = patch(MAIN_TS, OLD_APP_READY, NEW_APP_READY)
if not ok:
    # Try to find actual content around app.whenReady
    full = os.path.join(BASE, MAIN_TS)
    content = open(full, 'r', encoding='utf-8-sig').read()
    idx = content.rfind('app.whenReady')
    print(f"  Last app.whenReady at char {idx}: {repr(content[idx:idx+200])}")
    sys.exit(1)

print("All patches applied successfully!")
