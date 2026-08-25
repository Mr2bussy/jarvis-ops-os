// @ts-nocheck
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  bootstrapHarnessSkills,
  loadSkillsFromDir,
  materializeBundledSkills,
  selectSkillsForMessage,
} from './loader';

describe('harness skill loader', () => {
  it('loads bundled Affaan-adapted skills from the repo tree', () => {
    const skills = bootstrapHarnessSkills(path.join(os.tmpdir(), `jarvis-skills-${Date.now()}`));
    const names = skills.map((s) => s.name).sort();
    expect(names).toContain('verification-loop');
    expect(names).toContain('security-review');
    expect(names).toContain('strategic-compact');
    expect(names).toContain('safety-hitl');
    expect(names).toContain('context-budget');
    expect(names).toContain('plan-swarm');
  });

  it('does not overwrite an existing local SKILL.md on rematerialize', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-skills-'));
    materializeBundledSkills(dest);
    const target = path.join(dest, 'verification-loop', 'SKILL.md');
    expect(fs.existsSync(target)).toBe(true);
    fs.writeFileSync(target, '---\nname: verification-loop\ntriggers: verify\n---\nLOCAL EDIT\n', 'utf8');
    materializeBundledSkills(dest);
    expect(fs.readFileSync(target, 'utf8')).toContain('LOCAL EDIT');
  });

  it('lazy-loads skill bodies only when triggers match', () => {
    const dir = path.join(process.cwd(), 'electron', 'harness', 'skills');
    const skills = loadSkillsFromDir(dir);
    const idle = selectSkillsForMessage(skills, 'good morning');
    expect(idle.triggerTable).toContain('verification-loop');
    expect(idle.bodies).toBe('');

    const hit = selectSkillsForMessage(skills, 'please run a security review for HITL');
    expect(hit.bodies).toMatch(/Security Review/i);
  });
});
