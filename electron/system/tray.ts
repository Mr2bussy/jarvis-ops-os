/**
 * System tray — status + panic/resume quick actions.
 */
// @ts-nocheck

import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { killGlobal, resumeGlobal, killSwitchStatus } from '../harness/governance/kill-switch';

let tray: Tray | null = null;

function trayIcon(): Electron.NativeImage {
  const size = 16;
  const iconPath = path.join(app.getAppPath(), 'build-assets', 'icon.ico');
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath).resize({ width: size, height: size });
  }
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAHElEQVQoz2NgGAWjYBSMglEwCkbBKBgFo4D6AQB8AAH/0v1mYAAAAABJRU5ErkJggg==',
  );
}

export function createJarvisTray(getMainWin: () => BrowserWindow | null): Tray | null {
  if (tray) return tray;
  try {
    tray = new Tray(trayIcon());
    tray.setToolTip('JARVIS Operations OS');
    const rebuild = () => {
      const ks = killSwitchStatus();
      const statusLabel = ks.global ? 'Status: PANIC (killed)' : 'Status: OK';
      const menu = Menu.buildFromTemplate([
        { label: statusLabel, enabled: false },
        { type: 'separator' },
        {
          label: 'Fenster zeigen',
          click: () => {
            const w = getMainWin();
            if (w) {
              w.show();
              w.focus();
            }
          },
        },
        {
          label: 'Kill-Switch / Panic',
          click: () => {
            killGlobal('tray');
            rebuild();
          },
        },
        {
          label: 'Resume alle',
          click: () => {
            resumeGlobal();
            rebuild();
          },
        },
        { type: 'separator' },
        { label: 'Beenden', click: () => app.quit() },
      ]);
      tray?.setContextMenu(menu);
      tray?.setToolTip(ks.global ? 'JARVIS — PANIC' : 'JARVIS — OK');
    };
    rebuild();
    tray.on('double-click', () => {
      const w = getMainWin();
      if (w) {
        w.show();
        w.focus();
      }
    });
    return tray;
  } catch {
    tray = null;
    return null;
  }
}

export function destroyJarvisTray(): void {
  try {
    tray?.destroy();
  } catch {
    /* ignore */
  }
  tray = null;
}
