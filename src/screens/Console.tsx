import { useState, useEffect, useRef } from 'react';
import { DraggableTabs, type DragTab } from '../components/draggable';
import { HoloPanel, VoiceOrb, Waveform } from '../components/primitives';
import { ScreenHeader } from '../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, VIOLET, JADE, ROSE } from '../theme';
import { CONSOLE_LOG } from '../data/os-data';
import { LS, lsGet, lsSet, DEFAULT_CONTEXT, JARVIS_PERSONA } from '../lib/claude';
import type { ConsoleLine } from '../lib/claude';
import type { ScreenProps } from './Bridge';

type ConsoleTab = 'JARVIS' | 'TERMINAL' | 'HTTP' | 'TOOLS';

function ContextEditor() {
  const [ctx, setCtx] = useState(() => lsGet<string>(LS.context, DEFAULT_CONTEXT));
  const [saved, setSaved] = useState(false);
  function save() { lsSet(LS.context, ctx); setSaved(true); setTimeout(() => setSaved(false), 1500); }
  function reset() { setCtx(DEFAULT_CONTEXT); lsSet(LS.context, DEFAULT_CONTEXT); }
  return (
    <div>
      <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginBottom: 6, lineHeight: 1.4 }}>
        Wer du bist, wofür du das nutzt. JARVIS verwendet das als System-Kontext bei jeder Antwort.
      </div>
      <textarea value={ctx} onChange={e => setCtx(e.target.value)}
        style={{ width: '100%', height: 140, background: 'oklch(0.06 0.014 240 / 0.6)', border: '1px solid var(--line)', color: 'var(--fg)', padding: 8, fontFamily: 'JetBrains Mono', fontSize: 10.5, lineHeight: 1.45, resize: 'none', outline: 'none' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={save} className="hud-label" style={{ flex: 1, padding: '6px', fontSize: 9, color: CYAN_BRIGHT, border: `1px solid ${CYAN}80`, letterSpacing: '0.28em' }}>{saved ? '✓ SAVED' : 'SAVE'}</button>
        <button onClick={reset} className="hud-label" style={{ padding: '6px 10px', fontSize: 9, color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', letterSpacing: '0.28em' }}>RESET</button>
      </div>
    </div>
  );
}

/* ── TERMINAL TAB ─────────────────────────────────────────────────────────── */
interface TermLine { cmd?: string; output: string; err?: boolean; ts: string; }

function TerminalTab() {
  const [lines, setLines] = useState<TermLine[]>([{ output: '// JARVIS Terminal — ready. Type any shell command.', ts: new Date().toLocaleTimeString() }]);
  const [cmd, setCmd] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [cwd, setCwd] = useState('~');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, 99999); }, [lines]);

  async function run() {
    const c = cmd.trim();
    if (!c || busy) return;
    setHistory(p => [c, ...p.slice(0, 49)]);
    setHistIdx(-1);
    setCmd('');
    setBusy(true);
    const ts = new Date().toLocaleTimeString();
    setLines(p => [...p, { cmd: c, output: '', ts }]);
    try {
      const r = await (window as any).jarvisBridge.consoleRun(c);
      const out = [r.stdout, r.stderr].filter(Boolean).join('\n').trim() || '(no output)';
      setLines(p => {
        const n = [...p]; n[n.length-1] = { cmd:c, output:out, err: !r.ok, ts };
        return n;
      });
      if (c.startsWith('cd ')) { const newDir = c.slice(3).trim(); setCwd(newDir || '~'); }
    } catch (e: any) {
      setLines(p => { const n=[...p]; n[n.length-1]={cmd:c,output:`Error: ${e?.message||e}`,err:true,ts}; return n; });
    }
    setBusy(false);
    inputRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { run(); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const ni = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(ni);
      setCmd(history[ni] ?? '');
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const ni = Math.max(histIdx - 1, -1);
      setHistIdx(ni);
      setCmd(ni === -1 ? '' : history[ni] ?? '');
    }
  }

  const QUICK = ['dir', 'ipconfig', 'systeminfo', 'tasklist | findstr /i node', 'git status', 'npm --version', 'node --version'];

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, fontFamily:'var(--font-mono)' }}>
      <div ref={scrollRef} className="nx-scroll" style={{ flex:1, overflowY:'auto', padding:'8px 12px', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.06)' }}>
        {lines.map((l,i) => (
          <div key={i} style={{ marginBottom:8 }}>
            {l.cmd && <div style={{ color:CYAN, fontSize:11 }}><span style={{ color:'rgba(255,255,255,0.25)' }}>❯ </span>{l.cmd}</div>}
            <pre style={{ color: l.err ? ROSE : 'rgba(255,255,255,0.75)', fontSize:10.5, lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-all', margin:0 }}>{l.output}</pre>
          </div>
        ))}
        {busy && <div style={{ color:AMBER, fontSize:11 }} className="anim-pulse-soft">◌ running…</div>}
      </div>

      <div style={{ display:'flex', gap:4, padding:'4px 0', flexWrap:'wrap', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        {QUICK.map(q => (
          <button key={q} onClick={() => { setCmd(q); inputRef.current?.focus(); }} className="font-mono"
            style={{ fontSize:8.5, padding:'2px 7px', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.35)', background:'transparent', cursor:'pointer' }}>
            {q}
          </button>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center', paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
        <span className="font-mono" style={{ fontSize:11, color:JADE }}>{cwd} ❯</span>
        <input ref={inputRef} value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={onKey}
          placeholder="command…" disabled={busy}
          style={{ flex:1, background:'transparent', border:'none', color:'rgba(255,255,255,0.85)', fontFamily:'var(--font-mono)', fontSize:11.5, outline:'none' }} />
        <button onClick={run} disabled={busy||!cmd.trim()} className="hud-label"
          style={{ padding:'5px 14px', fontSize:8, color:JADE, border:`1px solid ${JADE}50`, cursor:'pointer', letterSpacing:'0.18em', background:`${JADE}10` }}>
          ▶ RUN
        </button>
        <button onClick={() => setLines([{ output:'// Terminal cleared', ts:new Date().toLocaleTimeString() }])} className="hud-label"
          style={{ padding:'5px 10px', fontSize:8, color:'rgba(255,255,255,0.3)', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer', background:'transparent' }}>CLR</button>
      </div>
    </div>
  );
}

/* ── HTTP CLIENT TAB ──────────────────────────────────────────────────────── */
function HttpTab() {
  const [method, setMethod] = useState<'GET'|'POST'|'PUT'|'PATCH'|'DELETE'>('GET');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [headers, setHeaders] = useState('Content-Type: application/json');
  const [response, setResponse] = useState<{status:number;body:string;time:number}|null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    if (!url.trim() || busy) return;
    setBusy(true); setErr(''); setResponse(null);
    const t0 = Date.now();
    try {
      const hdrs: Record<string,string> = {};
      for (const line of headers.split('\n')) {
        const [k,...v] = line.split(':'); if (k?.trim()) hdrs[k.trim()] = v.join(':').trim();
      }
      const opts: RequestInit = { method, headers: hdrs };
      if (['POST','PUT','PATCH'].includes(method) && body.trim()) opts.body = body;
      const r = await fetch(url, opts);
      const text = await r.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      setResponse({ status: r.status, body: pretty, time: Date.now()-t0 });
    } catch(e: any) { setErr(String(e?.message||e)); }
    setBusy(false);
  }

  const statusColor = (s: number) => s < 300 ? JADE : s < 400 ? AMBER : ROSE;
  const METHODS = ['GET','POST','PUT','PATCH','DELETE'] as const;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, flex:1, minHeight:0 }}>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {METHODS.map(m => (
            <button key={m} onClick={() => setMethod(m)} className="hud-label"
              style={{ padding:'4px 10px', fontSize:8, cursor:'pointer', letterSpacing:'0.14em',
                border:`1px solid ${method===m ? CYAN : 'rgba(255,255,255,0.1)'}`,
                color: method===m ? CYAN : 'rgba(255,255,255,0.4)',
                background: method===m ? `${CYAN}14` : 'transparent' }}>
              {m}
            </button>
          ))}
        </div>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.example.com/endpoint"
          onKeyDown={e => e.key==='Enter' && send()}
          style={{ padding:'8px 12px', background:'rgba(255,255,255,0.04)', border:`1px solid ${CYAN}33`, color:'rgba(255,255,255,0.85)', fontFamily:'var(--font-mono)', fontSize:11, outline:'none' }} />
        <div>
          <div className="hud-label" style={{ fontSize:7.5, color:'rgba(255,255,255,0.35)', marginBottom:4, letterSpacing:'0.2em' }}>HEADERS (one per line: Key: Value)</div>
          <textarea value={headers} onChange={e => setHeaders(e.target.value)} rows={3}
            style={{ width:'100%', padding:'6px 10px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', fontFamily:'var(--font-mono)', fontSize:9.5, resize:'none', outline:'none' }} />
        </div>
        {['POST','PUT','PATCH'].includes(method) && (
          <div>
            <div className="hud-label" style={{ fontSize:7.5, color:'rgba(255,255,255,0.35)', marginBottom:4, letterSpacing:'0.2em' }}>REQUEST BODY (JSON)</div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
              style={{ width:'100%', padding:'6px 10px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', fontFamily:'var(--font-mono)', fontSize:9.5, resize:'none', outline:'none' }} />
          </div>
        )}
        <button onClick={send} disabled={busy||!url.trim()} className="hud-label"
          style={{ padding:'9px', fontSize:9, color:JADE, border:`1px solid ${JADE}`, cursor:'pointer', letterSpacing:'0.24em', background:`${JADE}12` }}>
          {busy ? '◌ SENDING…' : `▶ ${method} REQUEST`}
        </button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6, minHeight:0 }}>
        {err && <div className="font-mono" style={{ fontSize:10, color:ROSE, padding:'8px', border:`1px solid ${ROSE}30`, background:`${ROSE}08` }}>✗ {err}</div>}
        {response && (
          <>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <span className="hud-label" style={{ fontSize:14, color:statusColor(response.status) }}>{response.status}</span>
              <span className="font-mono" style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>{response.time}ms</span>
            </div>
            <pre className="nx-scroll" style={{ flex:1, overflow:'auto', padding:'10px', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.75)', fontFamily:'var(--font-mono)', fontSize:10.5, lineHeight:1.55, whiteSpace:'pre-wrap', wordBreak:'break-all', margin:0 }}>
              {response.body}
            </pre>
          </>
        )}
        {!response && !err && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.15)', fontSize:11, fontFamily:'var(--font-mono)' }}>
            Response will appear here
          </div>
        )}
      </div>
    </div>
  );
}

/* ── DEV TOOLS TAB ─────────────────────────────────────────────────────────── */
function ToolsTab() {
  const [jsonIn, setJsonIn]       = useState('');
  const [jsonOut, setJsonOut]     = useState('');
  const [b64Input, setB64Input]   = useState('');
  const [b64Out, setB64Out]       = useState('');
  const [b64Mode, setB64Mode]     = useState<'encode'|'decode'>('encode');
  const [hashIn, setHashIn]       = useState('');
  const [hashOut, setHashOut]     = useState('');
  const [regexPat, setRegexPat]   = useState('');
  const [regexText, setRegexText] = useState('');
  const [regexOut, setRegexOut]   = useState('');

  function formatJson() {
    try { setJsonOut(JSON.stringify(JSON.parse(jsonIn), null, 2)); }
    catch(e:any) { setJsonOut(`// Parse error: ${e.message}`); }
  }
  function minifyJson() {
    try { setJsonOut(JSON.stringify(JSON.parse(jsonIn))); }
    catch(e:any) { setJsonOut(`// Parse error: ${e.message}`); }
  }
  function doB64() {
    try {
      if (b64Mode === 'encode') setB64Out(btoa(b64Input));
      else setB64Out(atob(b64Input));
    } catch(e:any) { setB64Out(`Error: ${e.message}`); }
  }
  function doHash() {
    // Simple FNV-1a hash (no SubtleCrypto for sync UX)
    let hash = 2166136261;
    for (let i = 0; i < hashIn.length; i++) {
      hash ^= hashIn.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    setHashOut(`FNV-1a(32): 0x${hash.toString(16).toUpperCase().padStart(8,'0')}\nLength: ${hashIn.length} chars`);
  }
  function testRegex() {
    try {
      const rx = new RegExp(regexPat, 'gm');
      const matches = [...regexText.matchAll(rx)];
      if (!matches.length) { setRegexOut('No matches'); return; }
      setRegexOut(matches.map((m,i) => `Match ${i+1}: "${m[0]}" @ index ${m.index}${m.slice(1).length ? '\n  Groups: ' + m.slice(1).join(', ') : ''}`).join('\n'));
    } catch(e:any) { setRegexOut(`Invalid regex: ${e.message}`); }
  }

  const panelStyle = { display:'flex', flexDirection:'column' as const, gap:6, padding:'10px 12px', border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.02)' };
  const labelStyle = { fontSize:7.5, color: CYAN, letterSpacing:'0.2em', fontFamily:'var(--font-mono)', marginBottom:4 } as React.CSSProperties;
  const taStyle = { width:'100%', padding:'6px 10px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.8)', fontFamily:'var(--font-mono)', fontSize:10, resize:'none' as const, outline:'none' };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, flex:1, minHeight:0, overflowY:'auto' }} className="nx-scroll">
      {/* JSON Formatter */}
      <div style={panelStyle}>
        <div className="hud-label" style={labelStyle}>◈ JSON FORMATTER</div>
        <textarea value={jsonIn} onChange={e=>setJsonIn(e.target.value)} rows={6} placeholder='{"key":"value"}' style={taStyle} />
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={formatJson} className="hud-label" style={{ flex:1, padding:'5px', fontSize:8, color:JADE, border:`1px solid ${JADE}40`, cursor:'pointer', background:`${JADE}10`, letterSpacing:'0.16em' }}>PRETTY</button>
          <button onClick={minifyJson} className="hud-label" style={{ flex:1, padding:'5px', fontSize:8, color:AMBER, border:`1px solid ${AMBER}40`, cursor:'pointer', background:`${AMBER}10`, letterSpacing:'0.16em' }}>MINIFY</button>
        </div>
        <textarea value={jsonOut} readOnly rows={6} style={{ ...taStyle, color: jsonOut.startsWith('//') ? ROSE : JADE, cursor:'text' }} />
      </div>

      {/* Base64 */}
      <div style={panelStyle}>
        <div className="hud-label" style={labelStyle}>◉ BASE64 ENCODER / DECODER</div>
        <div style={{ display:'flex', gap:4 }}>
          {(['encode','decode'] as const).map(m => (
            <button key={m} onClick={() => setB64Mode(m)} className="hud-label"
              style={{ flex:1, padding:'4px', fontSize:8, cursor:'pointer', letterSpacing:'0.18em',
                border:`1px solid ${b64Mode===m?CYAN:'rgba(255,255,255,0.1)'}`,
                color: b64Mode===m?CYAN:'rgba(255,255,255,0.35)',
                background: b64Mode===m?`${CYAN}14`:'transparent' }}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <textarea value={b64Input} onChange={e=>setB64Input(e.target.value)} rows={4} placeholder="Input text…" style={taStyle} />
        <button onClick={doB64} className="hud-label" style={{ padding:'5px', fontSize:8, color:CYAN, border:`1px solid ${CYAN}40`, cursor:'pointer', background:`${CYAN}10`, letterSpacing:'0.18em' }}>▶ {b64Mode.toUpperCase()}</button>
        <textarea value={b64Out} readOnly rows={4} style={{ ...taStyle, color:CYAN_BRIGHT, cursor:'text' }} />
      </div>

      {/* Hash */}
      <div style={panelStyle}>
        <div className="hud-label" style={labelStyle}>◆ HASH GENERATOR</div>
        <textarea value={hashIn} onChange={e=>setHashIn(e.target.value)} rows={4} placeholder="Input to hash…" style={taStyle} />
        <button onClick={doHash} className="hud-label" style={{ padding:'5px', fontSize:8, color:VIOLET, border:`1px solid ${VIOLET}40`, cursor:'pointer', background:`${VIOLET}10`, letterSpacing:'0.18em' }}>▶ HASH</button>
        <pre style={{ color:VIOLET, fontSize:10, fontFamily:'var(--font-mono)', padding:'6px 10px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.07)', margin:0, whiteSpace:'pre-wrap' }}>{hashOut||'Result will appear here…'}</pre>
      </div>

      {/* Regex Tester */}
      <div style={panelStyle}>
        <div className="hud-label" style={labelStyle}>◎ REGEX TESTER</div>
        <input value={regexPat} onChange={e=>setRegexPat(e.target.value)} placeholder="Pattern (without /slashes/)"
          style={{ padding:'6px 10px', background:'rgba(0,0,0,0.3)', border:`1px solid ${AMBER}30`, color:AMBER, fontFamily:'var(--font-mono)', fontSize:11, outline:'none' }} />
        <textarea value={regexText} onChange={e=>setRegexText(e.target.value)} rows={4} placeholder="Test string here…" style={taStyle} />
        <button onClick={testRegex} className="hud-label" style={{ padding:'5px', fontSize:8, color:AMBER, border:`1px solid ${AMBER}40`, cursor:'pointer', background:`${AMBER}10`, letterSpacing:'0.18em' }}>▶ TEST</button>
        <pre style={{ color: regexOut==='No matches' ? ROSE : JADE, fontSize:10, fontFamily:'var(--font-mono)', padding:'6px 10px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.07)', margin:0, whiteSpace:'pre-wrap', minHeight:40 }}>{regexOut||'Results…'}</pre>
      </div>
    </div>
  );
}

/* ── JARVIS CHAT TAB ──────────────────────────────────────────────────────── */
function JarvisTab({ state, setState }: { state: import('../components/shell').OSState; setState: (s: import('../components/shell').OSState) => void }) {
  const [history, setHistory] = useState<ConsoleLine[]>(() => lsGet<ConsoleLine[]>(LS.console, CONSOLE_LOG as ConsoleLine[]));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const userMsg: ConsoleLine = { who: 'OPERATOR', t: ts, text };
    const next = [...history, userMsg];
    setHistory(next);
    setInput('');
    setBusy(true);
    setState('processing');
    const sid = 'cc-' + Date.now();
    let acc = '';
    setStreamText('');
    try {
      window.jarvisBridge.onStreamChunk((d) => {
        if (d.id !== sid) return;
        acc += d.text;
        setStreamText(acc);
      });
      const trimmed = next.slice(-12);
      const messages = trimmed.map<{ role: 'user' | 'assistant'; content: string }>(m => ({
        role: m.who === 'OPERATOR' ? 'user' : 'assistant', content: m.text,
      }));
      const context = lsGet(LS.context, DEFAULT_CONTEXT);
      const sys = JARVIS_PERSONA + '\n\nOPERATOR CONTEXT\n' + context;
      const reply = await window.jarvisBridge.completeStream({ messages, system: sys, maxTokens: 700 }, sid);
      window.jarvisBridge.offStreamChunk();
      setStreamText('');
      const ts2 = `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}:${String(new Date().getSeconds()).padStart(2,'0')}`;
      const final = [...next, { who: 'JARVIS' as const, t: ts2, text: reply || acc }];
      setHistory(final);
      lsSet(LS.console, final.slice(-40));
      setState('speaking');
      setTimeout(() => setState('idle'), 1200);
    } catch (e: any) {
      window.jarvisBridge.offStreamChunk();
      setStreamText('');
      const final = [...next, { who: 'JARVIS' as const, t: ts, text: `⚠ Verbindung zur Brücke verloren: ${e?.message || e}` }];
      setHistory(final);
      setState('idle');
    }
    setBusy(false);
    if (taRef.current) taRef.current.focus();
  }

  function clearHist() { if (!confirm('Console history löschen?')) return; setHistory([]); lsSet(LS.console, []); }
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }

  const suggestions = ['Status briefing.','Was sind die 3 wichtigsten Themen für heute?','Plan mir den Tag — 4 deep-work blocks.','Erklär mir kurz MiCA Phase-2 in 3 Bullets.','Welche AI-Tools sollte ich diese Woche evaluieren?'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, flex: 1, minHeight: 0 }}>
      <HoloPanel label="TRANSCRIPT · LIVE" code="TR-Λ" status="live" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div ref={scrollRef} className="nx-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 8 }}>
          {history.map((l, i) => {
            const isJ = l.who === 'JARVIS';
            return (
              <div key={i} className="anim-fade-up" style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 10 }}>
                <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', textAlign: 'right', paddingTop: 2 }}>{l.t}</div>
                <div>
                  <div className="hud-label" style={{ fontSize: 9, color: isJ ? CYAN_BRIGHT : AMBER, letterSpacing: '0.32em' }}>// {l.who}</div>
                  <div className="font-mono" style={{ fontSize: 12, color: isJ ? 'var(--fg)' : 'var(--fg-dim)', marginTop: 4, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{l.text}</div>
                </div>
              </div>
            );
          })}
          {busy && (
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 10 }}>
              <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', textAlign: 'right' }}>—:—:—</div>
              <div>
                <div className="hud-label" style={{ fontSize: 9, color: CYAN_BRIGHT }}>// JARVIS</div>
                {streamText ? (
                  <div className="font-mono" style={{ fontSize: 12, color: 'var(--fg)', marginTop: 4, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {streamText}<span className="anim-pulse-soft" style={{ color: CYAN }}>▊</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Waveform active bars={32} height={20} />
                    <span className="font-mono anim-flicker" style={{ fontSize: 10, color: VIOLET, letterSpacing: '0.32em' }}>// PROCESSING</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {suggestions.map(s => (
              <button key={s} onClick={() => { setInput(s); taRef.current?.focus(); }} className="font-mono"
                style={{ fontSize: 9.5, padding: '4px 8px', border: '1px solid var(--line-soft)', color: 'var(--cyan-dim)', background: 'transparent' }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ width: 12, height: 12, borderRadius: 99, background: busy ? VIOLET : CYAN, boxShadow: `0 0 10px ${busy ? VIOLET : CYAN}` }} className="anim-pulse-soft" />
            <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              placeholder="// directive… (Enter to send, Shift+Enter for newline)"
              style={{ flex: 1, minHeight: 48, maxHeight: 120, padding: 10, background: 'oklch(0.10 0.018 240 / 0.6)', border: `1px solid ${busy ? VIOLET : 'var(--line)'}`, color: 'var(--fg)', fontFamily: 'JetBrains Mono', fontSize: 12, lineHeight: 1.5, outline: 'none', resize: 'none' }} />
            <button onClick={send} disabled={busy || !input.trim()} className="hud-label"
              style={{ padding: '12px 20px', fontSize: 10, letterSpacing: '0.32em', color: busy ? 'var(--cyan-dim)' : CYAN_BRIGHT, background: 'oklch(0.78 0.13 215 / 0.14)', border: `1px solid ${CYAN}`, cursor: busy ? 'wait' : 'pointer', boxShadow: `0 0 10px ${CYAN}55`, textShadow: busy ? 'none' : `0 0 6px ${CYAN}`, alignSelf: 'stretch' }}>
              {busy ? '◌' : '▶ SEND'}
            </button>
          </div>
          <button onClick={clearHist} className="hud-label" style={{ marginTop:6, padding:'3px 10px', fontSize:7.5, color:'rgba(255,255,255,0.3)', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer', background:'transparent', letterSpacing:'0.18em' }}>✕ CLEAR HISTORY</button>
        </div>
      </HoloPanel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <HoloPanel label="OPERATOR CONTEXT" code="CTX-Δ"><ContextEditor /></HoloPanel>
        <HoloPanel label="JARVIS STATE" code="ST-Δ" style={{ flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <VoiceOrb state={busy ? 'processing' : state} size={200} />
            <div className="hud-label glow-cyan-sm anim-flicker" style={{ fontSize: 11, color: CYAN_BRIGHT, letterSpacing: '0.4em' }}>// {(busy ? 'PROCESSING' : state).toUpperCase()}</div>
            <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)', textAlign: 'center', lineHeight: 1.5 }}>Verbunden mit Claude (haiku-4-5).<br/>Persona aktiv · Kontext geladen.</div>
          </div>
        </HoloPanel>
      </div>
    </div>
  );
}

/* ── Main ConsoleScreen ────────────────────────────────────────────────────── */
export default function ConsoleScreen({ state, setState }: ScreenProps) {
  const [tab, setTab] = useState<ConsoleTab>('JARVIS');

  const CONSOLE_DEFAULT_TABS: DragTab[] = [
    { id:'JARVIS',   label:'◎ JARVIS AI',   color: CYAN,   pinned: true },
    { id:'TERMINAL', label:'▣ TERMINAL',     color: JADE },
    { id:'HTTP',     label:'⬡ HTTP CLIENT', color: AMBER },
    { id:'TOOLS',    label:'◆ DEV TOOLS',   color: VIOLET },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <ScreenHeader
        tag="CONSOLE"
        title="DEVELOPER ELITE MODE"
        subtitle="JARVIS AI · Shell Terminal · HTTP Client · Dev Tools"
      />

      <DraggableTabs
        storageKey="jarvis.tabs.console"
        defaultTabs={CONSOLE_DEFAULT_TABS}
        active={tab}
        onActivate={id => setTab(id as ConsoleTab)}
      />

      {tab === 'JARVIS'   && <JarvisTab state={state} setState={setState} />}
      {tab === 'TERMINAL' && <TerminalTab />}
      {tab === 'HTTP'     && <HttpTab />}
      {tab === 'TOOLS'    && <ToolsTab />}
    </div>
  );
}


