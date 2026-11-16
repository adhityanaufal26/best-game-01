// Tidewarden entry program: copies game/ and screenshots/ from this
// repository into the output directory and writes dossier.json with
// buildDossier from vendor/makefun-game.ts. Node standard library only.
// Run: MAKEFUN_OUTPUT_DIR=out node main.ts   (or /output by default)
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const gameSrc = join(repoRoot, 'game');
const shotsSrc = join(repoRoot, 'screenshots');
if (!existsSync(gameSrc)) throw new Error('game/ not found beside main.ts');
if (!existsSync(shotsSrc)) throw new Error('screenshots/ not found beside main.ts');

// Start from a clean output directory so repeat runs are byte-identical.
// The output dir itself is a grader mountpoint we may not own, so never
// remove it — only clear what is inside it, then recreate the subdirs.
mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) {
  rmSync(join(outDir, entry), { recursive: true, force: true });
}
mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

cpSync(gameSrc, join(outDir, 'game'), { recursive: true });
cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`tidewarden: wrote ${outDir} (${dossier.length} byte dossier)`);
