import { useEffect, useRef, useState } from 'react';
import { Sidebar, TopBar, VoiceOverlay, AppBackground } from './components/shell';
import type { OSState, ScreenId } from './components/shell';
import BridgeScreen from './screens/Bridge';
import AgentsScreen from './screens/Agents';
import WorkflowsScreen from './screens/Workflows';
import BriefingsScreen from './screens/Briefings';
import { TradingScreen } from './screens/TradingContent';
import { ContentScreen } from './screens/ContentModule';
import SystemScreen from './screens/System';
import ConsoleScreen from './screens/Console';
import AppsScreen from './screens/Apps';
import ArsenalScreen from './screens/Arsenal';
import AdminScreen from './screens/Admin';
import CodeAnimationScreen from './screens/CodeAnimation';
import IntegrationsScreen from './screens/Integrations';
import HarnessEvalsScreen from './screens/HarnessEvals';
import HermesRouterScreen from './screens/HermesRouter';
import SetupWizard, { isSetupDone } from './screens/Setup';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HarnessHitlModal } from './components/HarnessHitlModal';

const JARVIS_SYSTEM_PROMPT = `You are JARVIS, a hyper-intelligent AI operations officer serving a single operator. Your role: synthesize information, advise on decisions, and execute commands across all life and business domains — trading, content, health, engineering, legal, cognition, relationships, and logistics.

Communication rules:
- Always reply in 1–3 sentences. Never more.
- Be direct, precise, and confident. Zero filler words.
- Use operational language. No pleasantries.
- Speak in the present tense about what IS happening, not what COULD happen.
- If a question requires data you don't have, say so in one sentence and suggest the fastest path to get it.
- Never fabricate statistics or status. Only report what you know.
- The operator's time is the most valuable asset. Respect it.`;

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('bridge');
  const [state, setState] = useState<OSState>('idle');
  const [voice, setVoice] = useState(false);
  const [showSetup, setShowSetup] = useState(!isSetupDone());
  const [jarvisResponse, setJarvisResponse] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [micName, setMicName] = useState('');
  const [diag, setDiag] = useState<{
    hasGemini: boolean;
    geminiOk: boolean;
    geminiErr: string;
    model: string;
    sttModel?: string;
    hasAnthropic?: boolean;
    hasGithub?: boolean;
    githubModel?: string;
    githubFallback?: string;
    hasQwen?: boolean;
    qwenModel?: string;
    hasOllama?: boolean;
    ollamaModel?: string;
    ollamaSTTModel?: string;
    hasBrowserSTT?: boolean;
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const listeningRef = useRef(false);
  const isRecordingRef = useRef(false); // prevents parallel startRecording() calls
  const lastRequestRef = useRef(0); // cooldown: ms timestamp of last Gemini call
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // speakText fallback
  const diagCalledRef = useRef(false); // voiceDiag runs once per app session only

  // No auto-reset of state — state is controlled purely by voice logic
  useEffect(() => {
    // Register global shortcut listener from main process
    window.jarvisBridge?.onShortcut?.((key: string) => {
      if (key === 'voice' && !voice) openVoice();
    });
    return () => {
      listeningRef.current = false;
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function openVoice() {
    setVoice(true);
    setJarvisResponse('');
    setVoiceError('');
    listeningRef.current = true;

    // Run diagnostics once per app session
    const jb = (window as any).jarvisBridge;
    if (jb?.voiceDiag && !diagCalledRef.current) {
      diagCalledRef.current = true;
      jb.voiceDiag()
        .then((d: any) => {
          const hasBrowserSTT = Boolean(
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition,
          );
          setDiag({ ...d, hasAnthropic: Boolean((window as any).jarvisBridge?.complete), hasBrowserSTT });
        })
        .catch(() => {});
    }

    // Enumerate mics
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mic = devices.find((d) => d.kind === 'audioinput');
      setMicName(mic?.label || 'Default Microphone');
    } catch {
      setMicName('Microphone');
    }

    setState('listening');
    startRecording();
  }

  async function startRecording() {
    if (!listeningRef.current) return;
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    setState('listening');
    setVoiceError('');
    audioChunksRef.current = [];

    // PRIMARY: Browser Web Speech API — free, no rate limits, built into Electron/Chromium
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const recognition = new SR();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      let done = false;
      const settle = (fn: () => void) => {
        if (done) return;
        done = true;
        isRecordingRef.current = false;
        fn();
      };

      recognition.onresult = (e: any) => {
        const txt = (e.results[0]?.[0]?.transcript || '').trim();
        settle(() => {
          if (!listeningRef.current) return;
          if (txt) processTranscript(txt);
          else startRecording();
        });
      };
      recognition.onerror = (e: any) => {
        settle(() => {
          if (!listeningRef.current) return;
          if (e.error === 'no-speech') {
            startRecording();
            return;
          }
          if (e.error === 'aborted') return;
          startRecordingMedia(); // fall to MediaRecorder + Gemini STT
        });
      };
      recognition.onend = () =>
        settle(() => {
          if (listeningRef.current) startRecording();
        });

      try {
        recognition.start();
        return;
      } catch {
        settle(() => {});
      }
    }

    // FALLBACK: MediaRecorder → Ollama/Gemini STT
    startRecordingMedia();
  }

  async function startRecordingMedia() {
    if (!listeningRef.current) return;
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    setState('listening');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
    } catch (err: any) {
      isRecordingRef.current = false;
      const msg =
        err.name === 'NotAllowedError'
          ? 'Mic blocked — check Electron permissions'
          : `Mic error: ${err.message}`;
      setVoiceError(msg);
      setState('idle');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      isRecordingRef.current = false;
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (!listeningRef.current) return;

      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      if (blob.size < 6000) {
        startRecording();
        return;
      }

      const now = Date.now();
      const sinceLastRequest = now - lastRequestRef.current;
      if (sinceLastRequest < 2000) {
        setTimeout(() => startRecording(), 2000 - sinceLastRequest);
        return;
      }

      setState('processing');
      try {
        const audioBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const jb = (window as any).jarvisBridge;
        lastRequestRef.current = Date.now();

        // STT: Ollama Whisper → Gemini fallback
        let transcript: string = '';
        if (diag?.hasOllama && jb?.ollamaTranscribe) {
          try {
            transcript = await jb.ollamaTranscribe({ audioBase64, mimeType: mimeType.split(';')[0] });
          } catch {
            /* Ollama STT unavailable → Gemini */
          }
        }
        if (!transcript && jb?.geminiTranscribe) {
          transcript = await jb.geminiTranscribe({ audioBase64, mimeType: mimeType.split(';')[0] });
        }

        if (!transcript || transcript.trim().length === 0 || /^\[silence\]$/i.test(transcript.trim())) {
          setState('listening');
          startRecording();
          return;
        }

        await processTranscript(transcript, { audioBase64, mimeType: mimeType.split(';')[0] });
      } catch (err: any) {
        if (!listeningRef.current) return;
        const msg = err?.message || 'API error';
        if (msg.startsWith('RATE_LIMIT:')) {
          const parts = msg.split(':');
          const retrySec = Math.max(parseInt(parts[1] || '60', 10), 30);
          const isDaily = msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
          setVoiceError(
            isDaily
              ? `Daily quota exhausted — try again tomorrow or upgrade API key`
              : `Rate limit — waiting ${retrySec}s…`,
          );
          setState('listening');
          setTimeout(() => {
            setVoiceError('');
            startRecording();
          }, retrySec * 1000);
        } else {
          setVoiceError(msg.length > 120 ? msg.slice(0, 120) + '…' : msg);
          setState('listening');
          setTimeout(() => {
            setVoiceError('');
            startRecording();
          }, 2000);
        }
      }
    };

    mr.start(100);
    detectSilenceAndStop(stream, mr);
  }

  async function processTranscript(
    transcript: string,
    audioFallback?: { audioBase64: string; mimeType: string },
  ) {
    if (!listeningRef.current) return;
    setState('processing');
    const jb = (window as any).jarvisBridge;

    try {
      let response: string = '';

      if (diag?.hasOllama && jb?.ollamaComplete) {
        try {
          const r = await jb.ollamaComplete({
            messages: [{ role: 'user', content: transcript }],
            system: JARVIS_SYSTEM_PROMPT,
            maxTokens: 256,
          });
          if (r) response = r;
        } catch (ollamaErr: any) {
          const emsg = ollamaErr?.message || '';
          if (emsg.startsWith('RATE_LIMIT:')) throw ollamaErr;
        }
      }

      if (!response && diag?.hasQwen && jb?.qwenComplete) {
        response = await jb.qwenComplete({
          messages: [{ role: 'user', content: transcript }],
          system: JARVIS_SYSTEM_PROMPT,
          maxTokens: 256,
        });
      } else if (!response && diag?.hasGithub && jb?.githubComplete) {
        response = await jb.githubComplete({
          messages: [{ role: 'user', content: transcript }],
          system: JARVIS_SYSTEM_PROMPT,
          maxTokens: 256,
        });
      } else if (!response && diag?.hasAnthropic && jb?.complete) {
        response = await jb.complete({
          messages: [{ role: 'user', content: transcript }],
          system: JARVIS_SYSTEM_PROMPT,
          maxTokens: 256,
        });
      } else if (!response && jb?.geminiComplete) {
        response = await jb.geminiComplete({
          messages: [{ role: 'user', text: transcript }],
          system: JARVIS_SYSTEM_PROMPT,
        });
      } else if (!response && audioFallback && jb?.geminiAudio) {
        response = await jb.geminiAudio({
          audioBase64: audioFallback.audioBase64,
          mimeType: audioFallback.mimeType,
          system: JARVIS_SYSTEM_PROMPT,
        });
      }

      if (!listeningRef.current) return;
      if (!response || response.trim().length === 0) {
        setState('listening');
        startRecording();
        return;
      }
      setVoiceError('');
      setJarvisResponse(response);
      setState('speaking');
      speakText(response);
    } catch (err: any) {
      if (!listeningRef.current) return;
      const msg = err?.message || 'API error';
      if (msg.startsWith('RATE_LIMIT:')) {
        const parts = msg.split(':');
        const retrySec = Math.max(parseInt(parts[1] || '60', 10), 30);
        const isDaily = msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
        setVoiceError(
          isDaily
            ? `Daily quota exhausted — try again tomorrow or upgrade API key`
            : `Rate limit — waiting ${retrySec}s…`,
        );
        setState('listening');
        setTimeout(() => {
          setVoiceError('');
          startRecording();
        }, retrySec * 1000);
      } else {
        setVoiceError(msg.length > 120 ? msg.slice(0, 120) + '…' : msg);
        setState('listening');
        setTimeout(() => {
          setVoiceError('');
          startRecording();
        }, 2000);
      }
    }
  }

  function detectSilenceAndStop(stream: MediaStream, mr: MediaRecorder) {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    // Phase 1: measure noise floor for first 600ms (before any speech)
    let noiseFloor = 0;
    let noisesamples = 0;
    const noiseCalibrationMs = 600;
    const startTime = Date.now();

    let hasSpoken = false;
    let speechStartMs = 0; // when continuous speech started
    let silenceStart = Date.now();

    // setInterval is reliable in Electron — rAF can throttle/freeze when unfocused
    const timerId = setInterval(() => {
      if (!listeningRef.current || mr.state === 'inactive') {
        clearInterval(timerId);
        audioCtx.close();
        return;
      }
      analyser.getByteFrequencyData(data);
      const vol = data.reduce((s, v) => s + v, 0) / data.length;

      const elapsed = Date.now() - startTime;

      // Calibration phase: build noise floor estimate
      if (elapsed < noiseCalibrationMs) {
        noiseFloor = (noiseFloor * noisesamples + vol) / (noisesamples + 1);
        noisesamples++;
        return;
      }

      // Speech threshold = 2.5× noise floor, minimum 18 to ignore fans/AC
      const threshold = Math.max(noiseFloor * 2.5, 18);

      if (vol > threshold) {
        if (!hasSpoken) {
          if (speechStartMs === 0) speechStartMs = Date.now(); // start timing speech
          // Require 500ms of continuous speech before committing (filters clicks/pops)
          if (Date.now() - speechStartMs >= 500) {
            hasSpoken = true;
          }
        }
        silenceStart = Date.now();
      } else {
        speechStartMs = 0; // reset speech timer on any dip below threshold
        if (hasSpoken && Date.now() - silenceStart > 1600) {
          clearInterval(timerId);
          mr.stop();
          audioCtx.close(); // 1.6s silence after speech → send
        } else if (!hasSpoken && Date.now() - startTime > 7000) {
          clearInterval(timerId);
          mr.stop();
          audioCtx.close(); // 7s no real speech → restart
        }
      }
    }, 50);
  }

  function speakText(text: string) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-GB';
    utt.rate = 0.82;
    utt.pitch = 0.72;
    utt.volume = 1.0;

    // getVoices() is empty on first call — call again inline
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /microsoft george|microsoft ryan|google uk english male/i.test(v.name)) ||
      voices.find((v) => /daniel|oliver|arthur/i.test(v.name) && v.lang.startsWith('en')) ||
      voices.find((v) => /david|mark|james/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith('en-GB') && !v.name.toLowerCase().includes('female')) ||
      voices.find((v) => v.lang.startsWith('en') && !v.name.toLowerCase().includes('female')) ||
      voices[0];
    if (preferred) utt.voice = preferred;

    // Hard fallback: if onend never fires (Electron speechSynthesis bug), restart anyway
    const estimatedDurationMs = Math.max(text.length * 80 + 4000, 6000);
    let doneCalled = false; // RACE GUARD: onend + fallbackTimer must not both trigger startRecording
    const done = () => {
      if (doneCalled) return;
      doneCalled = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      window.speechSynthesis.cancel();
      setJarvisResponse('');
      if (listeningRef.current) {
        setState('listening');
        startRecording();
      }
    };
    fallbackTimerRef.current = setTimeout(done, estimatedDurationMs);
    utt.onend = done;
    utt.onerror = () => done();

    synthRef.current = utt;
    window.speechSynthesis.speak(utt);
  }

  function closeVoice() {
    listeningRef.current = false;
    isRecordingRef.current = false;
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    window.speechSynthesis.cancel();
    synthRef.current = null;
    setVoice(false);
    setState('idle');
    setJarvisResponse('');
    setVoiceError('');
    // Keep diag alive — no need to reset it; key presence doesn't change while app is running
  }

  function nav(id: ScreenId) {
    setScreen(id);
  }

  const screenProps = { state, setState, onNav: nav, onVoice: openVoice };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', color: 'var(--fg)' }}>
      {showSetup && <SetupWizard onDone={() => setShowSetup(false)} />}
      <AppBackground />
      <div
        style={{ position: 'relative', height: '100%', display: 'grid', gridTemplateColumns: '240px 1fr' }}
      >
        <Sidebar active={screen} onNav={nav} onVoice={openVoice} />
        <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <TopBar state={state} setState={setState} screen={screen} />
          <div
            data-screen-label={screen}
            style={{ flex: 1, minHeight: 0, padding: 20 }}
            className="anim-fade-in"
          >
            <ErrorBoundary label={screen}>
              {screen === 'bridge' && <BridgeScreen {...screenProps} />}
              {screen === 'agents' && <AgentsScreen />}
              {screen === 'workflows' && <WorkflowsScreen />}
              {screen === 'briefings' && <BriefingsScreen />}
              {screen === 'trading' && <TradingScreen />}
              {screen === 'content' && <ContentScreen {...screenProps} />}
              {screen === 'apps' && <AppsScreen />}
              {screen === 'system' && <SystemScreen />}
              {screen === 'console' && <ConsoleScreen {...screenProps} />}
              {screen === 'arsenal' && <ArsenalScreen />}
              {screen === 'admin' && <AdminScreen onResetSetup={() => setShowSetup(true)} />}
              {screen === 'integrations' && <IntegrationsScreen />}
              {screen === 'evals' && <HarnessEvalsScreen />}
              {screen === 'gateway' && <HermesRouterScreen />}
              {screen === 'code' && <CodeAnimationScreen />}
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <HarnessHitlModal />
      {voice && (
        <VoiceOverlay
          state={state}
          onClose={closeVoice}
          transcript={jarvisResponse}
          micError={voiceError}
          micName={micName}
          diag={diag}
        />
      )}
    </div>
  );
}
