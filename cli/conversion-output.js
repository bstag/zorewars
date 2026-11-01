// Conversion artifacts and command output use the same verified result.
import fs from 'node:fs';
export function writeConversionResult(result, out, json, to) {
  if (out) {
    fs.writeFileSync(out, result.code);
    if (!json) console.error(`wrote ${out} (${result.level} form${result.verified ? ', verified' : ''})`);
  }
  if (json) console.log(JSON.stringify({ ok: true, language: to, level: result.level, verified: result.verified, code: result.code }, null, 2));
  else if (!out) process.stdout.write(result.code);
}
