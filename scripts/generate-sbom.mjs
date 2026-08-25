#!/usr/bin/env node
// @ts-nocheck
/**
 * Generate SBOM (CycloneDX-ish scaffold from package.json) for release attach.
 * Usage: node scripts/generate-sbom.mjs [outPath]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv[2];
const outPath = outArg
  ? resolve(ROOT, outArg)
  : join(ROOT, 'release', 'SBOM.json');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const components = [];

function addDeps(deps, scope) {
  if (!deps) return;
  for (const [name, version] of Object.entries(deps)) {
    components.push({
      type: 'library',
      name,
      version: String(version).replace(/^[\^~]/, ''),
      scope,
      purl: `pkg:npm/${encodeURIComponent(name)}@${String(version).replace(/^[\^~]/, '')}`,
    });
  }
}

addDeps(pkg.dependencies, 'required');
addDeps(pkg.devDependencies, 'optional');

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  serialNumber: `urn:uuid:${createHash('sha256').update(`${pkg.name}@${pkg.version}`).digest('hex').slice(0, 32)}`,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: 'application',
      name: pkg.name,
      version: pkg.version,
    },
  },
  components,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(bom, null, 2), 'utf8');
console.log(`SBOM wrote ${outPath} (${components.length} components)`);
