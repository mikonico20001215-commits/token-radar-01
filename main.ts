// Token Radar's runner: a sealed snapshot in, a ranked board and its dashboard out.
//
// The program reads the snapshot of the protocol universe, scores every
// rankable pre-token protocol with the radar-2 model in lib/model.ts, and
// writes the results into the output directory: the board, the dashboard's
// data, the dashboard files, the screenshots, and the dossier the judge
// reads from.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// Without --input the snapshot comes from /input/snapshot.json; without
// MAKEFUN_OUTPUT_DIR the output goes to /output. Node 22, standard library
// only; the file runs as-is, no build step, no install.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import * as model from './lib/model.ts';
import * as boardLib from './vendor/makefun-board.ts';

// The dossier's text cap, and the screenshot caps, as the gate states them.
// The text cap is the one that shapes the dossier's bytes; the screenshot
// caps only refuse a directory that breaks them.
const DOSSIER_TEXT_BYTES = 65_536;
const SHOT_LIMIT = { max: 4, max_bytes: 524_288 };

// Where the snapshot and the output live in the grader's container, when
// neither the --input flag nor MAKEFUN_OUTPUT_DIR says otherwise.
const DEFAULT_SNAPSHOT = '/input/snapshot.json';
const DEFAULT_OUTPUT = '/output';

/** The value after a `--name value` or `--name=value` flag, or null when absent. */
function flagValue(argv: string[], name: string): string | null {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === name) return argv[i + 1] ?? null;
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return null;
}

/** The snapshot's path: the --input flag's file, or snapshot.json under its directory. */
function snapshotPath(argv: string[]): string {
  const given = flagValue(argv, '--input');
  if (given === null) return DEFAULT_SNAPSHOT;
  let st: fs.Stats;
  try {
    st = fs.statSync(given);
  } catch {
    throw new Error(`--input ${given} cannot be read`);
  }
  if (st.isDirectory()) return path.join(given, 'snapshot.json');
  if (st.isFile()) return given;
  throw new Error(`--input ${given} is neither a file nor a directory`);
}

/** Copy a tree of plain files, counting what it copies; anything else refuses. */
function copyTree(from: string, to: string): number {
  fs.mkdirSync(to, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copied += copyTree(src, dst);
    } else if (entry.isFile()) {
      fs.copyFileSync(src, dst);
      copied += 1;
    } else {
      throw new Error(`cannot copy ${src}: neither a file nor a directory`);
    }
  }
  return copied;
}

function main(argv: string[]): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? DEFAULT_OUTPUT;
  const snapshot = model.parseSnapshot(fs.readFileSync(snapshotPath(argv), 'utf8'));
  const { board, radar } = model.buildRadar(snapshot);
  const issue = model.boardIssue(board, snapshot);
  if (issue !== null) throw new Error(`board refused: ${issue}`);

  const here = path.dirname(url.fileURLToPath(import.meta.url));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`, 'utf8');
  fs.writeFileSync(path.join(outDir, 'data.js'), model.dataScript(radar), 'utf8');
  const dashFiles = copyTree(path.join(here, 'dashboard'), path.join(outDir, 'dashboard'));
  const shots = copyTree(path.join(here, 'screenshots'), path.join(outDir, 'screenshots'));
  const dossier = boardLib.buildDossier(outDir, { text_max_bytes: DOSSIER_TEXT_BYTES, screenshots: SHOT_LIMIT });
  fs.writeFileSync(path.join(outDir, 'dossier.json'), dossier);

  console.log(
    `radar: scored ${board.length} rows from a snapshot of ${snapshot.protocols.length} protocols ` +
      `(watchlist ${snapshot.watchlist.length}, ${radar.early_size} early rows below the floor, ` +
      `${radar.live_size} live-token protocols set aside)`,
  );
  console.log(
    `radar: wrote board.json, data.js, dashboard (${dashFiles} files), ` +
      `screenshots (${shots} images) and dossier.json to ${outDir}`,
  );
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(`radar: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
