import { useState, useRef, useEffect, useCallback } from 'react';
import { ScreenHeader } from '../components/shell';
import { DraggableTabs, type DragTab } from '../components/draggable';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET } from '../theme';

/* ── Types ─────────────────────────────────────────────────────────────────── */
type AnimTab   = 'RENDER' | 'EDITOR' | 'AGENTS' | 'LIBRARY';
type EffectId  = 'typewriter'|'matrix-rain'|'cascade'|'glitch'|'scan-line'|'neural-build'|'binary-stream'|'hologram';
type LangId    = 'typescript'|'python'|'rust'|'go'|'cpp'|'solidity'|'bash'|'json';

interface AnimEffect {
  id: EffectId; label: string; desc: string;
  speed: number;  // chars/frame
  color: string;
}

interface CodeSnippet {
  id: string; title: string; lang: LangId; code: string;
}

interface AnimAgent {
  id: string; name: string; role: string; color: string; icon: string;
  status: 'ACTIVE'|'IDLE'|'ANALYZING'|'GENERATING';
}

/* ── Constants ─────────────────────────────────────────────────────────────── */
const EFFECTS: AnimEffect[] = [
  { id:'typewriter',   label:'Typewriter',    desc:'Classic typing reveal with cursor blink',    speed:2,  color:CYAN_BRIGHT },
  { id:'cascade',      label:'Cascade Drop',  desc:'Characters cascade from top like rain',       speed:3,  color:JADE },
  { id:'matrix-rain',  label:'Matrix Rain',   desc:'Green matrix-style character waterfall',      speed:4,  color:'#00ff41' },
  { id:'glitch',       label:'Glitch Burst',  desc:'Corrupted reveal with noise artifacts',       speed:5,  color:ROSE },
  { id:'scan-line',    label:'Scan Line',     desc:'Horizontal scan reveals code progressively',  speed:2,  color:AMBER },
  { id:'neural-build', label:'Neural Build',  desc:'Code assembles token-by-token, AI-style',    speed:1,  color:VIOLET },
  { id:'binary-stream',label:'Binary Stream', desc:'Binary → decoded → final code reveal',        speed:6,  color:CYAN },
  { id:'hologram',     label:'Hologram',      desc:'3D holographic flicker stabilization',        speed:3,  color:'#7dd3fc' },
];

const LANG_COLOR: Record<LangId, string> = {
  typescript: '#3178c6', python: '#f7c948', rust: '#f97316',
  go: '#00acd7', cpp: '#659ad2', solidity: '#9b59b6', bash: '#6ee7b7', json: '#fbbf24',
};

const SNIPPET_LIBRARY: CodeSnippet[] = [
  { id:'ts1', title:'JARVIS Agent Loop', lang:'typescript', code:
`async function runAgentLoop(task: string) {
  const agents = await spawnAgentTeam(task);
  const context = await gatherContext(task);

  while (!isTaskComplete(context)) {
    const agent = selectBestAgent(agents, context);
    const action = await agent.plan(context);
    const result = await executeAction(action);
    context = await updateContext(context, result);
    await logToOrchestra(agent.id, result);
  }

  return synthesizeResult(context);
}` },
  { id:'py1', title:'Neural Signal Detector', lang:'python', code:
`import numpy as np
from sklearn.ensemble import IsolationForest

class SignalDetector:
    def __init__(self, contamination=0.05):
        self.model = IsolationForest(
            contamination=contamination,
            n_estimators=200,
            random_state=42
        )

    def fit(self, market_data: np.ndarray):
        features = self._extract_features(market_data)
        self.model.fit(features)
        return self

    def detect(self, candle: dict) -> float:
        features = self._extract_features([candle])
        score = self.model.decision_function(features)[0]
        return float(1 / (1 + np.exp(-score * 5)))` },
  { id:'rs1', title:'Concurrent Task Executor', lang:'rust', code:
`use tokio::sync::mpsc;
use std::sync::Arc;

pub struct TaskExecutor {
    workers: usize,
    tx: mpsc::Sender<Box<dyn Task + Send>>,
}

impl TaskExecutor {
    pub fn new(workers: usize) -> Self {
        let (tx, mut rx) = mpsc::channel(1024);
        for _ in 0..workers {
            tokio::spawn(async move {
                while let Some(task) = rx.recv().await {
                    task.execute().await;
                }
            });
        }
        Self { workers, tx }
    }
}` },
  { id:'go1', title:'HTTP Middleware Chain', lang:'go', code:
`func Chain(h http.Handler, middlewares ...Middleware) http.Handler {
    for i := len(middlewares) - 1; i >= 0; i-- {
        h = middlewares[i](h)
    }
    return h
}

func LogRequests(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
    })
}` },
  { id:'sh1', title:'JARVIS Deploy Script', lang:'bash', code:
`#!/bin/bash
set -euo pipefail

APP_NAME="jarvis-ops"
BUILD_DIR="./dist"

echo "◆ Building $APP_NAME..."
pnpm build

echo "◉ Running health checks..."
curl -sf http://localhost:3000/health || exit 1

echo "▶ Deploying..."
pm2 reload ecosystem.config.cjs --update-env

echo "✓ Deploy complete: $(date -u +%Y-%m-%dT%H:%M:%SZ)"` },
];

const ANIM_AGENTS: AnimAgent[] = [
  { id:'director',    name:'DIRECTOR',    role:'Orchestrates animation sequences',             color:CYAN_BRIGHT, icon:'◆', status:'ACTIVE' },
  { id:'typer',       name:'TYPE-MASTER', role:'Controls typewriter timing + cursor logic',    color:JADE,        icon:'◈', status:'IDLE' },
  { id:'glitcher',    name:'GLITCH-OP',   role:'Generates noise, artifacts, and corruption',   color:ROSE,        icon:'⚡', status:'IDLE' },
  { id:'colorist',    name:'COLORIST',    role:'Syntax highlighting + color grading',          color:AMBER,       icon:'▣', status:'ANALYZING' },
  { id:'compositor',  name:'COMPOSITOR',  role:'Layers effects, manages Z-ordering + blend',  color:VIOLET,      icon:'◉', status:'IDLE' },
  { id:'scriptor',    name:'CODE-GEN',    role:'Generates/transforms code for animation',      color:'#7dd3fc',   icon:'▤', status:'GENERATING' },
  { id:'renderer',    name:'RENDERER',    role:'Exports to canvas, GIF, MP4, SVG paths',       color:'#f0abfc',   icon:'◎', status:'IDLE' },
];

/* ── Render/Canvas Component ─────────────────────────────────────────────────── */
function useAnimationCanvas(
  code: string,
  effect: EffectId,
  isPlaying: boolean,
  syntaxColor: boolean,
  lang: LangId,
) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const frameRef   = useRef<number>(0);
  const progRef    = useRef<number>(0);
  const glitchRef  = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) return;
    progRef.current = 0;
    glitchRef.current = 0;
  }, [isPlaying, code, effect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;

    const FONT_SIZE = 13;
    const LINE_H    = 20;
    const PAD_X     = 18;
    const PAD_Y     = 22;
    const CHAR_W    = 8;
    const lines     = code.split('\n');
    const totalChars = code.replace(/\n/g, '').length;

    const effectColor = EFFECTS.find(e => e.id === effect)?.color ?? CYAN;
    const lc = LANG_COLOR[lang];

    function hexA(hex: string, alpha: number) {
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return `rgba(${r},${g},${b},${alpha})`;
    }

    function drawBackground() {
      ctx.fillStyle = '#030810';
      ctx.fillRect(0, 0, W, H);
      // scanline overlay
      for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(0, y, W, 1);
      }
      // vignette
      const grad = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.9);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    function syntaxColor(char: string, lineStr: string, charIdx: number) {
      if (!syntaxColor) return effectColor;
      // simple keyword detection
      const keywords = ['function','async','await','const','let','var','if','else','for','while','return','import','export','class','interface','type','pub','fn','struct','def','self','True','False','None'];
      const word = lineStr.slice(Math.max(0,charIdx-10), charIdx+1).match(/\w+$/)?.[0] ?? '';
      if (keywords.includes(word)) return AMBER;
      if (char === '"' || char === "'" || char === '`') return JADE;
      if (/[0-9]/.test(char)) return ROSE;
      if (/[{}()[\];:,<>]/.test(char)) return hexA(effectColor, 0.5);
      return effectColor;
    }

    function drawGlow(x: number, y: number, text: string, color: string) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
    }

    function drawTypewriter(progress: number) {
      drawBackground();
      ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
      let rendered = 0;
      const charsToShow = Math.floor(progress * totalChars);
      for (let li = 0; li < lines.length; li++) {
        const lStr = lines[li];
        const y = PAD_Y + li * LINE_H;
        if (y > H) break;
        for (let ci = 0; ci < lStr.length; ci++) {
          if (rendered >= charsToShow) {
            // blinking cursor
            if (Math.floor(Date.now()/400) % 2 === 0) {
              ctx.fillStyle = effectColor;
              ctx.fillRect(PAD_X + ci * CHAR_W - 1, y - FONT_SIZE + 2, 2, FONT_SIZE);
            }
            return;
          }
          const ch = lStr[ci];
          const cc = syntaxColor(ch, lStr, ci);
          drawGlow(PAD_X + ci * CHAR_W, y, ch, cc);
          rendered++;
        }
      }
    }

    function drawMatrixRain(frame: number) {
      ctx.fillStyle = 'rgba(3,8,16,0.15)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
      const cols = Math.floor(W / CHAR_W);
      for (let c = 0; c < cols; c++) {
        const rainY = ((frame * 3 + c * 37) % (H + 100)) - 50;
        const char  = lines[Math.floor(Math.random()*lines.length)]?.[Math.floor(Math.random()*40)] ?? String.fromCharCode(0x30A0 + Math.random()*96);
        const alpha = 1 - (rainY / H);
        ctx.fillStyle = `rgba(0,255,65,${Math.max(0.05,alpha)})`;
        ctx.shadowBlur = rainY < H*0.3 ? 18 : 4;
        ctx.shadowColor = '#00ff41';
        ctx.fillText(char, c * CHAR_W, rainY);
        ctx.shadowBlur = 0;
      }
      // draw code on top (dimly)
      ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
      lines.forEach((lStr, li) => {
        const y = PAD_Y + li * LINE_H;
        ctx.fillStyle = hexA(effectColor, 0.6);
        ctx.fillText(lStr, PAD_X, y);
      });
    }

    function drawGlitch(progress: number, frame: number) {
      drawBackground();
      ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
      const charsToShow = Math.floor(progress * totalChars);
      let rendered = 0;
      lines.forEach((lStr, li) => {
        const y = PAD_Y + li * LINE_H;
        if (y > H) return;
        for (let ci = 0; ci < lStr.length; ci++) {
          if (rendered >= charsToShow) return;
          const ch = lStr[ci];
          const isGlitch = Math.random() < 0.03;
          if (isGlitch) {
            const gc = String.fromCharCode(0x2580 + Math.floor(Math.random()*32));
            ctx.fillStyle = ROSE;
            ctx.shadowBlur = 6; ctx.shadowColor = ROSE;
            ctx.fillText(gc, PAD_X + ci * CHAR_W + (Math.random()-0.5)*4, y + (Math.random()-0.5)*3);
            ctx.shadowBlur = 0;
          } else {
            drawGlow(PAD_X + ci * CHAR_W, y, ch, syntaxColor(ch, lStr, ci));
          }
          rendered++;
        }
      });
      // glitch bars
      if (frame % 8 < 2) {
        const barY = Math.random() * H;
        ctx.fillStyle = hexA(ROSE, 0.08);
        ctx.fillRect(0, barY, W, 3 + Math.random()*10);
      }
    }

    function drawScanLine(progress: number) {
      drawBackground();
      ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
      const scanY = progress * (H + LINE_H);
      lines.forEach((lStr, li) => {
        const y = PAD_Y + li * LINE_H;
        if (y > scanY || y > H) return;
        const distFromScan = Math.abs(y - scanY);
        const alpha = Math.min(1, 1 - distFromScan / (LINE_H * 6));
        for (let ci = 0; ci < lStr.length; ci++) {
          const ch = lStr[ci];
          const base = syntaxColor(ch, lStr, ci);
          ctx.fillStyle = hexA(base, alpha);
          ctx.shadowBlur = distFromScan < LINE_H ? 10 : 0;
          ctx.shadowColor = effectColor;
          ctx.fillText(ch, PAD_X + ci * CHAR_W, y);
          ctx.shadowBlur = 0;
        }
      });
      // scan glow
      ctx.fillStyle = hexA(effectColor, 0.25);
      ctx.fillRect(0, scanY - 2, W, 4);
      ctx.shadowBlur = 20; ctx.shadowColor = effectColor;
      ctx.fillStyle = hexA(effectColor, 0.08);
      ctx.fillRect(0, scanY - 12, W, 24);
      ctx.shadowBlur = 0;
    }

    function drawNeuralBuild(progress: number, frame: number) {
      drawBackground();
      ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
      const tokens = code.split(/(\s+|\b)/);
      let cx = PAD_X, cy = PAD_Y, tCount = 0;
      const tokensToShow = Math.floor(progress * tokens.length);
      for (const tok of tokens) {
        if (tCount >= tokensToShow) {
          // flicker cursor
          if (Math.floor(Date.now()/300)%2===0) {
            ctx.fillStyle = hexA(VIOLET, 0.9);
            ctx.fillRect(cx, cy - FONT_SIZE + 2, 7, FONT_SIZE + 2);
          }
          break;
        }
        if (tok.includes('\n')) { cy += LINE_H * tok.split('\n').length - 1; cx = PAD_X; }
        else {
          const cc = tok.match(/^(function|async|const|let|return|import|export|def|pub|fn)$/) ? AMBER : VIOLET;
          ctx.fillStyle = hexA(cc, 0.88);
          ctx.shadowBlur = 8; ctx.shadowColor = VIOLET;
          ctx.fillText(tok, cx, cy);
          ctx.shadowBlur = 0;
          cx += ctx.measureText(tok).width;
          if (cx > W - PAD_X) { cx = PAD_X; cy += LINE_H; }
        }
        tCount++;
      }
    }

    function drawBinaryStream(progress: number, frame: number) {
      drawBackground();
      ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
      const phase = progress < 0.4 ? 'binary' : progress < 0.7 ? 'decode' : 'final';
      lines.forEach((lStr, li) => {
        const y = PAD_Y + li * LINE_H;
        if (y > H) return;
        for (let ci = 0; ci < lStr.length; ci++) {
          const x = PAD_X + ci * CHAR_W;
          const ch = lStr[ci];
          if (phase === 'binary') {
            ctx.fillStyle = hexA(CYAN, 0.4);
            ctx.fillText(Math.random()>0.5?'1':'0', x, y);
          } else if (phase === 'decode') {
            const ratio = (progress - 0.4) / 0.3;
            ctx.fillStyle = hexA(CYAN_BRIGHT, 0.7);
            ctx.fillText(ratio > Math.random() ? ch : (Math.random()>0.5?'1':'0'), x, y);
          } else {
            drawGlow(x, y, ch, syntaxColor(ch, lStr, ci));
          }
        }
      });
    }

    function drawHologram(progress: number, frame: number) {
      drawBackground();
      ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
      const flicker = 0.7 + 0.3 * Math.sin(frame * 0.3);
      const charsToShow = Math.floor(progress * totalChars);
      let rendered = 0;
      // Horizontal lines (hologram grid)
      for (let y = 0; y < H; y += 8) {
        ctx.fillStyle = `rgba(100,200,255,0.03)`;
        ctx.fillRect(0, y, W, 1);
      }
      lines.forEach((lStr, li) => {
        const y = PAD_Y + li * LINE_H;
        if (y > H) return;
        for (let ci = 0; ci < lStr.length; ci++) {
          if (rendered >= charsToShow) return;
          const ch = lStr[ci];
          const xOff = (Math.random()-0.5) * (1-progress) * 6;
          const alpha = flicker * Math.min(1, progress * 2);
          ctx.fillStyle = `rgba(100,200,255,${alpha})`;
          ctx.shadowBlur = 14; ctx.shadowColor = '#7dd3fc';
          ctx.fillText(ch, PAD_X + ci * CHAR_W + xOff, y);
          ctx.shadowBlur = 0;
          rendered++;
        }
      });
      // scanline sweep
      const swY = (frame * 2) % H;
      ctx.fillStyle = 'rgba(100,200,255,0.06)';
      ctx.fillRect(0, swY, W, 3);
    }

    function render(frame: number) {
      if (!isPlaying) {
        // show static full code
        drawBackground();
        ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
        lines.forEach((lStr, li) => {
          const y = PAD_Y + li * LINE_H;
          if (y > H) return;
          for (let ci = 0; ci < lStr.length; ci++) {
            drawGlow(PAD_X + ci * CHAR_W, y, lStr[ci], hexA(effectColor, 0.55));
          }
        });
        return;
      }

      progRef.current = Math.min(1, progRef.current + (0.004 * (EFFECTS.find(e=>e.id===effect)?.speed ?? 2)));
      const p = progRef.current;

      switch(effect) {
        case 'typewriter':    drawTypewriter(p); break;
        case 'matrix-rain':   drawMatrixRain(frame); break;
        case 'cascade':       drawScanLine(p); break;
        case 'glitch':        drawGlitch(p, frame); break;
        case 'scan-line':     drawScanLine(p); break;
        case 'neural-build':  drawNeuralBuild(p, frame); break;
        case 'binary-stream': drawBinaryStream(p, frame); break;
        case 'hologram':      drawHologram(p, frame); break;
        default:              drawTypewriter(p);
      }

      if (p >= 1) progRef.current = 0; // loop
    }

    let frame = 0;
    function loop() {
      render(frame++);
      frameRef.current = requestAnimationFrame(loop);
    }
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [code, effect, isPlaying, syntaxColor, lang]);

  return canvasRef;
}

/* ── RENDER Tab ─────────────────────────────────────────────────────────────── */
function RenderTab() {
  const [effect, setEffect]     = useState<EffectId>('typewriter');
  const [snippet, setSnippet]   = useState<CodeSnippet>(SNIPPET_LIBRARY[0]);
  const [isPlaying, setPlaying] = useState(false);
  const [syntaxOn, setSyntaxOn] = useState(true);
  const [speed, setSpeed]       = useState(1);
  const [recording, setRecording] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const canvasRef = useAnimationCanvas(snippet.code, effect, isPlaying, syntaxOn, snippet.lang);

  function exportPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `jarvis-animation-${effect}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function startRecording() {
    const canvas = canvasRef.current;
    if (!canvas || recording) return;
    try {
      const stream = canvas.captureStream(30);
      const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `jarvis-animation-${effect}-${Date.now()}.webm`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        setRecording(false);
      };
      mr.start();
      mediaRecRef.current = mr;
      setRecording(true);
      setPlaying(true);
    } catch { /* MediaRecorder not supported */ }
  }

  function stopRecording() {
    mediaRecRef.current?.stop();
    setPlaying(false);
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:10, flex:1, minHeight:0 }}>
      {/* Canvas */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>
        <canvas ref={canvasRef} width={760} height={440}
          style={{ width:'100%', height:'100%', maxHeight:440, border:`1px solid ${EFFECTS.find(e=>e.id===effect)?.color??CYAN}33`, background:'#030810', display:'block' }} />
        {/* Controls */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          <button onClick={() => setPlaying(p => !p)} className="hud-label"
            style={{ padding:'7px 20px', fontSize:9.5, letterSpacing:'0.22em', cursor:'pointer',
              color: isPlaying ? ROSE : JADE, border:`1px solid ${isPlaying?ROSE:JADE}`,
              background: isPlaying ? `${ROSE}12` : `${JADE}12` }}>
            {isPlaying ? '◼ STOP' : '▶ PLAY'}
          </button>
          <button onClick={() => { setPlaying(false); setTimeout(() => setPlaying(true), 50); }} className="hud-label"
            style={{ padding:'7px 14px', fontSize:9.5, letterSpacing:'0.22em', cursor:'pointer', color:AMBER, border:`1px solid ${AMBER}`, background:`${AMBER}12` }}>
            ↺ RESTART
          </button>
          {!recording ? (
            <button onClick={startRecording} className="hud-label"
              style={{ padding:'7px 14px', fontSize:9.5, letterSpacing:'0.22em', cursor:'pointer', color:VIOLET, border:`1px solid ${VIOLET}`, background:`${VIOLET}12` }}>
              ⏺ RECORD
            </button>
          ) : (
            <button onClick={stopRecording} className="hud-label"
              style={{ padding:'7px 14px', fontSize:9.5, letterSpacing:'0.22em', cursor:'pointer', color:ROSE, border:`1px solid ${ROSE}`, background:`${ROSE}12` }}>
              ⏹ STOP · SAVE
            </button>
          )}
          <button onClick={exportPNG} className="hud-label"
            style={{ padding:'7px 14px', fontSize:9.5, letterSpacing:'0.22em', cursor:'pointer', color:CYAN_BRIGHT, border:`1px solid ${CYAN_BRIGHT}`, background:`${CYAN_BRIGHT}12` }}>
            ⬇ PNG
          </button>
          <label className="hud-label" style={{ fontSize:8.5, color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={syntaxOn} onChange={e=>setSyntaxOn(e.target.checked)} />
            SYNTAX COLOR
          </label>
          <div style={{ flex:1 }} />
          <span className="hud-label" style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>
            {snippet.lang.toUpperCase()} · {snippet.code.split('\n').length} lines · {effect.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>
        {/* Effect picker */}
        <div>
          <div className="hud-label" style={{ fontSize:7.5, color:'rgba(255,255,255,0.3)', letterSpacing:'0.2em', marginBottom:6 }}>EFFECT</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {EFFECTS.map(ef => (
              <button key={ef.id} onClick={() => { setEffect(ef.id); setPlaying(false); }} className="hud-label"
                style={{ padding:'6px 10px', textAlign:'left', cursor:'pointer',
                  border:`1px solid ${effect===ef.id ? ef.color : ef.color+'22'}`,
                  background: effect===ef.id ? `${ef.color}15` : 'transparent',
                  color: effect===ef.id ? ef.color : 'rgba(255,255,255,0.35)', letterSpacing:'0.1em', fontSize:8.5 }}>
                {ef.label}
                <span style={{ opacity:0.5, marginLeft:6, fontWeight:'normal' }}>— {ef.desc.slice(0,28)}…</span>
              </button>
            ))}
          </div>
        </div>
        {/* Snippet picker */}
        <div style={{ marginTop:4 }}>
          <div className="hud-label" style={{ fontSize:7.5, color:'rgba(255,255,255,0.3)', letterSpacing:'0.2em', marginBottom:6 }}>SNIPPET</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {SNIPPET_LIBRARY.map(sn => (
              <button key={sn.id} onClick={() => { setSnippet(sn); setPlaying(false); }} className="hud-label"
                style={{ padding:'6px 10px', textAlign:'left', cursor:'pointer',
                  border:`1px solid ${snippet.id===sn.id ? LANG_COLOR[sn.lang] : 'rgba(255,255,255,0.07)'}`,
                  background: snippet.id===sn.id ? `${LANG_COLOR[sn.lang]}12` : 'transparent',
                  color: snippet.id===sn.id ? LANG_COLOR[sn.lang] : 'rgba(255,255,255,0.4)', letterSpacing:'0.1em', fontSize:8.5 }}>
                <span style={{ color:LANG_COLOR[sn.lang], marginRight:6 }}>◈</span>
                {sn.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── EDITOR Tab ─────────────────────────────────────────────────────────────── */
function EditorTab() {
  const [code, setCode]   = useState(SNIPPET_LIBRARY[0].code);
  const [lang, setLang]   = useState<LangId>('typescript');
  const [title, setTitle] = useState('My Snippet');
  const [effect, setEffect] = useState<EffectId>('typewriter');
  const [playing, setPlaying] = useState(false);
  const canvasRef = useAnimationCanvas(code, effect, playing, true, lang);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, flex:1, minHeight:0 }}>
      {/* Editor */}
      <div style={{ display:'flex', flexDirection:'column', gap:6, minHeight:0 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          <input value={title} onChange={e=>setTitle(e.target.value)}
            style={{ flex:1, padding:'5px 10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.12)',
              color:'rgba(255,255,255,0.85)', fontFamily:'var(--font-mono)', fontSize:11, outline:'none' }} />
          <select value={lang} onChange={e => setLang(e.target.value as LangId)}
            style={{ padding:'5px 8px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:LANG_COLOR[lang], fontFamily:'var(--font-mono)', fontSize:9, outline:'none' }}>
            {(Object.keys(LANG_COLOR) as LangId[]).map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
          <select value={effect} onChange={e => setEffect(e.target.value as EffectId)}
            style={{ padding:'5px 8px', background:'rgba(255,255,255,0.06)', border:`1px solid ${EFFECTS.find(ef=>ef.id===effect)?.color??CYAN}55`, color:EFFECTS.find(ef=>ef.id===effect)?.color??CYAN, fontFamily:'var(--font-mono)', fontSize:9, outline:'none' }}>
            {EFFECTS.map(ef => <option key={ef.id} value={ef.id}>{ef.label}</option>)}
          </select>
        </div>
        <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck={false}
          style={{ flex:1, padding:'12px 14px', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.08)',
            color:'rgba(255,255,255,0.82)', fontFamily:'Courier New, monospace', fontSize:11.5, lineHeight:1.55,
            outline:'none', resize:'none', tabSize:2 }} />
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={() => setPlaying(p=>!p)} className="hud-label"
            style={{ flex:1, padding:'8px', fontSize:9, cursor:'pointer', letterSpacing:'0.2em',
              color:playing?ROSE:JADE, border:`1px solid ${playing?ROSE:JADE}`, background:playing?`${ROSE}12`:`${JADE}12` }}>
            {playing ? '◼ STOP' : '▶ PREVIEW'}
          </button>
          <button onClick={() => { setCode(''); setPlaying(false); }} className="hud-label"
            style={{ padding:'8px 14px', fontSize:9, cursor:'pointer', letterSpacing:'0.18em', color:'rgba(255,255,255,0.3)', border:'1px solid rgba(255,255,255,0.12)', background:'transparent' }}>
            CLEAR
          </button>
        </div>
      </div>

      {/* Preview */}
      <div style={{ display:'flex', flexDirection:'column', gap:6, minHeight:0 }}>
        <div className="hud-label" style={{ fontSize:7.5, color:LANG_COLOR[lang], letterSpacing:'0.2em', flexShrink:0 }}>
          ◉ LIVE PREVIEW — {title.toUpperCase()} [{lang.toUpperCase()}]
        </div>
        <canvas ref={canvasRef} width={540} height={400}
          style={{ width:'100%', flex:1, border:`1px solid ${LANG_COLOR[lang]}33`, background:'#030810', display:'block' }} />
      </div>
    </div>
  );
}

/* ── AGENTS Tab ─────────────────────────────────────────────────────────────── */
function AgentsTab() {
  const [agents, setAgents] = useState<AnimAgent[]>(ANIM_AGENTS);
  const [sel, setSel] = useState<AnimAgent>(ANIM_AGENTS[0]);
  const [output, setOutput] = useState<string[]>([
    '◆ DIRECTOR: Anim queue initialized — 3 effects loaded',
    '◈ TYPE-MASTER: Cursor timing calibrated (400ms)',
    '▤ CODE-GEN: Analyzing snippet complexity…',
  ]);
  const [busy, setBusy] = useState(false);

  const statusColor = { ACTIVE:JADE, IDLE:'rgba(255,255,255,0.25)', ANALYZING:AMBER, GENERATING:CYAN_BRIGHT };

  async function activateAgent(agent: AnimAgent) {
    if (busy) return;
    setBusy(true);
    setAgents(prev => prev.map(a => a.id === agent.id ? {...a, status:'ANALYZING'} : a));
    const ts = new Date().toLocaleTimeString();
    setOutput(p => [...p.slice(-49), `[${ts}] ${agent.icon} ${agent.name}: Starting analysis…`]);
    await new Promise(r => setTimeout(r, 900));
    setAgents(prev => prev.map(a => a.id === agent.id ? {...a, status:'GENERATING'} : a));
    setOutput(p => [...p, `${agent.icon} ${agent.name}: ${agent.role} — running`]);
    await new Promise(r => setTimeout(r, 800));
    setAgents(prev => prev.map(a => a.id === agent.id ? {...a, status:'ACTIVE'} : a));
    setOutput(p => [...p, `✓ ${agent.name}: Task complete`]);
    setBusy(false);
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:10, flex:1, minHeight:0 }}>
      {/* Agent grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gridAutoRows:'max-content', gap:8, overflowY:'auto' }} className="nx-scroll">
        {agents.map(a => (
          <button key={a.id} onClick={() => { setSel(a); activateAgent(a); }} disabled={busy}
            style={{ padding:'14px', border:`1px solid ${a.color}44`, background: sel.id===a.id ? `${a.color}12` : `${a.color}06`,
              cursor:busy?'wait':'pointer', textAlign:'left', transition:'all 0.2s', opacity: busy && sel.id!==a.id ? 0.5 : 1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:20, color:a.color }}>{a.icon}</span>
              <span className="hud-label" style={{ fontSize:7, padding:'2px 6px', border:`1px solid ${statusColor[a.status]}`, color:statusColor[a.status], letterSpacing:'0.12em' }}>{a.status}</span>
            </div>
            <div className="hud-label" style={{ fontSize:10, color:a.color, letterSpacing:'0.15em', marginBottom:4 }}>{a.name}</div>
            <div className="font-mono" style={{ fontSize:8.5, color:'rgba(255,255,255,0.45)', lineHeight:1.4 }}>{a.role}</div>
          </button>
        ))}
      </div>

      {/* Activity log */}
      <div style={{ display:'flex', flexDirection:'column', border:'1px solid rgba(255,255,255,0.07)', minHeight:0 }}>
        <div className="hud-label" style={{ fontSize:7.5, color:'rgba(255,255,255,0.3)', padding:'7px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', letterSpacing:'0.18em' }}>AGENT ACTIVITY</div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px 12px', display:'flex', flexDirection:'column', gap:3 }} className="nx-scroll">
          {output.map((line,i) => (
            <div key={i} className="font-mono" style={{ fontSize:9, color: line.startsWith('✓')?JADE : line.startsWith('[') ? 'rgba(255,255,255,0.5)' : CYAN_BRIGHT, lineHeight:1.5 }}>{line}</div>
          ))}
        </div>
        <button onClick={() => setOutput([])} className="hud-label"
          style={{ padding:'4px', fontSize:7, color:'rgba(255,255,255,0.2)', borderTop:'1px solid rgba(255,255,255,0.06)', cursor:'pointer', background:'transparent', letterSpacing:'0.2em' }}>
          CLEAR
        </button>
      </div>
    </div>
  );
}

/* ── LIBRARY Tab ─────────────────────────────────────────────────────────────── */
function LibraryTab() {
  const [sel, setSel] = useState<CodeSnippet>(SNIPPET_LIBRARY[0]);
  const [effect, setEffect] = useState<EffectId>('typewriter');
  const [playing, setPlaying] = useState(false);
  const canvasRef = useAnimationCanvas(sel.code, effect, playing, true, sel.lang);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:10, flex:1, minHeight:0 }}>
      {/* Snippet list */}
      <div style={{ display:'flex', flexDirection:'column', gap:4, overflowY:'auto' }} className="nx-scroll">
        <div className="hud-label" style={{ fontSize:7.5, color:'rgba(255,255,255,0.3)', letterSpacing:'0.2em', marginBottom:4, flexShrink:0 }}>CODE SNIPPETS ({SNIPPET_LIBRARY.length})</div>
        {SNIPPET_LIBRARY.map(sn => (
          <button key={sn.id} onClick={() => { setSel(sn); setPlaying(false); }} className="hud-label"
            style={{ padding:'10px 12px', textAlign:'left', cursor:'pointer',
              border:`1px solid ${sel.id===sn.id ? LANG_COLOR[sn.lang] : LANG_COLOR[sn.lang]+'22'}`,
              background: sel.id===sn.id ? `${LANG_COLOR[sn.lang]}14` : 'transparent',
              color: sel.id===sn.id ? LANG_COLOR[sn.lang] : 'rgba(255,255,255,0.5)', letterSpacing:'0.1em', fontSize:9 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontSize:14, color:LANG_COLOR[sn.lang] }}>◈</span>
              <div>
                <div>{sn.title}</div>
                <div style={{ fontSize:7.5, color:LANG_COLOR[sn.lang], opacity:0.7, marginTop:2 }}>{sn.lang.toUpperCase()} · {sn.code.split('\n').length} lines</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Preview + effect selector */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>
        <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap', alignItems:'center' }}>
          {EFFECTS.map(ef => (
            <button key={ef.id} onClick={() => { setEffect(ef.id); setPlaying(false); }} className="hud-label"
              style={{ padding:'3px 9px', fontSize:7.5, cursor:'pointer',
                border:`1px solid ${effect===ef.id ? ef.color : ef.color+'33'}`,
                color: effect===ef.id ? ef.color : 'rgba(255,255,255,0.3)',
                background: effect===ef.id ? `${ef.color}14` : 'transparent', letterSpacing:'0.12em' }}>
              {ef.label}
            </button>
          ))}
          <button onClick={() => setPlaying(p=>!p)} className="hud-label"
            style={{ marginLeft:'auto', padding:'4px 14px', fontSize:9, cursor:'pointer', letterSpacing:'0.2em',
              color:playing?ROSE:JADE, border:`1px solid ${playing?ROSE:JADE}`, background:playing?`${ROSE}12`:`${JADE}12` }}>
            {playing ? '◼ STOP' : '▶ PLAY'}
          </button>
        </div>
        <canvas ref={canvasRef} width={700} height={400}
          style={{ width:'100%', flex:1, border:`1px solid ${LANG_COLOR[sel.lang]}33`, background:'#030810', display:'block' }} />
      </div>
    </div>
  );
}

/* ── Main Screen ─────────────────────────────────────────────────────────────── */
const TABS: { id: AnimTab; label: string; color: string }[] = [
  { id:'RENDER',  label:'◉ RENDER',   color: CYAN_BRIGHT },
  { id:'EDITOR',  label:'◈ EDITOR',   color: JADE },
  { id:'AGENTS',  label:'⚡ AGENTS',   color: VIOLET },
  { id:'LIBRARY', label:'▤ LIBRARY',  color: AMBER },
];

export default function CodeAnimationScreen() {
  const [tab, setTab] = useState<AnimTab>('RENDER');

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', gap:10 }}>
      <ScreenHeader
        tag="ANIM"
        title="CODE ANIMATION"
        subtitle="Canvas renderer · Effect engine · Agent team · Snippet library"
      />

      {/* Tab bar */}
      <div style={{ display:'flex', gap:2, borderBottom:'1px solid var(--line-soft)', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="hud-label"
            style={{ background: tab===t.id ? 'oklch(0.08 0.015 240 / 0.9)' : 'transparent',
              border:'none', borderBottom: tab===t.id ? `2px solid ${t.color}` : '2px solid transparent',
              color: tab===t.id ? t.color : 'var(--cyan-dim)',
              padding:'7px 20px', fontSize:9.5, letterSpacing:'0.24em', cursor:'pointer', transition:'all 0.18s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
        {tab === 'RENDER'  && <RenderTab />}
        {tab === 'EDITOR'  && <EditorTab />}
        {tab === 'AGENTS'  && <AgentsTab />}
        {tab === 'LIBRARY' && <LibraryTab />}
      </div>
    </div>
  );
}
