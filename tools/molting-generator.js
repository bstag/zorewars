// Behavior contract for the experimental Molting template. Labels come from
// its generated Redcode; addresses are never inferred from a particular length.
import { compile, VM, measureSpecies } from '../src/engine/index.js';
import { withConstants } from './tune.js';
import { genomeOf, toRedcode } from './genes.js';

function entry(w, label, settings) {
  if (!/ORG\s+\w+/.test(w.redcode)) throw new Error('missing labeled entry point');
  const result = compile(w.redcode.replace(/ORG\s+\w+/, `ORG ${label}`), 'redcode', settings);
  if (!result.ok) throw new Error(`missing ${label} label`);
  return result;
}

export function verifyMolting(w, P, settings) {
  if (!w.ok) throw new Error(JSON.stringify(w.errors));
  if (settings.coreSize !== 55440 || settings.maxCycles < 500000) throw new Error('behavior gate needs full 94x rounds');
  const payload = entry(w, 'payload', settings).start;
  const kill = entry(w, 'killLoop', settings).start - payload;
  const clock = entry(w, 'clock', settings).start;
  const pointer = entry(w, 'clearPtr', settings).start - payload;
  const counter = entry(w, 'remaining', settings).start - payload;
  const normalize = (x) => ((x % settings.coreSize) + settings.coreSize) % settings.coreSize;
  const template = w.instructions.slice(payload).map(({ op, mod, aMode, a, bMode, b }) => ({ op, mod, aMode, a: normalize(a), bMode, b: normalize(b) }));
  const same = (a, b) => ['op', 'mod', 'aMode', 'a', 'bMode', 'b'].every((k) => a[k] === b[k]);
  const observations = [];
  for (const [base, disturb] of [[0, false], [settings.coreSize - 21, false], ...(P.TRIGGER ? [[0, true]] : [])]) {
    const vm = new VM(settings);
    vm.load([w], { positions: [base] });
    if (disturb) {
      vm.step();
      vm.poke(base + P.SENSOR, { op: 'DAT', mod: 'F', aMode: '#', a: 91, bMode: '#', b: 92 }, -1);
    }
    const target = normalize(base + P.HOP);
    while (!vm.done && vm.cycle < 10000 && !vm.processes(0).includes(target)) vm.step();
    if (!vm.processes(0).includes(target)) throw new Error('did not relocate to requested destination');
    if (!template.every((ins, i) => same(ins, vm.peek(target + i)))) throw new Error('payload copy differs from template');
    if (!disturb && vm.b[normalize(base + clock)] !== 0) throw new Error('timer bypassed without marker damage');
    if (disturb && vm.b[normalize(base + clock)] === 0) throw new Error('damaged marker did not trigger early transition');
    const movedAt = vm.cycle;
    vm.run();
    if (!vm.warriors[0].alive || vm.cycle !== settings.maxCycles) throw new Error('failed full solo round');
    if (!(vm.lastExec[normalize(target + kill)] > movedAt)) throw new Error('relocated kill phase never executed');
    if (vm.lastExec[normalize(base + w.start)] >= movedAt) throw new Error('returned to old opening');
    if (!template.every((ins, i) => [pointer, counter].includes(i) || same(ins, vm.peek(target + i)))) throw new Error('payload damaged itself');
    observations.push({ base, disturbed: disturb, movedAt, killLastExecuted: vm.lastExec[normalize(target + kill)], survives: true });
  }
  if (P.TRIGGER && observations.at(-1).movedAt >= observations[0].movedAt) throw new Error('marker transition was not earlier');
  return { ok: true, payloadLength: template.length, observations };
}

export function buildMolting(source, P, settings) {
  const text = withConstants(source, P), w = compile(text, 'javascript', settings);
  return { source: text, w, verification: verifyMolting(w, P, settings) };
}

export function clearControl(w, settings, { bare = true } = {}) {
  const control = entry(w, 'payload', settings);
  const g = genomeOf(control);
  if (bare) { g.code = g.code.slice(g.start); g.start = 0; }
  const text = toRedcode(g, { coreSize: settings.coreSize, name: bare ? 'Plain clear' : 'Clear in original body' });
  const compiled = compile(text, 'redcode', settings);
  if (!compiled.ok || !measureSpecies(compiled, settings).survives) throw new Error('clear control fails solo check');
  return compiled;
}
