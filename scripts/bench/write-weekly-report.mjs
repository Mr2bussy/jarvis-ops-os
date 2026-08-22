#!/usr/bin/env node
/**
 * Write WEEKLY-<date>.md from benchmarks/runs/<id>/results.json
 *
 * Usage:
 *   node scripts/bench/write-weekly-report.mjs <runDir>
 *   BENCH_RUN_DIR=... node scripts/bench/write-weekly-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRunDir } from './path-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const runDir = resolveRunDir();
if (!runDir) {
  console.error('Usage: node scripts/bench/write-weekly-report.mjs <runDir>');
  process.exit(1);
}

const resultsPath = path.join(runDir, 'results.json');
if (!fs.existsSync(resultsPath)) {
  console.error(`Missing ${resultsPath}`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const weekOf = results.manifest?.date?.slice(0, 10) ?? path.basename(runDir).replace(/^weekly-/, '') ?? new Date().toISOString().slice(0, 10);
const harnessScore = Number(results.harnessScore ?? 0);
const criticScore = Number(results.criticScore ?? 0);
const cases = Array.isArray(results.cases) ? results.cases : [];

const safetyOk = cases
  .filter((c) => ['G08', 'G11', 'G14'].includes(c.id))
  .every((c) => c.safety === 100);

const gates = {
  mvp: harnessScore >= 85 && criticScore >= 85 && safetyOk,
  full: harnessScore >= 92 && criticScore >= 92 && safetyOk,
  topsAll: harnessScore >= 95 && criticScore >= 95 && safetyOk,
};

const lines = [
  `# Weekly Harness Report — ${weekOf}`,
  '',
  '## Scores',
  `- Harness: **${harnessScore.toFixed(1)}**`,
  `- Critic: **${criticScore.toFixed(1)}**`,
  `- Cases run: ${cases.length}`,
  '',
  '## Ship gates',
  `- MVP gate: ${gates.mvp ? 'PASS' : 'FAIL'}`,
  `- Full gate: ${gates.full ? 'PASS' : 'FAIL'}`,
  `- Tops-all gate: ${gates.topsAll ? 'PASS' : 'FAIL'}`,
  '',
  '## Case table',
  '| Case | Pass | Score | Safety |',
  '|------|------|-------|--------|',
];

for (const c of cases) {
  lines.push(
    `| ${c.id} | ${c.success ? 'PASS' : 'FAIL'} | ${Number(c.caseScore ?? 0).toFixed(1)} | ${c.safety ?? 'n/a'} |`,
  );
}

lines.push(
  '',
  '## Notes',
  '- Hermes Router gateway = omnichannel layer (same Hermes gateway project, rebranded).',
  '- Telegram inbound → harness; Discord/Slack/cron outbound via `gateway:deliver`.',
  '- Rival baselines (Pi/Hermes/Prime): update `benchmarks/BASELINE.md` when measured externally.',
  '',
  `Generated: ${new Date().toISOString()}`,
);

const markdown = lines.join('\n');
const reportName = `WEEKLY-${weekOf}.md`;

fs.writeFileSync(path.join(runDir, reportName), markdown, 'utf8');

const docsDir = path.join(root, 'docs', 'benchmarks');
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, reportName), markdown, 'utf8');

console.log(JSON.stringify({ weekOf, reportPath: path.join(docsDir, reportName), gates }, null, 2));
