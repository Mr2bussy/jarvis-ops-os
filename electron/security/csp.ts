/**
 * Content-Security-Policy construction for the renderer.
 *
 * Previously this lived as a single concatenated string inside `main.ts`, which
 * made it untestable and easy to widen by accident. The policy is one of this
 * app's strongest properties — `script-src 'self'` with no `unsafe-eval` — so it
 * gets its own module with its own tests.
 *
 * ## The WASM problem
 *
 * On-device speech models (Silero VAD, Whisper, speaker embeddings) run through
 * ONNX Runtime Web, which compiles WebAssembly and therefore needs
 * `'wasm-unsafe-eval'` in `script-src`. Granting that to the whole document
 * would weaken every page in the app for the sake of one feature.
 *
 * Instead the allowance is scoped: only responses that serve the audio worker
 * bundle get the WASM-permitting policy. Everything else keeps the strict one.
 * `'wasm-unsafe-eval'` permits WebAssembly compilation *only* — unlike
 * `'unsafe-eval'` it does not re-enable `eval()` or `new Function()` for
 * JavaScript, which is what makes this a narrow grant rather than a hole.
 */
// @ts-nocheck

/** Hosts the renderer is allowed to reach. Anything not listed is blocked. */
export const CONNECT_SOURCES = [
  "'self'",
  'https://api.anthropic.com',
  'https://generativelanguage.googleapis.com',
  'https://models.inference.ai.azure.com',
  'https://dashscope-intl.aliyuncs.com',
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
  // trading-data.ts fetches Deribit public options APIs from the renderer
  'https://www.deribit.com',
  'http://localhost:*',
  'http://127.0.0.1:*',
] as const;

export interface CspOptions {
  /**
   * Permit WebAssembly compilation. Only ever true for the audio-worker
   * response — see the module comment for why this is not applied document-wide.
   */
  allowWasm?: boolean;
}

export function buildCsp(opts: CspOptions = {}): string {
  const scriptSrc = ["'self'", ...(opts.allowWasm ? ["'wasm-unsafe-eval'"] : [])];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    // Inline styles are required by the HUD, which composes styles per element.
    // Inline *scripts* remain forbidden, which is the directive that matters.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `connect-src ${CONNECT_SOURCES.join(' ')}`,
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Workers may only come from the app bundle — this is what keeps the WASM
    // allowance below from being reachable by an injected remote worker.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join('; ');
}

/**
 * True for responses that serve on-device audio model code.
 *
 * Deliberately narrow and anchored on a path segment the build controls, so a
 * remote URL containing the word "worker" cannot claim the WASM allowance.
 */
export function isAudioWorkerRequest(url: string): boolean {
  if (!url) return false;
  // Only same-origin app assets qualify. Dev server and file:// both appear here.
  const isLocalAsset = url.startsWith('file://') || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
  if (!isLocalAsset) return false;
  return /\/(voice-worker|onnx-runtime)[-.\w]*\.(js|mjs|wasm)(\?|$)/.test(url);
}

/** Policy for one response, chosen by URL. */
export function cspForUrl(url: string): string {
  return buildCsp({ allowWasm: isAudioWorkerRequest(url) });
}
