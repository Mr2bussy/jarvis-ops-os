/**
 * Apps registry + agents filesystem scanner IPC — extracted from main.ts (D6).
 */
// @ts-nocheck

import type { IpcMain } from 'electron';
import { app, BrowserWindow, dialog, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { spawn } from 'node:child_process';

export type AppsIpcDeps = {
  pushActivity: (who: string, action: string, target: string) => void;
};

export function registerAppsIpc(ipcMain: IpcMain, deps: AppsIpcDeps): void {
  const { pushActivity } = deps;

  function appsRegistryPath() {
    return path.join(app.getPath('userData'), 'apps-registry.json');
  }
  type AppEntry = {
    id: string;
    name: string;
    path: string;
    kind: 'exe' | 'url' | 'folder' | 'cmd';
    tag?: string;
    addedAt: number;
  };
  function readRegistry(): AppEntry[] {
    try {
      return JSON.parse(fs.readFileSync(appsRegistryPath(), 'utf8'));
    } catch {
      return [];
    }
  }
  function writeRegistry(list: AppEntry[]) {
    fs.mkdirSync(path.dirname(appsRegistryPath()), { recursive: true });
    fs.writeFileSync(appsRegistryPath(), JSON.stringify(list, null, 2), 'utf8');
  }

  ipcMain.handle('apps:list', () => readRegistry());
  ipcMain.handle('apps:add', (_e, entry: Omit<AppEntry, 'id' | 'addedAt'>) => {
    const list = readRegistry();
    const e: AppEntry = { ...entry, id: 'A-' + Math.random().toString(36).slice(2, 9), addedAt: Date.now() };
    list.unshift(e);
    writeRegistry(list);
    return e;
  });
  ipcMain.handle('apps:remove', (_e, id: string) => {
    writeRegistry(readRegistry().filter((x) => x.id !== id));
    return true;
  });
  ipcMain.handle('apps:pick', async (_e, kind: 'exe' | 'folder') => {
    const win = BrowserWindow.getFocusedWindow();
    const r = await dialog.showOpenDialog(win!, {
      properties: kind === 'folder' ? ['openDirectory'] : ['openFile'],
      filters:
        kind === 'exe'
          ? [
              { name: 'Executables', extensions: ['exe', 'bat', 'cmd', 'ps1', 'lnk'] },
              { name: 'All', extensions: ['*'] },
            ]
          : undefined,
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('apps:launch', async (_e, entry: AppEntry) => {
    try {
      if (entry.kind === 'url') {
        await shell.openExternal(entry.path);
        return { ok: true };
      }
      if (entry.kind === 'folder' || entry.kind === 'exe') {
        const r = await shell.openPath(entry.path);
        return { ok: r === '', err: r || undefined };
      }
      if (entry.kind === 'cmd') {
        spawn(entry.path, [], { shell: true, detached: true, stdio: 'ignore' }).unref();
        return { ok: true };
      }
      return { ok: false, err: 'unknown kind' };
    } catch (err: any) {
      return { ok: false, err: String(err?.message || err) };
    }
  });
  ipcMain.handle('apps:scan-common', async () => {
    if (process.platform !== 'win32') return [];
    const roots = [
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      path.join(os.homedir(), 'AppData', 'Local', 'Programs'),
    ];
    const found: { name: string; path: string }[] = [];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      try {
        for (const dir of fs.readdirSync(root).slice(0, 80)) {
          const full = path.join(root, dir);
          try {
            if (!fs.statSync(full).isDirectory()) continue;
            const exe = fs
              .readdirSync(full)
              .slice(0, 40)
              .find((f) => f.toLowerCase().endsWith('.exe'));
            if (exe) found.push({ name: dir, path: path.join(full, exe) });
          } catch {
            /* skip */
          }
          if (found.length >= 60) break;
        }
      } catch {
        /* skip */
      }
      if (found.length >= 60) break;
    }
    return found;
  });

  interface ScannedAgent {
    id: string;
    name: string;
    desc: string;
    tools: string[];
    file: string;
    cat: string;
  }

  function parseAgentFrontmatter(content: string, file: string): ScannedAgent | null {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;
    const yaml = match[1];
    const nameM = yaml.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
    const descM =
      yaml.match(/^description:\s*["'](.+?)["']\s*$/ms) || yaml.match(/^description:\s*(.+?)[\r\n]/m);
    const toolsM = yaml.match(/^tools:\s*\[([^\]]*)\]/m);
    const name = nameM?.[1]?.trim() || file.replace(/\.agent\.md$/, '');
    const desc = descM?.[1]?.trim() || '';
    const tools = toolsM
      ? toolsM[1]
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const lower = (name + ' ' + desc).toLowerCase();
    let cat = 'SPECIALIST';
    if (/trading|market|finance|cfo|tax|steuer/.test(lower)) cat = 'TRADING';
    else if (/security|cyber|red.team|pentest|vuln/.test(lower)) cat = 'SECURITY';
    else if (/frontend|react|vue|angular|css|ui/.test(lower)) cat = 'FRONTEND';
    else if (/backend|api|node|python|rust|java/.test(lower)) cat = 'BACKEND';
    else if (/cloud|azure|aws|gcp|terraform|bicep/.test(lower)) cat = 'CLOUD';
    else if (/data|sql|db|analytic|ml|ai|llm/.test(lower)) cat = 'DATA';
    else if (/debug|qa|test|review/.test(lower)) cat = 'DEBUG';
    else if (/content|social|media|blog|seo|youtube/.test(lower)) cat = 'CONTENT';
    else if (/orchestrat|meta|agent|workflow|planner/.test(lower)) cat = 'META';
    const id = 'RA-' + file.replace(/\.agent\.md$/, '').replace(/[^A-Za-z0-9]/g, '-');
    return { id, name, desc, tools, file, cat };
  }

  ipcMain.handle('jarvis:workspace', async () => {
    const agentsPath = process.env.JARVIS_AGENTS_PATH || '';
    const skillsIndexPath = process.env.JARVIS_SKILLS_INDEX || '';
    let agentCount = 0,
      skillsTotal = 0;
    if (agentsPath && fs.existsSync(agentsPath)) {
      try {
        agentCount = fs.readdirSync(agentsPath).filter((f) => f.endsWith('.agent.md')).length;
      } catch {}
    }
    if (skillsIndexPath && fs.existsSync(skillsIndexPath)) {
      try {
        skillsTotal = (JSON.parse(fs.readFileSync(skillsIndexPath, 'utf8')) as any).total || 0;
      } catch {}
    }
    return { agentsPath, skillsIndexPath, agentCount, skillsTotal };
  });

  ipcMain.handle('jarvis:scan-agents', async () => {
    const agentsPath = process.env.JARVIS_AGENTS_PATH || '';
    const agents: ScannedAgent[] = [];
    if (!agentsPath || !fs.existsSync(agentsPath)) return agents;
    try {
      for (const file of fs.readdirSync(agentsPath).filter((f) => f.endsWith('.agent.md'))) {
        try {
          const agent = parseAgentFrontmatter(fs.readFileSync(path.join(agentsPath, file), 'utf8'), file);
          if (agent) agents.push(agent);
        } catch {
          /* skip */
        }
      }
      pushActivity('JARVIS', 'SCAN', `${agents.length} agents loaded`);
    } catch {}
    return agents;
  });

  ipcMain.handle('jarvis:live-scan', async () => {
    const agentsPath = process.env.JARVIS_AGENTS_PATH || '';
    const result = { total: 0, byCategory: {} as Record<string, number>, lastModTs: 0, scanTs: Date.now() };
    if (!agentsPath || !fs.existsSync(agentsPath)) return result;
    try {
      const files = fs.readdirSync(agentsPath).filter((f) => f.endsWith('.agent.md'));
      result.total = files.length;
      let lastMod = 0;
      for (const file of files) {
        const lower = file.toLowerCase();
        let cat = 'SPECIALIST';
        if (/trading|market|finance|cfo|tax|zeus/.test(lower)) cat = 'TRADING';
        else if (/security|cyber|red.team|pentest|vuln/.test(lower)) cat = 'SECURITY';
        else if (/frontend|react|vue|angular|css|ui|web/.test(lower)) cat = 'FRONTEND';
        else if (/backend|api|node|python|rust|java|server/.test(lower)) cat = 'BACKEND';
        else if (/cloud|azure|aws|gcp|terraform|bicep/.test(lower)) cat = 'CLOUD';
        else if (/data|sql|db|analytic|ml|ai|llm/.test(lower)) cat = 'DATA';
        else if (/debug|qa|test|review/.test(lower)) cat = 'DEBUG';
        else if (/content|social|media|blog|seo|youtube/.test(lower)) cat = 'CONTENT';
        else if (/orchestrat|meta|agent|workflow|planner/.test(lower)) cat = 'META';
        result.byCategory[cat] = (result.byCategory[cat] || 0) + 1;
        try {
          const mt = fs.statSync(path.join(agentsPath, file)).mtimeMs;
          if (mt > lastMod) lastMod = mt;
        } catch {}
      }
      result.lastModTs = lastMod;
    } catch {}
    return result;
  });

  ipcMain.handle('jarvis:rebuild-index', async () => {
    const agentsPath = process.env.JARVIS_AGENTS_PATH || '';
    const empty = {
      generated: '',
      total: 0,
      byCat: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      entries: [] as any[],
    };
    if (!agentsPath || !fs.existsSync(agentsPath)) return empty;
    pushActivity('ARSENAL', 'INDEX', 'full rebuild started');
    const entries: any[] = [];
    const byCat: Record<string, number> = {};
    const byType: Record<string, number> = {};
    try {
      for (const file of fs.readdirSync(agentsPath).filter((f) => f.endsWith('.agent.md'))) {
        try {
          const agent = parseAgentFrontmatter(fs.readFileSync(path.join(agentsPath, file), 'utf8'), file);
          if (agent) {
            entries.push(agent);
            byCat[agent.cat] = (byCat[agent.cat] || 0) + 1;
            for (const t of agent.tools) byType[t] = (byType[t] || 0) + 1;
          }
        } catch {
          /* skip */
        }
      }
    } catch {}
    pushActivity('ARSENAL', 'INDEX', `${entries.length} entries indexed`);
    return { generated: new Date().toISOString(), total: entries.length, byCat, byType, entries };
  });
}
