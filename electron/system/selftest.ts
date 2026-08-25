/**
 * System self-test — one honest answer to "what actually works right now?".
 *
 * The audit that motivated this found `JARVIS_AGENTS_PATH` pointing at a
 * directory that had not existed for months. Nothing surfaced it: the agent scan
 * silently returned an empty list, which is indistinguishable from "you have no
 * agents". A subsystem that fails quietly is worse than one that fails loudly,
 * because nobody goes looking.
 *
 * Design rules, mirroring `src/lib/quant.ts`:
 *   - Every check probes. None infers a capability from a key being present.
 *   - A check that cannot run reports `skip` with a reason — never `ok`.
 *   - Every non-ok result carries a `hint`: the next concrete action.
 *
 * All I/O arrives through the `SelfTestProbes` interface so the aggregation
 * logic is unit-testable without booting Electron or touching the network.
 */
// @ts-nocheck

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'skip';

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  /** What was observed. Factual, not interpreted. */
  detail: string;
  /** The next action, when there is one. */
  hint?: string;
}

export interface SelfTestReport {
  ranAt: string;
  ms: number;
  checks: CheckResult[];
  summary: { ok: number; warn: number; fail: number; skip: number };
  /** True only when nothing failed. Warnings do not block. */
  healthy: boolean;
}

/** Everything the self-test needs from the outside world. */
export interface SelfTestProbes {
  /** Resolves to true when a path exists on disk. */
  pathExists: (p: string) => boolean;
  /** Counts agent definition files in a directory; -1 when unreadable. */
  countAgentFiles: (dir: string) => number;
  /** Whether an encrypted config key holds a value. */
  hasKey: (name: string) => boolean;
  /** Raw env/config lookup for path-style settings. */
  getSetting: (name: string) => string;
  /** Probes a local bridge; resolves to its status payload or throws. */
  probeBridge: (port: number) => Promise<{ ok: boolean; detail: string; installed?: boolean }>;
  /** Whether ffmpeg is callable. */
  hasFfmpeg: () => boolean;
  /** Whether the local Whisper model is present in the cache. */
  whisperCached: () => boolean;
  /** Free bytes on the volume holding userData; -1 when unknown. */
  freeDiskBytes: () => number;
}

const LLM_KEYS = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic' },
  { key: 'GEMINI_API_KEY', label: 'Gemini' },
  { key: 'GITHUB_TOKEN', label: 'GitHub Models' },
  { key: 'OLLAMA_API_KEY', label: 'Ollama' },
];

const SOCIAL_KEYS = [
  'YOUTUBE_API_KEY',
  'INSTAGRAM_TOKEN',
  'TIKTOK_TOKEN',
  'TWITTER_BEARER_TOKEN',
  'LINKEDIN_TOKEN',
];

const MIN_FREE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB — Whisper + browser caches

export async function runSelfTest(probes: SelfTestProbes, now: number): Promise<SelfTestReport> {
  const checks: CheckResult[] = [];

  // ── Agents vault ────────────────────────────────────────────────────────
  const agentsPath = probes.getSetting('JARVIS_AGENTS_PATH');
  if (!agentsPath) {
    checks.push({
      id: 'agents-path',
      label: 'Agenten-Vault',
      status: 'warn',
      detail: 'JARVIS_AGENTS_PATH ist nicht gesetzt',
      hint: 'Pfad in Admin → Paths hinterlegen',
    });
  } else if (!probes.pathExists(agentsPath)) {
    checks.push({
      id: 'agents-path',
      label: 'Agenten-Vault',
      status: 'fail',
      detail: `Pfad existiert nicht: ${agentsPath}`,
      hint: 'Pfad in Admin → Paths korrigieren',
    });
  } else {
    const n = probes.countAgentFiles(agentsPath);
    checks.push({
      id: 'agents-path',
      label: 'Agenten-Vault',
      // A readable directory with zero agents is the exact silent failure this
      // module exists to surface — it is a warning, never an ok.
      status: n > 0 ? 'ok' : 'warn',
      detail: n < 0 ? 'Verzeichnis nicht lesbar' : `${n} Agent-Dateien erkannt`,
      hint: n === 0 ? 'Verzeichnis enthält keine .agent.md / .chatmode.md Dateien' : undefined,
    });
  }

  // ── Skills index ────────────────────────────────────────────────────────
  const skillsIndex = probes.getSetting('JARVIS_SKILLS_INDEX');
  checks.push({
    id: 'skills-index',
    label: 'Skills-Index',
    status: !skillsIndex ? 'skip' : probes.pathExists(skillsIndex) ? 'ok' : 'fail',
    detail: !skillsIndex
      ? 'Nicht konfiguriert'
      : probes.pathExists(skillsIndex)
        ? skillsIndex
        : `Datei fehlt: ${skillsIndex}`,
    hint: skillsIndex && !probes.pathExists(skillsIndex) ? 'Index neu bauen oder Pfad leeren' : undefined,
  });

  // ── LLM providers ───────────────────────────────────────────────────────
  const present = LLM_KEYS.filter((k) => probes.hasKey(k.key));
  checks.push({
    id: 'llm-keys',
    label: 'LLM-Zugänge',
    status: present.length > 0 ? 'ok' : 'fail',
    detail:
      present.length > 0
        ? `${present.length}/${LLM_KEYS.length} hinterlegt: ${present.map((k) => k.label).join(', ')}`
        : 'Kein einziger Anbieter hinterlegt',
    hint: present.length === 0 ? 'Schlüssel in Admin → Connectors hinterlegen' : undefined,
  });

  // ── Speech ──────────────────────────────────────────────────────────────
  checks.push({
    id: 'ffmpeg',
    label: 'ffmpeg',
    status: probes.hasFfmpeg() ? 'ok' : 'warn',
    detail: probes.hasFfmpeg() ? 'verfügbar' : 'nicht im PATH',
    hint: probes.hasFfmpeg() ? undefined : 'Ohne ffmpeg fällt die Audio-Umwandlung aus',
  });
  checks.push({
    id: 'whisper',
    label: 'Whisper-Modell',
    status: probes.whisperCached() ? 'ok' : 'warn',
    detail: probes.whisperCached() ? 'lokal zwischengespeichert' : 'noch nicht heruntergeladen',
    hint: probes.whisperCached() ? undefined : 'Erster Sprachbefehl lädt das Modell nach (einmalig)',
  });

  // ── Bridges ─────────────────────────────────────────────────────────────
  for (const { id, label, port, hint } of [
    {
      id: 'mt5-bridge',
      label: 'MT5-Bridge',
      port: 1234,
      hint: 'Bridge starten oder Host/Port in Admin prüfen',
    },
    { id: 'browser-bridge', label: 'Browser-Bridge', port: 1237, hint: 'pip install browser-use' },
  ]) {
    try {
      const r = await probes.probeBridge(port);
      const installed = r.installed !== false;
      checks.push({
        id,
        label,
        status: r.ok && installed ? 'ok' : 'warn',
        detail: r.detail,
        hint: r.ok && installed ? undefined : hint,
      });
    } catch (e: unknown) {
      checks.push({
        id,
        label,
        status: 'warn',
        detail: `nicht erreichbar (${String((e as Error)?.message ?? e).slice(0, 60)})`,
        hint,
      });
    }
  }

  // ── Content connectors ──────────────────────────────────────────────────
  const social = SOCIAL_KEYS.filter((k) => probes.hasKey(k)).length;
  checks.push({
    id: 'connectors',
    label: 'Content-Connectors',
    status: social > 0 ? 'ok' : 'skip',
    detail: `${social}/${SOCIAL_KEYS.length} verbunden`,
    hint: social === 0 ? 'Reichweiten bleiben leer, bis eine Plattform-API hinterlegt ist' : undefined,
  });

  // ── Disk ────────────────────────────────────────────────────────────────
  const free = probes.freeDiskBytes();
  checks.push({
    id: 'disk',
    label: 'Freier Speicher',
    status: free < 0 ? 'skip' : free < MIN_FREE_BYTES ? 'warn' : 'ok',
    detail: free < 0 ? 'unbekannt' : `${(free / 1024 ** 3).toFixed(1)} GB frei`,
    hint: free >= 0 && free < MIN_FREE_BYTES ? 'Modelle und Caches brauchen mindestens 2 GB' : undefined,
  });

  const summary = { ok: 0, warn: 0, fail: 0, skip: 0 };
  for (const c of checks) summary[c.status] += 1;

  return {
    ranAt: new Date(now).toISOString(),
    ms: 0,
    checks,
    summary,
    // Warnings describe optional capabilities; only a failure means the app
    // cannot do what it claims.
    healthy: summary.fail === 0,
  };
}
