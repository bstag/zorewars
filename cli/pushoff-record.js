// Tournament records cross a file boundary: replay validates the shapes and
// counts that ranking consumes, while older scores-only records remain usable.
import fs from 'node:fs';
import path from 'node:path';

function square(matrix, size) {
  return Array.isArray(matrix) && matrix.length === size && matrix.every(row => Array.isArray(row) && row.length === size);
}

function validResult(result) {
  return result && ['w', 'l', 't'].every(key => Number.isSafeInteger(result[key]) && result[key] >= 0)
    && Number.isSafeInteger(result.rounds) && result.rounds > 0 && result.w + result.l + result.t === result.rounds;
}

function validateResults(results, size, self) {
  if (!square(results, size)) throw new Error('results must be a square matching the saved warriors');
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
    const result = results[i][j];
    if (i === j && result == null) {
      if (self) throw new Error('self-fight results are missing');
      continue;
    }
    if (!validResult(result)) throw new Error(`invalid win/loss/tie result at [${i}][${j}]`);
  }
}

function validateRecord(record, variant) {
  const warriors = record?.warriors;
  if (!Array.isArray(warriors) || !warriors.length || warriors.some(w => typeof w?.name !== 'string')) {
    throw new Error('saved warriors must be a non-empty list of named warriors');
  }
  if (warriors.some(w => w.entry !== undefined && typeof w.entry !== 'boolean')) throw new Error('saved entry markers must be booleans');
  if (!square(record.scores, warriors.length)) throw new Error('scores must be a square matching the saved warriors');
  if (record.scores.some(row => row.some(value => !Number.isFinite(value)))) throw new Error('scores must contain finite numbers');
  const needsResults = variant.rule !== 'official' && (variant.features !== 'points' || variant.self);
  if (record.results == null) {
    if (needsResults) throw new Error('this reading needs saved win/loss/tie results');
  } else validateResults(record.results, warriors.length, !!variant.self);
  return record;
}

export function loadPushoffRecord(file, variant, usage) {
  try { return validateRecord(JSON.parse(fs.readFileSync(file, 'utf8')), variant); }
  catch (error) { usage(`could not load push-off results: ${error.message}`); }
}

export function savePushoffRecord(file, record) {
  validateRecord(record, { rule: 'official' });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record));
}
