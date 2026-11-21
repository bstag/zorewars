import fs from 'node:fs';
import path from 'node:path';

export const PMARS_SCORE_FORMAT = 'pmars';

const points = ({ w, t, rounds }) => (3 * w + t) / rounds;
const reverse = ({ w, l, t, rounds }) => ({ w: l, l: w, t, rounds });

function parseScore(text) {
  const output = text.trim();
  const match = /^(\d+)[ \t]+(\d+)[ \t]*\r?\n[ \t]*(\d+)[ \t]+(\d+)$/.exec(output);
  const summary = /^Results:[ \t]+(\d+)[ \t]+(\d+)[ \t]+(\d+)$/.exec(output.split(/\r?\n/).at(-1));
  if (!match && !summary) throw new Error('expected two pMARS -k lines or a final two-warrior Results line');
  const [w, l, t] = (summary ? summary.slice(1) : [match[1], match[3], match[2]]).map(Number);
  const rounds = w + l + t;
  if ((match && t !== Number(match[4])) || !Number.isSafeInteger(rounds) || rounds < 1) {
    throw new Error('inconsistent pMARS win/tie counts');
  }
  return { w, l, t, rounds };
}

export function readPmarsRecord(manifest, directory) {
  const { warriors, rounds, settings, seed, matches } = manifest;
  const size = warriors.length;
  if (!Array.isArray(matches)) throw new Error('pMARS manifest needs a matches array');
  if (rounds !== undefined && (!Number.isSafeInteger(rounds) || rounds < 1)) {
    throw new Error('pMARS manifest rounds must be a positive integer');
  }
  const scores = Array.from({ length: size }, () => Array(size).fill(0));
  const results = Array.from({ length: size }, () => Array(size).fill(null));
  for (const match of matches) {
    const { a, b, file } = match ?? {};
    if (![a, b].every(i => Number.isInteger(i) && i >= 0 && i < size) || typeof file !== 'string' || !file) {
      throw new Error('pMARS match needs two warrior indices and a score file');
    }
    if (results[a][b]) throw new Error(`duplicate pMARS match for warriors ${a} and ${b}`);
    let result;
    try {
      result = parseScore(fs.readFileSync(path.resolve(directory, file), 'utf8'));
      if (rounds !== undefined && result.rounds !== rounds) throw new Error(`expected ${rounds} rounds, got ${result.rounds}`);
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
    results[a][b] = result;
    if (a !== b) {
      results[b][a] = reverse(result);
      scores[a][b] = points(result);
      scores[b][a] = points(results[b][a]);
    }
  }
  return { warriors, rounds, settings, seed, scores, results };
}

export function writePmarsRecord(record, directory) {
  const { warriors, rounds, settings, seed, scores, results } = record;
  if (!results) throw new Error('pMARS export needs saved win/loss/tie counts');
  const matches = [];
  const files = [];
  for (let a = 0; a < warriors.length; a++) {
    if (scores[a][a] !== 0) throw new Error(`pMARS export needs a zero diagonal score for warrior ${a}`);
    for (let b = a; b < warriors.length; b++) {
      const result = results[a][b];
      if (!result) continue; // Unplayed self-fights are optional.
      const { w, l, t, rounds: played } = result;
      if (rounds !== undefined && played !== rounds) throw new Error(`match ${a}, ${b} disagrees with the saved round count`);
      if (a !== b) {
        const other = results[b][a];
        if (other.w !== l || other.l !== w || other.t !== t || other.rounds !== played ||
            scores[a][b] !== points(result) || scores[b][a] !== points(other)) {
          throw new Error(`match ${a}, ${b} has inconsistent scores or results`);
        }
      }
      const file = `${a}-${b}.txt`;
      matches.push({ a, b, file });
      files.push([file, `${w} ${t}\n${l} ${t}\n`]);
    }
  }
  fs.mkdirSync(directory);
  for (const [file, contents] of files) fs.writeFileSync(path.join(directory, file), contents);
  const manifest = { format: PMARS_SCORE_FORMAT, warriors, rounds, settings, seed, matches };
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}
