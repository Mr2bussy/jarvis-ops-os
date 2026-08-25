// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  initPromptLoader,
  listPrompts,
  loadPrompt,
  loadPromptBody,
  readPromptChangelog,
  renderPrompt,
} from './loader';

describe('prompt loader', () => {
  it('loads versioned prompts from repo prompts/', () => {
    initPromptLoader(path.join(process.cwd(), 'prompts'));
    const all = listPrompts();
    expect(all.length).toBeGreaterThanOrEqual(2);
    const voice = loadPrompt('hermes-voice');
    expect(voice?.version).toMatch(/^\d+\.\d+/);
    expect(voice?.body.length).toBeGreaterThan(20);
    expect(loadPromptBody('morning-briefing')?.length).toBeGreaterThan(10);
  });

  it('reads changelog entries', () => {
    initPromptLoader(path.join(process.cwd(), 'prompts'));
    const log = readPromptChangelog();
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0].version).toBeTruthy();
  });

  it('renders template vars', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));
    fs.writeFileSync(
      path.join(tmp, 'demo.md'),
      '---\nid: demo\nversion: 2.0.0\ntitle: Demo\n---\n\nHello {{name}}.\n',
      'utf8',
    );
    initPromptLoader(tmp);
    expect(renderPrompt('demo', { name: 'Zac' })).toContain('Hello Zac');
  });
});
