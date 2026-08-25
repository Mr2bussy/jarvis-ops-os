// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { buildCsp, cspForUrl, isAudioWorkerRequest, CONNECT_SOURCES } from './csp';

describe('buildCsp', () => {
  it('never permits inline or eval-able scripts by default', () => {
    const csp = buildCsp();
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('locks down the directives an injected page would reach for', () => {
    const csp = buildCsp();
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'none'");
  });

  it('adds wasm-unsafe-eval only when explicitly asked', () => {
    expect(buildCsp()).not.toContain('wasm-unsafe-eval');
    expect(buildCsp({ allowWasm: true })).toContain("script-src 'self' 'wasm-unsafe-eval'");
  });

  it('does not smuggle full unsafe-eval in with the wasm allowance', () => {
    const csp = buildCsp({ allowWasm: true });
    // 'wasm-unsafe-eval' must not be accompanied by the far broader 'unsafe-eval'.
    expect(csp).not.toMatch(/'unsafe-eval'/);
  });

  it('restricts workers to the app bundle', () => {
    expect(buildCsp()).toContain("worker-src 'self' blob:");
  });

  it('allows exactly the documented API hosts and nothing else', () => {
    const csp = buildCsp();
    const connect = csp.split('; ').find((d) => d.startsWith('connect-src'))!;
    for (const src of CONNECT_SOURCES) expect(connect).toContain(src);
    expect(connect).not.toContain('*;');
    expect(connect).not.toMatch(/connect-src [^;]*\s\*\s/);
  });
});

describe('isAudioWorkerRequest', () => {
  it('matches the app-bundled audio worker over dev server and file protocol', () => {
    expect(isAudioWorkerRequest('http://localhost:5173/assets/voice-worker-a1b2.js')).toBe(true);
    expect(isAudioWorkerRequest('file:///C:/app/dist/assets/onnx-runtime.wasm')).toBe(true);
    expect(isAudioWorkerRequest('http://127.0.0.1:5173/voice-worker.mjs')).toBe(true);
  });

  it('refuses remote URLs that merely contain the word worker', () => {
    expect(isAudioWorkerRequest('https://evil.example.com/voice-worker.js')).toBe(false);
    expect(isAudioWorkerRequest('https://cdn.example.com/assets/onnx-runtime.wasm')).toBe(false);
  });

  it('refuses unrelated local assets', () => {
    expect(isAudioWorkerRequest('http://localhost:5173/assets/index-abc.js')).toBe(false);
    expect(isAudioWorkerRequest('http://localhost:5173/src/App.tsx')).toBe(false);
  });

  it('handles empty input without throwing', () => {
    expect(isAudioWorkerRequest('')).toBe(false);
  });
});

describe('cspForUrl', () => {
  it('gives the audio worker its WASM allowance and no one else', () => {
    expect(cspForUrl('http://localhost:5173/assets/voice-worker-x.js')).toContain('wasm-unsafe-eval');
    expect(cspForUrl('http://localhost:5173/assets/index-x.js')).not.toContain('wasm-unsafe-eval');
    expect(cspForUrl('https://evil.example.com/voice-worker.js')).not.toContain('wasm-unsafe-eval');
  });
});
