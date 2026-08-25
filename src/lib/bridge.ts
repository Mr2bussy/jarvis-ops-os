// @ts-nocheck
export type JarvisBridge = Window['jarvisBridge'];

export function getJarvisBridge(): JarvisBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.jarvisBridge;
}

export function hasJarvisBridge(): boolean {
  return Boolean(getJarvisBridge());
}

export function bridgeUnavailableMessage(): string {
  return 'jarvisBridge unavailable — Electron preload/IPC ist nicht verbunden. Starte JARVIS als Desktop-App, nicht als nackten Vite-Browser-Tab.';
}
