// Compact layouts for the 80- and 800-cell rings. See docs/compact-hill-workshop.md.
const norm = (value, core) => ((value % core) + core) % core;
const initialProbe = (P) => 4 + 5 * P.LANE;
const stride = (P) => P.REVERSE ? -5 : 5;

const nanoLane = {
  id: 'nano-lane',
  kind: 'body', exit: 'never', processes: 1, writes: 'sparse', dialects: '94',
  entry: 'look', entryFirst: false,
  purpose: 'Scans a 16-cell lane on the Nano ring, sharing the scan instruction’s B-field with a single DAT attack. The only friendly cell on the lane is its zero-field bomb.',
  params: { LANE: [1, 15], REVERSE: [0, 1], FIELDS: [0, 1] },
  defaults: { LANE: 8, REVERSE: 0, FIELDS: 0 },
  mutable: [['look', ['b']]],
  mismatches(_, settings) {
    return settings.coreSize === 80 ? [] : ['nano-lane requires the 80-cell ring'];
  },
  linked(_P, _settings, _label, { total, shiftedFrame }) {
    return total === 5 && !shiftedFrame ? [] : ['nano-lane must own its entire five-cell image'];
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('advance', 'ADD', 'AB', `#${stride(P)}`, L('look'));
    ctx.ins('look', 'JMZ', P.FIELDS ? 'B' : 'F', L('advance'), `@${initialProbe(P) - 1}`);
    ctx.ins('attack', 'MOV', 'I', L('bomb'), `@${L('look')}`);
    ctx.ins('', 'JMP', 'B', L('advance'));
    ctx.ins('bomb', 'DAT', 'F', '$0', '$0');
  },
  plant(api) {
    return [[api.self.start + initialProbe(api.P), {
      op: 'JMP', mod: 'B', aMode: '#', a: 1, bMode: '$', b: api.P.FIELDS,
    }]];
  },
  watch(api) {
    const { vm, P, core } = api;
    const look = api.at('look'), attack = api.at('attack'), bomb = api.at('bomb');
    const first = api.norm(api.self.start + initialProbe(P));
    const planted = api.scenario === 'nano-lane: planted target';
    let next = first, last = null, enteredStep = null, hits = 0;
    const probes = new Set();
    return {
      before(pc) {
        if (pc !== look && pc !== attack) return null;
        const target = api.norm(look + vm.peek(look).b);
        if (pc === look) {
          enteredStep ??= vm.steps;
          if (target !== next || (api.inImage(target) && target !== bomb)) {
            throw new Error('nano-lane left its declared probe lane');
          }
          probes.add(target);
          last = target;
          next = api.norm(target + stride(P));
        }
        if (pc !== attack) return null;
        const cell = vm.peek(target);
        if (target !== last || api.inImage(target) || !(cell.b || (!P.FIELDS && cell.a))) {
          throw new Error('nano-lane attacked a friendly, unprobed, or undetected cell');
        }
        if (planted && (target !== first || vm.steps !== enteredStep + 1)) {
          throw new Error('nano-lane did not attack the first planted probe immediately');
        }
        return target;
      },
      after(target) {
        if (target === null) return;
        if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== attack
          || !api.same(vm.peek(target), api.code('bomb'))) {
          throw new Error('nano-lane did not copy its DAT to the probed cell');
        }
        hits++;
      },
      final() {
        if (probes.size !== core / 5 || !probes.has(bomb)) throw new Error('nano-lane did not cover its full lane');
        if (hits !== Number(planted)) throw new Error('nano-lane dropped the wrong number of DATs');
        if (!api.sole()) throw new Error('nano-lane left its own image');
      },
    };
  },
};

// Independent starting lanes for the opening pattern in Little Fluffy Clouds.
// https://asdflkj.net/COREWAR/TINY/HILL32/little_fluffy_clouds.red
const defaultPairs = Array.from({ length: 9 }, (_, i) => [250 + 37 * i, 67 + 79 * i]);
const parameters = Object.fromEntries(defaultPairs.flatMap((_, i) => [
  [`SRC${i + 1}`, [0, 799]], [`DST${i + 1}`, [0, 799]],
]));
const pairDefaults = Object.fromEntries(defaultPairs.flatMap(([source, target], i) => [
  [`SRC${i + 1}`, source], [`DST${i + 1}`, target],
]));

function copyPairs(P, entry, core) {
  return Array.from({ length: P.COUNT }, (_, i) => ({
    source: norm(entry + P[`SRC${i + 1}`], core),
    target: norm(entry + P[`DST${i + 1}`], core),
  }));
}

const tinyCopyBurst = {
  id: 'tiny-copy-burst',
  kind: 'opening', exit: 'next', link: 'fall', processes: 1, writes: 'sparse', dialects: '94',
  entry: 'copy',
  purpose: 'Copies COUNT instructions using fixed remote A-predecrement pointers and fixed destinations (SRC1/DST1 onward, offsets from the opening entry), then falls through. The source pointer and destination stay outside the original image.',
  params: { COUNT: [1, defaultPairs.length], ...parameters },
  defaults: { COUNT: 4, ...pairDefaults },
  mismatches(_, settings) {
    return settings.coreSize === 800 ? [] : ['tiny-copy-burst requires the 800-cell ring'];
  },
  linked(P, settings, label, { total, shiftedFrame }) {
    if (shiftedFrame) return ['tiny-copy-burst requires an unshifted image'];
    const touched = copyPairs(P, label('copy'), settings.coreSize).flatMap(({ source, target }) => [source, target]);
    const errors = [];
    if (touched.some((cell) => cell < total)) errors.push('tiny-copy-burst predecrement or destination touches the linked image');
    if (new Set(touched).size !== touched.length) errors.push('tiny-copy-burst source pointers and destinations must be distinct');
    return errors;
  },
  emit(ctx) {
    const { L, P } = ctx;
    for (let i = 1; i <= P.COUNT; i++) {
      ctx.ins(i === 1 ? 'copy' : '', 'MOV', 'I', `{${L('copy')}+${P[`SRC${i}`]}`, `$${L('copy')}+${P[`DST${i}`]}`);
    }
  },
  plant(api) {
    const pairs = copyPairs(api.P, api.entry(), api.core);
    const touched = new Set(pairs.flatMap(({ source, target }) => [source, target]));
    if (api.total + touched.size + pairs.length > api.core) throw new Error('tiny-copy-burst has no room for the planted sources');
    return pairs.flatMap(({ source }, i) => {
      let resolved = api.norm(source + 1);
      while (touched.has(resolved) || api.inImage(resolved)) resolved = api.norm(resolved + 1);
      touched.add(resolved);
      return [
        [source, { op: 'DAT', mod: 'F', aMode: '#', a: api.norm(resolved - source + 1), bMode: '#', b: 0 }],
        [resolved, { op: 'JMP', mod: 'B', aMode: '#', a: i + 1, bMode: '$', b: 0 }],
      ];
    });
  },
  watch(api) {
    const { vm, core } = api;
    const entry = api.entry(), pairs = copyPairs(api.P, entry, core);
    let copied = 0;
    return {
      before(pc) {
        if (copied === pairs.length || pc !== api.norm(entry + copied)) return null;
        const { source, target } = pairs[copied];
        if (api.inImage(source) || api.inImage(target)) throw new Error('tiny-copy-burst wrote into its image');
        const pointer = vm.peek(source);
        pointer.a = api.norm(pointer.a - 1);
        const resolved = api.norm(source + pointer.a);
        const instruction = resolved === source ? pointer : vm.peek(resolved);
        return { pc, source, target, pointer, instruction };
      },
      after(copy) {
        if (!copy) return;
        const { pc, source, target, pointer, instruction } = copy;
        if (vm.lastWrite[source] !== vm.steps || vm.writerPc[source] !== pc || !api.same(vm.peek(source), pointer)) {
          throw new Error('tiny-copy-burst did not predecrement its remote source pointer');
        }
        if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== pc || !api.same(vm.peek(target), instruction)) {
          throw new Error('tiny-copy-burst did not copy the resolved instruction to its destination');
        }
        if (!vm.processes(0).includes(api.norm(pc + 1))) throw new Error('tiny-copy-burst did not fall through');
        copied++;
      },
      final() {
        if (api.entered() && copied !== pairs.length) throw new Error('tiny-copy-burst did not execute every copy');
      },
    };
  },
};

const tinyTrapScan = {
  id: 'tiny-lp-trap-scan',
  kind: 'body', exit: 'never', processes: 1, writes: 'sparse', dialects: '94',
  entry: 'look', entryFirst: false, loop: 'advance',
  purpose: 'Scans both fields through a shared arithmetic pointer. On a hit, guards the linked image and replaces the target with a JMP trap or DAT.',
  params: { START: [1, 799], STEP: [1, 799], TRAP: [0, 1] },
  defaults: { START: 73, STEP: 17, TRAP: 1 },
  mutable: [['advance', ['b']]],
  mismatches(P, { coreSize }) {
    if (coreSize !== 800) return ['tiny-lp-trap-scan requires the 800-cell ring'];
    return P.STEP % 2 && P.STEP % 5 ? [] : ['tiny-lp-trap-scan needs a stride coprime to 800'];
  },
  linked(P, { coreSize }, label, { total, shiftedFrame }) {
    const probe = norm(label('advance') + P.START, coreSize);
    return shiftedFrame || probe < total ? ['tiny-lp-trap-scan needs an unshifted image and a remote first probe'] : [];
  },
  emit(ctx) {
    const { L, P, total, core } = ctx;
    const at = ctx.pc();
    ctx.ins('advance', 'ADD', 'AB', `#${P.STEP}`, `#${P.START}`);
    ctx.ins('look', 'JMZ', 'F', L('advance'), `@${L('advance')}`);
    ctx.ins('', 'SLT', 'AB', `#${total - at - 1}`, L('advance'));
    ctx.ins('', 'JMP', 'B', L('advance'));
    ctx.ins('', 'SLT', 'AB', `#${core - at - 1}`, L('advance'));
    ctx.ins('', 'JMP', 'B', L('attack'));
    ctx.ins('', 'JMP', 'B', L('advance'));
    ctx.ins('attack', 'MOV', 'I', L('bomb'), `@${L('advance')}`);
    ctx.ins('', 'JMP', 'B', L('advance'));
    ctx.ins('bomb', P.TRAP ? 'JMP' : 'DAT', P.TRAP ? 'B' : 'F', '#0', '$0');
  },
  plant(api) {
    return [[api.norm(api.at('advance') + api.P.START), {
      op: 'JMP', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 1,
    }]];
  },
  watch(api) {
    const { vm, at, P } = api;
    const advance = at('advance'), look = at('look'), attack = at('attack');
    const planted = api.scenario === 'tiny-lp-trap-scan: planted target';
    const marker = api.norm(advance + P.START);
    let probe = P.START, lastLook = null, firstLook = null, markerHit = false;
    return {
      before(pc) {
        if (pc !== look && pc !== attack) return null;
        const offset = vm.peek(advance).b;
        const target = api.norm(advance + offset);
        if (pc === look) {
          if (offset !== probe) throw new Error('tiny-lp-trap-scan probe went off stride');
          lastLook = vm.steps;
          firstLook ??= lastLook;
          probe = api.norm(probe + P.STEP);
          return null;
        }
        if (api.inImage(target) || vm.steps !== lastLook + 4
          || (planted && target === marker && lastLook !== firstLook)) {
          throw new Error('tiny-lp-trap-scan attacked the wrong target or missed its hit timing');
        }
        return target;
      },
      after(target) {
        if (target === null) return;
        if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== attack
          || !api.same(vm.peek(target), api.code('bomb'))) {
          throw new Error('tiny-lp-trap-scan did not write its selected bomb');
        }
        markerHit ||= target === marker;
      },
      final() {
        if (api.entered() && ((planted && !markerHit) || !api.sole())) {
          throw new Error('tiny-lp-trap-scan did not finish its guard-and-attack scenario');
        }
      },
    };
  },
};

export default [nanoLane, tinyCopyBurst, tinyTrapScan];
