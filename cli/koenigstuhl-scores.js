// https://corewar.co.uk/metcalf/koenformat.txt
import fs from 'node:fs';
import path from 'node:path';

// The archive stores normalized 0..300 scores times 10,000. ZoreWars uses
// points per round on a 0..3 scale, so the conversion factor is 1,000,000.
const SCORE_SCALE = 1e6;

export function readKoenigstuhlRecord(file) {
  const extension = path.extname(file);
  const base = file.slice(0, -extension.length);
  const bytes = fs.readFileSync(base + '.dat');
  const utf8 = bytes.toString('utf8');
  const text = (utf8.includes('\uFFFD') ? bytes.toString('latin1') : utf8).replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  while (lines.at(-1) === '') lines.pop();
  const countText = lines.shift();
  const size = Number(countText);
  if (!/^\d+$/.test(countText) || !Number.isSafeInteger(size) || size < 1 || lines.length !== size * 4) {
    throw new Error('Koenigstuhl .dat needs a positive warrior count and four lines per warrior');
  }
  const warriors = Array.from({ length: size }, (_, i) => {
    const [name, author, file, format] = lines.slice(i * 4, i * 4 + 4);
    return { name, author, file, format };
  });
  const binary = fs.readFileSync(base + '.scores');
  const expectedBytes = size * size * 4;
  if (!Number.isSafeInteger(expectedBytes) || binary.length !== expectedBytes) {
    throw new Error(`Koenigstuhl .scores needs exactly ${expectedBytes} bytes for ${size} warriors`);
  }
  const scores = Array.from({ length: size }, () => Array(size));
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      scores[column][row] = binary.readInt32LE((row * size + column) * 4) / SCORE_SCALE;
    }
  }
  return { warriors, scores };
}

function metadataLine(value, fallback) {
  const line = value ?? fallback;
  if (typeof line !== 'string' || /[\r\n\u0000]/.test(line)) {
    throw new Error('Koenigstuhl metadata fields must be single-line strings');
  }
  return line;
}

export function writeKoenigstuhlRecord(directory, record) {
  const { warriors, scores, settings = {} } = record;
  const size = warriors.length;
  const defaultFormat = settings.dialect === '88' ? '88' : '94';
  const lines = [String(size)];
  for (const [index, warrior] of warriors.entries()) {
    lines.push(metadataLine(warrior.name, ''),
      metadataLine(warrior.author, ''),
      metadataLine(warrior.file, `warrior-${index}.red`),
      metadataLine(warrior.format, defaultFormat));
  }
  const binary = Buffer.alloc(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const scaled = Math.round(scores[column][row] * SCORE_SCALE);
      if (!Number.isSafeInteger(scaled) || scaled < -2147483648 || scaled > 2147483647) {
        throw new Error(`score ${column},${row} exceeds the signed 32-bit Koenigstuhl range`);
      }
      binary.writeInt32LE(scaled, (row * size + column) * 4);
    }
  }
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'hill32.dat'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(directory, 'hill32.scores'), binary);
}

export function removePSpaceWarriors(record) {
  if (record.warriors.some(warrior => typeof warrior.format !== 'string')) {
    throw new Error('P-space removal requires saved warrior format labels');
  }
  const keep = record.warriors.flatMap((warrior, i) => warrior.format === 'P-Space' ? [] : [i]);
  if (!keep.length) throw new Error('removing P-space warriors leaves an empty field');
  const subset = matrix => keep.map(i => keep.map(j => matrix[i][j]));
  return { ...record, warriors: keep.map(i => record.warriors[i]), scores: subset(record.scores),
    ...(record.results ? { results: subset(record.results) } : {}) };
}
