// The CLI refuses what it cannot understand: exit 2 and one line on stderr.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../cli/zorewars.js', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('bad numbers, unknown options and missing values are usage errors', () => {
  const cases = [
    [['battle', '@dwarf', '@imp', '--seed', 'abc'], /--seed must be a whole number/],
    [['battle', '@dwarf', '@imp', '--rounds', '3x'], /--rounds must be a whole number/],
    [['battle', '@dwarf', '@imp', '--rounds', '2.9'], /--rounds must be a whole number/],
    [['battle', '@dwarf', '@imp', '--rounds'], /--rounds needs a value/],
    [['battle', '@dwarf', '@imp', '--rounds', '--json'], /--rounds needs a value/],
    [['battle', '--foo', '@dwarf', '@imp'], /unknown option --foo/],
    [['battle', '@dwarf', '@imp', '--josn'], /unknown option --josn/],
    [['battle', '@dwarf', '@imp', '--coresize', '50'], /does not fit a core of 50/],
    [['battle', '@dwarf', '@imp', '--distance', '9000'], /do not fit a core/],
    [['battle', 'warriors'], /is a folder/],
    [['hill', '@dwarf', '--hill', 'koenigstuhl:bogus'], /unknown hill 'bogus'/],
  ];
  for (const [args, message] of cases) {
    const r = run(...args);
    assert.equal(r.status, 2, `${args.join(' ')}: ${r.stderr}`);
    assert.match(r.stderr, message);
    assert.ok(!/\n\s+at /.test(r.stderr), `${args.join(' ')} printed a stack trace`);
    assert.equal(r.stdout, '');
  }
});

test('valid input still runs, including pMARS short options and a negative-looking value', () => {
  const r = run('battle', '@dwarf', '@imp', '-r', '3', '--seed', '7', '--json');
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.settings.rounds, 3);
  assert.equal(out.seed, 7);
  const rules = run('battle', '-8', 'warriors/88/dwarf.red', '--json');
  assert.equal(JSON.parse(rules.stdout).settings.dialect, '88');
});
