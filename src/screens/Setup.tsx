import { useState } from 'react';
import { CYAN_BRIGHT, CYAN, AMBER, JADE, VIOLET, ROSE } from '../theme';

const LS_KEY = 'jarvis.setupDone';
export function isSetupDone() { return localStorage.getItem(LS_KEY) === '1'; }
export function markSetupDone() { localStorage.setItem(LS_KEY, '1'); }

interface Step {
  id: string;
  title: string;
  sub: string;
  color: string;
  optional?: boolean;
  content: (next: () => void, skip: () => void) => React.ReactNode;
}

export default function SetupWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Record<string, 'idle'|'saving'|'saved'|'err'>>({});
  const [vals, setVals] = useState<Record<string, string>>({});

  function sv(key: string, val: string) { setVals(v => ({ ...v, [key]: val })); }

  async function saveKey(name: string, val: string, storeKey: string) {
    if (!val.trim()) return;
    setStatus(s => ({ ...s, [name]: 'saving' }));
    try {
      await window.jarvisBridge.config.setKey(storeKey, val.trim());
      setStatus(s => ({ ...s, [name]: 'saved' }));
    } catch {
      setStatus(s => ({ ...s, [name]: 'err' }));
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 12,
    background: 'oklch(0.05 0.01 240 / 0.8)', border: '1px solid var(--line)',
    color: 'var(--fg)', outline: 'none', fontFamily: 'var(--font-mono)',
    boxSizing: 'border-box', letterSpacing: '0.04em',
  };
  const btnStyle = (color: string): React.CSSProperties => ({
    padding: '9px 24px', fontSize: 10, cursor: 'pointer', letterSpacing: '0.2em',
    color, border: `1px solid ${color}66`, background: `${color}14`,
    fontFamily: 'var(--font-mono)', transition: 'all 120ms',
  });
  const labelStyle: React.CSSProperties = {
    fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em',
    fontFamily: 'var(--font-mono)', marginBottom: 4, display: 'block',
  };
  const saveBtn = (name: string, storeKey: string, val: string) => (
    <button onClick={() => saveKey(name, val, storeKey)} className="hud-label"
      style={{ ...btnStyle(JADE), marginTop: 8 }}>
      {status[name] === 'saving' ? 'SAVING…' : status[name] === 'saved' ? '◆ SAVED' : status[name] === 'err' ? '◇ ERROR' : 'SAVE TO KEYCHAIN'}
    </button>
  );

  const STEPS: Step[] = [
    {
      id: 'welcome', title: 'WELCOME TO JARVIS', sub: 'Your private intelligence OS', color: CYAN_BRIGHT,
      content: (next) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center', paddingTop: 24 }}>
          <div className="font-display glow-cyan" style={{ fontSize: 36, color: CYAN_BRIGHT, letterSpacing: '0.3em' }}>JARVIS</div>
          <div className="font-mono" style={{ fontSize: 12, color: 'var(--cyan-dim)', lineHeight: 1.6, maxWidth: 480 }}>
            Operations OS — your personal AI command centre.<br />
            This 3-minute setup connects your AI providers and configures<br />
            the trading bridge. Everything is stored encrypted on this device.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
            {['Claude · Gemini · GPT','MT5 Bridge','Agent Filesystem','Trading Bots'].map(t => (
              <span key={t} className="font-mono" style={{ fontSize: 9.5, padding: '4px 12px', border: '1px solid var(--line-soft)', color: 'var(--cyan-dim)' }}>{t}</span>
            ))}
          </div>
          <button onClick={next} className="hud-label" style={{ ...btnStyle(CYAN_BRIGHT), marginTop: 16, padding: '12px 40px', fontSize: 11 }}>
            BEGIN SETUP ▶
          </button>
        </div>
      ),
    },
    {
      id: 'anthropic', title: 'ANTHROPIC CLAUDE', sub: 'Primary AI engine — required for voice & console', color: '#e879f9',
      content: (next, skip) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--cyan-dim)', lineHeight: 1.6 }}>
            JARVIS uses Claude as its main reasoning engine. Get your API key at
            <span style={{ color: CYAN_BRIGHT }}> console.anthropic.com</span>
          </div>
          <div>
            <label style={labelStyle}>ANTHROPIC API KEY</label>
            <input type="password" value={vals.anthropic ?? ''} onChange={e => sv('anthropic', e.target.value)}
              placeholder="sk-ant-api03-…" style={{ ...inputStyle, borderColor: '#e879f955' }} />
            {saveBtn('anthropic', 'ANTHROPIC_API_KEY', vals.anthropic ?? '')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={skip} style={btnStyle('var(--cyan-dim)')}>SKIP FOR NOW</button>
            <button onClick={next} style={btnStyle(CYAN_BRIGHT)}>CONTINUE ▶</button>
          </div>
        </div>
      ),
    },
    {
      id: 'gemini', title: 'GOOGLE GEMINI', sub: 'Voice transcription engine — optional', color: '#38bdf8', optional: true,
      content: (next, skip) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--cyan-dim)', lineHeight: 1.6 }}>
            Gemini is used for voice audio transcription (Gemini Flash). Get your key at
            <span style={{ color: CYAN_BRIGHT }}> aistudio.google.com</span>
          </div>
          <div>
            <label style={labelStyle}>GEMINI API KEY</label>
            <input type="password" value={vals.gemini ?? ''} onChange={e => sv('gemini', e.target.value)}
              placeholder="AIza…" style={{ ...inputStyle, borderColor: '#38bdf855' }} />
            {saveBtn('gemini', 'GEMINI_API_KEY', vals.gemini ?? '')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={skip} style={btnStyle('var(--cyan-dim)')}>SKIP</button>
            <button onClick={next} style={btnStyle(CYAN_BRIGHT)}>CONTINUE ▶</button>
          </div>
        </div>
      ),
    },
    {
      id: 'ollama', title: 'OLLAMA · LOCAL AI', sub: 'Run models 100% offline — optional', color: VIOLET, optional: true,
      content: (next, skip) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--cyan-dim)', lineHeight: 1.6 }}>
            Ollama lets you run open-source LLMs (Qwen, Llama, Mistral, Whisper) locally with zero data leaving your machine.
            Download from <span style={{ color: VIOLET }}>ollama.com</span> and run <span style={{ color: AMBER }}>ollama serve</span>.
          </div>
          <div>
            <label style={labelStyle}>OLLAMA HOST (default: http://localhost:11434)</label>
            <input type="text" value={vals.ollamaHost ?? 'http://localhost:11434'} onChange={e => sv('ollamaHost', e.target.value)}
              placeholder="http://localhost:11434" style={{ ...inputStyle, borderColor: `${VIOLET}55` }} />
          </div>
          <div>
            <label style={labelStyle}>OLLAMA API KEY (optional — only if you added auth)</label>
            <input type="password" value={vals.ollamaKey ?? ''} onChange={e => sv('ollamaKey', e.target.value)}
              placeholder="Leave blank for local Ollama" style={{ ...inputStyle, borderColor: `${VIOLET}55` }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>DEFAULT LLM MODEL</label>
              <input type="text" value={vals.ollamaModel ?? 'qwen3:latest'} onChange={e => sv('ollamaModel', e.target.value)}
                placeholder="qwen3:latest" style={{ ...inputStyle, borderColor: `${VIOLET}55` }} />
            </div>
            <div>
              <label style={labelStyle}>STT / WHISPER MODEL</label>
              <input type="text" value={vals.ollamaStt ?? 'whisper'} onChange={e => sv('ollamaStt', e.target.value)}
                placeholder="whisper" style={{ ...inputStyle, borderColor: `${VIOLET}55` }} />
            </div>
          </div>
          <button onClick={async () => {
            const host  = vals.ollamaHost  ?? 'http://localhost:11434';
            const key   = vals.ollamaKey   ?? '';
            const model = vals.ollamaModel ?? 'qwen3:latest';
            const stt   = vals.ollamaStt   ?? 'whisper';
            setStatus(s => ({ ...s, ollama: 'saving' }));
            try {
              await Promise.all([
                window.jarvisBridge.config.setKey('OLLAMA_HOST',      host),
                key   ? window.jarvisBridge.config.setKey('OLLAMA_API_KEY',  key)   : Promise.resolve(),
                window.jarvisBridge.config.setKey('OLLAMA_MODEL',     model),
                window.jarvisBridge.config.setKey('OLLAMA_STT_MODEL', stt),
              ]);
              setStatus(s => ({ ...s, ollama: 'saved' }));
            } catch { setStatus(s => ({ ...s, ollama: 'err' })); }
          }} className="hud-label" style={{ ...btnStyle(VIOLET), marginTop: 4 }}>
            {status.ollama === 'saving' ? 'SAVING…' : status.ollama === 'saved' ? '◆ SAVED' : status.ollama === 'err' ? '◇ ERROR' : 'SAVE OLLAMA CONFIG'}
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={skip} style={btnStyle('var(--cyan-dim)')}>SKIP</button>
            <button onClick={next} style={btnStyle(CYAN_BRIGHT)}>CONTINUE ▶</button>
          </div>
        </div>
      ),
    },
    {
      id: 'mt5', title: 'MT5 TRADING BRIDGE', sub: 'ZeusBot live data — optional', color: JADE, optional: true,
      content: (next, skip) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--cyan-dim)', lineHeight: 1.6 }}>
            Connect to your MetaTrader 5 bridge for live positions, P&L and strategy control.
            Start <span style={{ color: JADE }}>mt5_bridge/bridge.py</span> on your MT5 machine first.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>HOST</label>
              <input type="text" value={vals.mt5host ?? 'localhost'} onChange={e => sv('mt5host', e.target.value)}
                placeholder="localhost or 192.168.1.x" style={{ ...inputStyle, borderColor: `${JADE}55` }} />
            </div>
            <div>
              <label style={labelStyle}>PORT</label>
              <input type="text" value={vals.mt5port ?? '1234'} onChange={e => sv('mt5port', e.target.value)}
                placeholder="1234" style={{ ...inputStyle, borderColor: `${JADE}55` }} />
            </div>
          </div>
          <button onClick={async () => {
            const h = vals.mt5host ?? 'localhost';
            const p = parseInt(vals.mt5port ?? '1234', 10);
            setStatus(s => ({ ...s, mt5: 'saving' }));
            try {
              await window.jarvisBridge.config.setMt5(h, p);
              setStatus(s => ({ ...s, mt5: 'saved' }));
            } catch { setStatus(s => ({ ...s, mt5: 'err' })); }
          }} className="hud-label" style={btnStyle(JADE)}>
            {status.mt5 === 'saving' ? 'SAVING…' : status.mt5 === 'saved' ? '◆ SAVED' : 'SAVE MT5 CONFIG'}
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={skip} style={btnStyle('var(--cyan-dim)')}>SKIP</button>
            <button onClick={next} style={btnStyle(CYAN_BRIGHT)}>CONTINUE ▶</button>
          </div>
        </div>
      ),
    },
    {
      id: 'done', title: 'JARVIS IS READY', sub: 'All systems go', color: JADE,
      content: (_, _skip) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center', paddingTop: 24 }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>◆</div>
          <div className="font-display glow-cyan" style={{ fontSize: 24, color: JADE, letterSpacing: '0.3em' }}>ALL SYSTEMS NOMINAL</div>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--cyan-dim)', lineHeight: 1.6, maxWidth: 440 }}>
            Your API keys are encrypted in the OS keychain. You can update them any time via
            <span style={{ color: CYAN_BRIGHT }}> Admin → Connectors</span>.<br /><br />
            Tip: Use <span style={{ color: AMBER }}>Alt+Space</span> to trigger voice from anywhere on your desktop.
            Use <span style={{ color: AMBER }}>Alt+J</span> to show/hide JARVIS.
          </div>
          <button onClick={() => { markSetupDone(); onDone(); }} className="hud-label"
            style={{ ...btnStyle(JADE), marginTop: 16, padding: '12px 40px', fontSize: 11 }}>
            ENTER JARVIS ▶
          </button>
        </div>
      ),
    },
  ];

  const cur = STEPS[step];
  const progress = step / (STEPS.length - 1);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'oklch(0.04 0.012 240 / 0.97)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      {/* Background grid lines */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(oklch(0.78 0.13 215 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.13 215 / 0.04) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 640, position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.4em', marginBottom: 8 }}>
            SETUP WIZARD · STEP {step + 1} / {STEPS.length}
          </div>
          {/* Progress bar */}
          <div style={{ height: 2, background: 'var(--line-soft)', borderRadius: 1, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ height: '100%', width: `${progress * 100}%`, background: cur.color, transition: 'width 0.3s ease', boxShadow: `0 0 8px ${cur.color}` }} />
          </div>
          <div className="font-display" style={{ fontSize: 20, color: cur.color, letterSpacing: '0.22em', marginBottom: 4 }}>{cur.title}</div>
          <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--cyan-dim)' }}>{cur.sub}</div>
        </div>

        {/* Step content */}
        <div style={{ padding: '28px 36px', background: 'oklch(0.07 0.016 240 / 0.9)', border: `1px solid ${cur.color}33` }}>
          {cur.content(
            () => setStep(s => Math.min(s + 1, STEPS.length - 1)),
            () => setStep(s => Math.min(s + 1, STEPS.length - 1)),
          )}
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i <= step ? STEPS[i].color : 'var(--line-soft)', transition: 'all 0.3s' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
