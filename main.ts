// main.ts — the entry program: hands the app in.
//
// Copies app/ and screenshots/ from this repository to /output (or
// $MAKEFUN_OUTPUT_DIR) and writes /output/dossier.json with buildDossier
// from vendor/makefun-app.ts, the kit's copy, unchanged. Node stdlib only.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 48 * 1024 * 1024,
  app_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });
for (const dir of ['app', 'screenshots']) {
  const src = join(root, dir);
  if (!existsSync(src)) throw new Error(`main.ts: no ${dir}/ in ${root}`);
  cpSync(src, join(out, dir), { recursive: true });
}

const dossier = buildDossier(out, caps);
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`dossier.json: ${dossier.length} bytes -> ${join(out, 'dossier.json')}`);
