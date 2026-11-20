// Vice Panels — hand-in program for the gta6-cover-art-01 bounty.
//
// The entry itself is the static web app in app/ (plain files a browser
// loads offline). This program is the courier: it copies app/ and
// screenshots/ into the output directory and writes dossier.json there,
// built by the kit's vendored library from exactly those files, so the
// judges read a summary that matches the app byte for byte.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR standing in for
// /output outside the grader's container:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Node 22, standard library only; it runs twice and writes the same bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps for this bounty, handed to the dossier builder so an
// oversized entry fails here instead of at the scorer: the dossier text
// budget, at most 4 screenshots of at most 256 KiB each, and app/ within
// 993 entries, 48 MiB in all and 1,000 bytes a path.
const GATE_CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  app_max_files: 993,
  app_max_bytes: 50_331_648,
  app_path_max_bytes: 1_000,
};

function copyIntoOutput(name: string): void {
  const from = join(repoDir, name);
  if (!existsSync(from)) return;
  cpSync(from, join(outputDir, name), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyIntoOutput('app');
copyIntoOutput('screenshots');

const dossier = buildDossier(outputDir, GATE_CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
