const payload = ['bomb', 'pointer', 'write', 'meter', 'reloadMeter', 'reloadPointer', 'repeat', 'padding'];
const stagedPayload = ['pointer', 'bomb', 'stun', 'write', 'writeSecond', 'meter', 'reloadPointer', 'selectBomb', 'repeat', 'padding'];
const span = payload.length * 3 / 2 + 3;
const stagedSpan = stagedPayload.length * 3 / 2 + 3;

function geometry(core, { HOP }) {
  const hop = HOP || Math.floor(core / 2);
  return { hop, count: Math.min(hop, core - hop) - span };
}

function liveWorkers(api, hop, entry = 'write', end = 'repeat') {
  const { vm, at, rel, add } = api;
  const home = at(entry);
  const away = add(home, hop);
  const last = rel(at(end), home);
  const queue = vm.processes(0);
  return [home, away].map((origin) => queue.filter((pc) => rel(pc, origin) <= last).length);
}

function emitBoot({ ins, L }, origin, size, hop, entry = 'write') {
  ins('launch', 'SPL', 'B', '1', `${L(origin)}+${size}`);
  for (let i = 0; i < size / 2; i++) ins(`copy${i}`, 'MOV', 'I', `<${L('launch')}`, `<${L('home')}`);
  // The first DJN falls through. The second sends its worker to the copy.
  ins('route', 'DJN', 'B', `${L(entry)}+${hop}`, '#1');
  ins('home', 'JMP', 'B', L(entry), `${L(origin)}+${hop + size}`);
}

function watchBoot(api, id, image, hop, entry, end) {
  const { vm, at, add, code, same } = api;
  const copyWriters = new Set(Array.from({ length: image.length / 2 }, (_, i) => at(`copy${i}`)));
  let copied = 0, dispatched = false;
  return {
    before(pc) {
      if (pc === at('home')) return 'dispatch';
      return copyWriters.has(pc) ? 'copy' : null;
    },
    after(action) {
      if (action === 'copy') {
        const label = image[image.length - 1 - copied];
        const target = label && add(at(label), hop);
        if (!label || vm.lastWrite[target] !== vm.steps || !same(vm.peek(target), code(label))) {
          throw new Error(`${id}: remote payload was not copied intact in reverse order`);
        }
        copied++;
      } else if (action === 'dispatch') {
        if (copied !== image.length) throw new Error(`${id}: remote payload was not copied intact before dispatch`);
        for (const label of image) {
          if (!same(vm.peek(add(at(label), hop)), code(label))) {
            throw new Error(`${id}: remote ${label} was not copied intact before dispatch`);
          }
        }
        if (!liveWorkers(api, hop, entry, end).every((n) => n === 1)) throw new Error(`${id}: expected one worker at each clear`);
        dispatched = true;
      }
    },
    dispatched: () => dispatched,
  };
}

const pairedClear = {
  id: 'paired-clear',
  kind: 'body',
  exit: 'never',
  dialects: '94',
  entry: 'launch',
  entryFirst: false,
  processes: 2,
  writes: 'core',
  roams: true,
  purpose: 'Two workers copy one compact clear backwards, then dispatch one worker to each image. Both repeatedly clear bounded regions and preserve the two images.',
  params: { HOP: [0, 54000] },
  defaults: { HOP: 0 },
  knowledge: {
    parameterRoles: { HOP: 'Distance from the home clear to the copy. Zero selects half the core.' },
    derived: { count: 'min(HOP, CORESIZE − HOP) − 15 cells per pass, using the resolved distance' },
    evidence: ['docs/hill-block-review.md#sal-leaders-with-separately-published-sources'],
  },
  mutable: [['launch', ['b']], ['home', ['b']], ['route', ['b']], ['pointer', ['b']], ['meter', ['b']]],
  mismatches(P, settings) {
    const { hop, count } = geometry(settings.coreSize, P);
    return count < 1 ? [`paired-clear: HOP ${hop} leaves no safe clearing interval on both sides`] : [];
  },
  emit(ctx) {
    const { ins, L, P, core } = ctx;
    const { hop, count } = geometry(core, P);
    // The DAT bomb also stores both initial values for the repeated pass.
    ins('bomb', 'DAT', 'F', `#${span - 1}`, `#${count}`);
    ins('pointer', 'DAT', 'F', '#0', `#${span - 1}`);
    ins('write', 'MOV', 'I', L('bomb'), `>${L('pointer')}`);
    ins('meter', 'DJN', 'B', L('write'), `#${count}`);
    ins('reloadMeter', 'MOV', 'B', L('bomb'), L('meter'));
    ins('reloadPointer', 'MOV', 'AB', L('bomb'), L('pointer'));
    ins('repeat', 'JMP', 'B', L('write'), '0');
    ins('padding', 'DAT', 'F', '#0', '#0');

    emitBoot(ctx, 'bomb', payload.length, hop);
  },
  running(api) {
    return liveWorkers(api, geometry(api.core, api.P).hop).every((count) => count === 1);
  },
  watch(api) {
    const { vm, at, add, code, same, P, core } = api;
    const { hop, count } = geometry(core, P);
    const origins = [at('bomb'), add(at('bomb'), hop)];
    const writers = [at('write'), add(at('write'), hop)];
    const boot = watchBoot(api, this.id, payload, hop);
    const writes = [0, 0];
    return {
      before(pc) {
        return boot.before(pc) ?? writers.indexOf(pc);
      },
      after(action) {
        boot.after(action);
        if (action === 0 || action === 1) {
          const target = add(origins[action], span + (writes[action] % count));
          if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== writers[action] || !same(vm.peek(target), code('bomb'))) {
            throw new Error('paired-clear: a worker missed its bounded clearing interval');
          }
          writes[action]++;
        }
      },
      final() {
        if (api.entered() && (!boot.dispatched() || writes.includes(0))) throw new Error('paired-clear: both clears must deploy and attack');
      },
    };
  },
};

function stagedGeometry(core, { HOP, START, MARGIN }) {
  const hop = HOP || Math.floor(core / 2);
  const bursts = Math.floor((Math.min(hop, core - hop) - START - MARGIN) / 2);
  return { hop, bursts };
}

const pairedStagedClear = {
  ...pairedClear,
  id: 'paired-clear-staged',
  purpose: 'Two copy workers deploy a pair of bounded clears. Each worker writes two consecutive SPL bombs per burst, then repeats its interval with pairs of DAT bombs.',
  params: { HOP: [0, 54000], START: [1, 54000], MARGIN: [0, 54000], STUN: [2, 54000] },
  defaults: { HOP: 0, START: 34, MARGIN: 14, STUN: 256 },
  knowledge: {
    parameterRoles: {
      HOP: 'Distance from the home clear to the copy. Zero selects half the core.',
      START: 'First attack cell relative to each payload origin.',
      MARGIN: 'Leave at least this many cells untouched before the next image.',
      STUN: 'Even length of the first SPL pass. Subsequent passes use DAT.',
    },
    evidence: ['docs/hill-block-review.md#sal-leaders-with-separately-published-sources'],
  },
  mutable: [['launch', ['b']], ['home', ['b']], ['route', ['b']], ['pointer', ['a', 'b']], ['repeat', ['b']]],
  mismatches(P, settings) {
    const { hop, bursts } = stagedGeometry(settings.coreSize, P);
    if (P.START < stagedSpan || bursts < 1) return [`paired-clear-staged: HOP ${hop} and START ${P.START} leave no safe clearing interval`];
    if (P.STUN % 2 || P.STUN > 2 * bursts) return ['paired-clear-staged: STUN must be even and fit inside the clearing interval'];
    return [];
  },
  emit(ctx) {
    const { ins, L, P, core } = ctx;
    const { hop, bursts } = stagedGeometry(core, P);
    // The pointer counts bursts in A and advances the target in B.
    // The back jump's B field selects the bomb for both writes.
    ins('pointer', 'DAT', 'F', `#${P.STUN / 2}`, `#${P.START}`);
    ins('bomb', 'DAT', 'F', `#${bursts}`, `#${P.START}`);
    ins('stun', 'SPL', 'B', '#0', '0');
    ins('write', 'MOV', 'I', `@${L('repeat')}`, `>${L('pointer')}`);
    ins('writeSecond', 'MOV', 'I', `@${L('repeat')}`, `>${L('pointer')}`);
    ins('meter', 'DJN', 'A', L('write'), L('pointer'));
    ins('reloadPointer', 'MOV', 'F', L('bomb'), L('pointer'));
    ins('selectBomb', 'MOV', 'AB', `#${L('bomb')}-${L('repeat')}`, L('repeat'));
    ins('repeat', 'JMP', 'B', L('write'), L('stun'));
    ins('padding', 'DAT', 'F', '#0', '#0');
    emitBoot(ctx, 'pointer', stagedPayload.length, hop);
  },
  watch(api) {
    const { vm, at, add, code, same, P, core } = api;
    const { hop, bursts } = stagedGeometry(core, P);
    const boot = watchBoot(api, this.id, stagedPayload, hop);
    const origins = [at('pointer'), add(at('pointer'), hop)];
    const writers = new Map(origins.flatMap((_, lane) => {
      const shift = lane * hop;
      return ['write', 'writeSecond'].map((label) => [add(at(label), shift), lane]);
    }));
    const writes = [0, 0], width = 2 * bursts;
    return {
      before(pc) {
        return boot.before(pc) ?? writers.get(pc);
      },
      after(action) {
        boot.after(action);
        if (action !== 0 && action !== 1) return;
        const n = writes[action];
        const stun = n < P.STUN;
        const offset = P.START + (stun ? n : (n - P.STUN) % width);
        const target = add(origins[action], offset);
        if (vm.lastWrite[target] !== vm.steps || !same(vm.peek(target), code(stun ? 'stun' : 'bomb'))) {
          throw new Error('paired-clear-staged: unexpected write in bounded SPL/DAT sequence');
        }
        writes[action]++;
      },
      final() {
        if (api.entered() && (!boot.dispatched() || writes.some((n) => n <= P.STUN + width))) {
          throw new Error('paired-clear-staged: both workers must stun, kill and restart the DAT pass');
        }
      },
    };
  },
};

const fanImage = ['pointer', 'limit', 'bomb', 'stun', 'fan1', 'fan2', 'check', 'resetBranch',
  'write', 'writeSecond', 'repeat', 'resetPointer', 'resetLimit', 'selectBomb', 'resetJump', 'padding'];
const burstGroup = 8; // Two writes for each of four workers at one site.
const workersPerSite = P => 2 ** P.FAN;
const leadWriters = ['leadOne', 'leadTwo'];
const sweepWriters = ['write', 'writeSecond'];
const fanEntry = P => P.LEAD ? 'leadOne' : 'fan1';
const leadWrites = P => P.LEAD ? 2 + Number(P.FAN > 0) : 0;
const leadStart = P => P.START - (P.LEAD ? 3 : 0);
const payloadOf = P => P.LEAD
  ? [...fanImage.slice(0, 4), 'leadOne', 'fan1', 'leadTwo', ...fanImage.slice(5)]
  : fanImage;

function fanGeometry(core, P) {
  const { hop, bursts } = stagedGeometry(core, P);
  return { hop, width: Math.floor(2 * bursts / burstGroup) * burstGroup };
}

const pairedFanClear = {
  ...pairedStagedClear,
  id: 'paired-clear-fan',
  status: 'diagnostic-control',
  purpose: 'A paired SPL-to-DAT clear with one, two or four lockstep workers at each site. LEAD 1 writes before and between the splits, then runs the regular bounded clear.',
  params: { ...pairedStagedClear.params, FAN: [0, 2], LEAD: [0, 1] },
  defaults: { ...pairedStagedClear.defaults, FAN: 2, LEAD: 0 },
  processes: P => 2 * workersPerSite(P),
  testedProfiles: ['tinylp'],
  observationRole: 'paired-clear-fan',
  mutable: [['launch', ['b']], ['home', ['b']], ['route', ['b']], ['pointer', ['b']], ['limit', ['b']], ['repeat', ['b']], ['padding', ['b']]],
  knowledge: {
    parameterRoles: {
      ...pairedStagedClear.knowledge.parameterRoles,
      FAN: 'Number of active splits at each site: 0, 1 or 2 give one, two or four workers in the same image',
      LEAD: '0 completes the fan before attacking; 1 makes early SPL writes with a separate cursor',
    },
    invariants: ['Both passes have widths divisible by eight, so a lockstep group of four finishes exactly at the boundary.', 'Lead writes occupy the cells immediately before the regular sweep.'],
    evidence: ['docs/hill-block-followup.md#test-four-workers-at-each-tiny-lp-site', 'docs/hill-block-followup.md#attack-while-the-queue-grows', 'test/algebra-paired-clear.test.js'],
  },
  mismatches(P, settings) {
    const { width } = fanGeometry(settings.coreSize, P);
    const span = payloadOf(P).length * 3 / 2 + 3;
    if (leadStart(P) < span || width < burstGroup) return ['paired-clear-fan: no safe clearing interval'];
    if (P.STUN % burstGroup || P.STUN > width) return ['paired-clear-fan: STUN must be a multiple of eight within the clearing interval'];
    return [];
  },
  emit(ctx) {
    const { ins, L, P, core } = ctx;
    const { hop, width } = fanGeometry(core, P);
    ins('pointer', 'DAT', 'F', '#0', `#${P.START}`);
    ins('limit', 'DAT', 'F', `#${P.START + width}`, `#${P.START + P.STUN}`);
    ins('bomb', 'DAT', 'F', '#0', `#${P.START}`);
    ins('stun', 'SPL', 'B', '#0', '0');
    if (P.LEAD) ins('leadOne', 'MOV', 'I', L('stun'), `>${L('padding')}`);
    ins('fan1', P.FAN >= 1 ? 'SPL' : 'NOP', 'B', '1');
    if (P.LEAD) ins('leadTwo', 'MOV', 'I', L('stun'), `>${L('padding')}`);
    ins('fan2', P.FAN >= 2 ? 'SPL' : 'NOP', 'B', '1');
    ins('check', 'SLT', 'B', L('pointer'), L('limit'));
    ins('resetBranch', 'JMP', 'B', L('resetPointer'));
    ins('write', 'MOV', 'I', `@${L('repeat')}`, `>${L('pointer')}`);
    ins('writeSecond', 'MOV', 'I', `@${L('repeat')}`, `>${L('pointer')}`);
    ins('repeat', 'JMP', 'B', L('check'), L('stun'));
    ins('resetPointer', 'MOV', 'B', L('bomb'), L('pointer'));
    ins('resetLimit', 'MOV', 'AB', L('limit'), L('limit'));
    ins('selectBomb', 'MOV', 'AB', `#${L('bomb')}-${L('repeat')}`, L('repeat'));
    ins('resetJump', 'JMP', 'B', L('check'));
    ins('padding', 'DAT', 'F', '#0', P.LEAD ? `#${L('pointer')}+${leadStart(P)}-${L('padding')}` : '#0');
    emitBoot(ctx, 'pointer', payloadOf(P).length, hop, fanEntry(P));
  },
  running(api) {
    const { hop } = fanGeometry(api.core, api.P);
    return liveWorkers(api, hop, fanEntry(api.P), 'resetJump').every(n => n === workersPerSite(api.P));
  },
  observe(api) {
    const { hop } = fanGeometry(api.core, api.P);
    const labels = api.P.LEAD ? [...leadWriters, ...sweepWriters] : sweepWriters;
    const writers = new Map([0, hop].flatMap((shift, lane) =>
      labels.map(label => [api.norm(api.at(label) + shift), lane ? 'remote' : 'home'])));
    return {
      after(event) {
        const site = writers.get(event.pc);
        const target = event.operands[1]?.address;
        if (site && api.own(event) && event.instruction.op === 'MOV' && api.wrote(event, target)) {
          api.work(`${site}-attack`, { target });
        }
      },
    };
  },
  watch(api) {
    const { vm, at, add, code, same, P, core } = api;
    const { hop, width } = fanGeometry(core, P);
    const boot = watchBoot(api, this.id, payloadOf(P), hop, fanEntry(P), 'resetJump');
    const writers = new Map([0, hop].flatMap((shift, lane) => [
      ...sweepWriters.map(label => [add(at(label), shift), { lane, lead: false }]),
      ...(P.LEAD ? leadWriters.map(label => [add(at(label), shift), { lane, lead: true }]) : []),
    ]));
    const writes = [0, 0], early = [0, 0];
    return {
      before(pc) {
        const action = boot.before(pc);
        return action ?? (writers.has(pc) ? { pc, ...writers.get(pc) } : null);
      },
      after(action) {
        boot.after(action);
        if (!action || typeof action !== 'object') return;
        const { pc, lane, lead } = action;
        if (lead) {
          const target = add(at('pointer'), lane * hop + leadStart(P) + early[lane]++);
          if (early[lane] > leadWrites(P) || vm.lastWrite[target] !== vm.steps
            || vm.writerPc[target] !== pc || !same(vm.peek(target), code('stun'))) {
            throw new Error('paired-clear-fan: out-of-order lead write');
          }
          return;
        }
        if (writes[lane] === 0 && !pairedFanClear.running(api)) {
          throw new Error('paired-clear-fan: wrong worker allocation at first write');
        }
        const n = writes[lane]++;
        const stun = n < P.STUN;
        const target = add(at('pointer'), lane * hop + P.START + (stun ? n : (n - P.STUN) % width));
        if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== pc || !same(vm.peek(target), code(stun ? 'stun' : 'bomb'))) {
          throw new Error('paired-clear-fan: out-of-order SPL or DAT write');
        }
      },
      final() {
        if (api.entered() && early.some(n => n !== leadWrites(P))) {
          throw new Error('paired-clear-fan: both lanes must make all lead writes');
        }
        if (api.entered() && (!boot.dispatched() || writes.some(n => n <= P.STUN + width) || !pairedFanClear.running(api))) {
          throw new Error('paired-clear-fan: both lanes must complete and restart their bounded DAT pass');
        }
      },
    };
  },
};

const streamImage = ['cursor', 'stream', 'write', 'writeSecond', 'cycle', 'selectDat', 'reload',
  'install', 'repeat', 'datLoop', 'reset', 'padding', 'selector', 'stun'];
const streamPayload = P => P.COMPACT ? streamImage.filter(label => label !== 'selectDat' && label !== 'padding') : streamImage;

const pairedStreamClear = {
  ...pairedStagedClear,
  id: 'paired-clear-stream',
  status: 'diagnostic-control',
  purpose: 'Two paired clears make two writes per burst. The first pass follows a decrement stream into the bomb selector, then installs a counted DAT loop. STREAM 0 uses a local counter in the same layout. COMPACT 1 relies on the stream alone to switch bombs.',
  params: { ...pairedStagedClear.params, STREAM: [0, 1], COMPACT: [0, 1], FIELD: [0, 1] },
  defaults: { ...pairedStagedClear.defaults, STREAM: 1, COMPACT: 0, FIELD: 0 },
  testedProfiles: ['tinylp'],
  observationRole: 'paired-clear-stream',
  mutable: P => [
    ['launch', ['b']], ['home', ['b']], ['route', ['b']], ['cursor', ['a', 'b']],
    ['stream', [P.STREAM || !P.FIELD ? 'a' : 'b']], ['selector', [P.FIELD ? 'b' : 'a']],
    ['stun', [P.FIELD ? 'b' : 'a']], ['cycle', ['op', 'mod', 'bMode', 'a', 'b']],
  ],
  knowledge: {
    parameterRoles: {
      ...pairedStagedClear.knowledge.parameterRoles,
      STREAM: '1 walks a decrement to the selector; 0 counts the same number of bursts locally',
      COMPACT: '1 removes the explicit selector write and its padding cell',
      FIELD: '0 decrements A, 1 decrements B as in KISS',
    },
    invariants: ['The initial stream stops on the selector before touching other executable cells.', 'The counted DAT sweep stays inside its lane.'],
    evidence: ['docs/hill-block-followup.md#let-the-decrement-stream-switch-bombs', 'test/algebra-paired-clear.test.js'],
  },
  mismatches(P, settings) {
    const { hop, bursts } = stagedGeometry(settings.coreSize, P);
    const span = streamPayload(P).length * 3 / 2 + 3;
    if (P.COMPACT && !P.STREAM) return ['paired-clear-stream: COMPACT needs the decrement stream'];
    if (P.START < span || bursts < 1) return ['paired-clear-stream: no safe clearing interval'];
    if (P.STUN % 2 || P.STUN > 2 * bursts) return ['paired-clear-stream: STUN must be even and fit inside the clearing interval'];
    if (P.STREAM && span - 2 + P.STUN / 2 - 1 >= Math.min(hop, settings.coreSize - hop)) {
      return ['paired-clear-stream: the decrement stream reaches the other lane'];
    }
    return [];
  },
  emit(ctx) {
    const { ins, L, P, core } = ctx;
    const { hop, bursts } = stagedGeometry(core, P);
    const size = streamPayload(P).length;
    const count = P.STUN / 2, start = P.START - (size / 2 + 3);
    const mod = P.FIELD ? 'B' : 'A', source = (P.FIELD ? '@' : '*') + L('selector');
    const streamA = P.STREAM ? `#${L('selector')}-${L('stream')}+${count}` : P.FIELD ? '#0' : `#${count}`;
    const streamB = !P.STREAM && P.FIELD ? `#${count}` : '#0';
    emitBoot(ctx, 'cursor', size, hop);
    ins('cursor', 'DAT', 'F', '#0', `#${start}`);
    ins('stream', 'DAT', 'F', streamA, streamB);
    ins('write', 'MOV', 'I', source, `>${L('cursor')}`);
    ins('writeSecond', 'MOV', 'I', source, `>${L('cursor')}`);
    ins('cycle', 'DJN', mod, L('write'), P.STREAM ? `{${L('stream')}` : L('stream'));
    // The full layout executes the same handoff in both controls.
    if (!P.COMPACT) ins('selectDat', 'MOV', P.FIELD ? 'AB' : 'A', '#0', L('selector'));
    ins('reload', 'MOV', 'F', L('reset'), L('cursor'));
    ins('install', 'MOV', 'I', L('datLoop'), L('cycle'));
    ins('repeat', 'JMP', 'B', L('write'));
    ins('datLoop', 'DJN', 'A', `$${L('write')}-${L('cycle')}`, `$${L('cursor')}-${L('cycle')}`);
    ins('reset', 'DAT', 'F', `#${bursts}`, `#${start}`);
    if (!P.COMPACT) ins('padding', 'DAT', 'F', '#0', '#0');
    ins('selector', 'DAT', 'F', P.FIELD ? '#0' : '#1', P.FIELD ? '#1' : '#0');
    ins('stun', 'SPL', 'B', '#0', '0');
  },
  observe(api) {
    const { hop } = stagedGeometry(api.core, api.P);
    const field = api.P.FIELD ? 'b' : 'a';
    const sites = [0, hop].map((shift, lane) => ({
      name: lane ? 'remote' : 'home',
      selector: api.norm(api.at('selector') + shift),
      writers: sweepWriters.map(label => api.norm(api.at(label) + shift)),
    }));
    return {
      after(event) {
        if (!api.own(event)) return;
        for (const { name, selector, writers } of sites) {
          if (api.wrote(event, selector) && api.peek(selector)[field] === 0) {
            api.phase(`${name}-selector`, { target: selector, writer: event.pc });
          }
          const target = event.operands[1]?.address;
          if (writers.includes(event.pc) && api.wrote(event, target)) {
            api.work(`${name}-attack`, { target });
            if (api.peek(target).op === 'DAT') api.phase(`${name}-first-dat`, { target });
          }
        }
      },
    };
  },
  watch(api) {
    const { vm, at, add, same, P, core } = api;
    const { hop, bursts } = stagedGeometry(core, P);
    const field = P.FIELD ? 'b' : 'a';
    const boot = watchBoot(api, this.id, streamPayload(P), hop);
    const writers = new Map([0, hop].flatMap((shift, lane) => [
      ...sweepWriters.map(label => [add(at(label), shift), { lane, shift, stream: false }]),
      [add(at('cycle'), shift), { lane, shift, stream: true }],
    ]));
    const writes = [0, 0], decrements = [0, 0];
    return {
      before(pc) {
        const action = boot.before(pc);
        const site = writers.get(pc);
        if (!site) return action;
        const { shift, stream } = site;
        const selector = add(at('selector'), shift);
        return { ...site, pc, selector, bomb: stream ? null : vm.peek(add(selector, vm.peek(selector)[field])) };
      },
      after(action) {
        boot.after(action);
        if (!action || typeof action !== 'object') return;
        const { lane, shift, pc, selector, stream, bomb } = action;
        if (stream) {
          if (P.STREAM && decrements[lane] < P.STUN / 2) {
            const target = add(selector, P.STUN / 2 - ++decrements[lane]);
            if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== pc
              || (target === selector && vm.peek(selector)[field] !== 0)) {
              throw new Error('paired-clear-stream: decrement did not reach the expected selector path');
            }
          }
          return;
        }
        const n = writes[lane]++, stun = n < P.STUN;
        const target = add(at('launch'), shift + P.START + (stun ? n : (n - P.STUN) % (2 * bursts)));
        if (bomb.op !== (stun ? 'SPL' : 'DAT') || vm.lastWrite[target] !== vm.steps
          || vm.writerPc[target] !== pc || !same(vm.peek(target), bomb)) {
          throw new Error('paired-clear-stream: out-of-order SPL or DAT write');
        }
      },
      final() {
        if (api.entered() && (!boot.dispatched() || writes.some(n => n <= P.STUN + 2 * bursts)
          || (P.STREAM && decrements.some(n => n !== P.STUN / 2)))) {
          throw new Error('paired-clear-stream: both lanes must switch and restart the DAT pass');
        }
      },
    };
  },
};

const feederImage = ['cursor', 'padding', 'kill', 'feed', 'write', 'writeSecond', 'meter', 'bounce'];
const feederHop = 380;

const pairedClearFeeder = {
  id: 'paired-clear-feeder',
  kind: 'body', exit: 'never', processes: 8, writes: 'core', roams: true, dialects: '94',
  entry: 'launch', entryFirst: false,
  purpose: 'Boots a second clear. Each clear copies the SPL it executes while its queue grows. A reverse decrement stream later redirects the surviving clear to DAT.',
  params: { START: [54, 75], REVERSE: [23, 47] },
  defaults: { START: 58, REVERSE: 31 },
  observationRole: 'paired-clear-feeder',
  mutable: [['launch', ['b']], ['home', ['b']], ['route', ['b']], ['cursor', ['a', 'b']],
    ['feed', ['a']], ['kill', ['a']], ['padding', ['a', 'b']], ['meter', ['b']]],
  knowledge: {
    parameterRoles: { START: 'First attack offset from either cursor', REVERSE: 'Initial reach of the backward decrement from the live SPL' },
    invariants: ['Both sites write while the queue grows.', 'A bomb that overwrites the cursor supplies a restart beyond the image.'],
    evidence: ['docs/tiny-lp-top-ten.md#1-kiss'],
  },
  mismatches(_, settings) {
    return settings.coreSize === 800 && settings.maxProcesses === 8
      ? [] : ['paired-clear-feeder requires an 800-cell ring with an eight-process cap'];
  },
  linked(_P, _settings, _label, { total, shiftedFrame }) {
    return total === 15 && !shiftedFrame ? [] : ['paired-clear-feeder must own its unshifted 15-cell image'];
  },
  emit(ctx) {
    const { ins, L, P, total } = ctx;
    // When a bomb lands on its own cursor, its B-field becomes the new sweep start.
    const resume = `#${total + 3}`;
    ins('cursor', 'DAT', 'F', '#0', `#${P.START}`);
    ins('padding', 'DAT', 'F', '#0', '#0');
    ins('kill', 'DAT', 'F', '#-9', resume);
    ins('feed', 'SPL', 'B', `#-${P.REVERSE}`, resume);
    ins('write', 'MOV', 'I', `@${L('meter')}`, `>${L('cursor')}`);
    ins('writeSecond', 'MOV', 'I', `@${L('meter')}`, `>${L('cursor')}`);
    ins('meter', 'DJN', 'B', L('write'), `{${L('feed')}`);
    ins('bounce', 'JMP', 'B', L('write'), '{-61');
    emitBoot(ctx, 'cursor', feederImage.length, feederHop, 'feed');
  },
  running(api) {
    return liveWorkers(api, feederHop, 'feed', 'bounce')[0] > 0;
  },
  observe(api) {
    const writers = new Map([0, feederHop].flatMap((shift, lane) =>
      sweepWriters.map(label => [api.norm(api.at(label) + shift), lane ? 'remote' : 'home'])));
    return {
      after(event) {
        const site = writers.get(event.pc), target = event.operands[1]?.address;
        if (site && api.own(event) && event.instruction.op === 'MOV' && api.wrote(event, target)) {
          api.work(`${site}-attack`, { target });
          api.phase(`${site}-first-${api.peek(target).op.toLowerCase()}`, { target });
        }
      },
    };
  },
  watch(api) {
    const { vm, at, add, same, P } = api;
    const boot = watchBoot(api, this.id, feederImage, feederHop, 'feed', 'bounce');
    const writers = new Map([0, feederHop].flatMap((shift, lane) =>
      sweepWriters.map(label => [add(at(label), shift), { shift, lane }])));
    const attacked = [false, false];
    let reachedCap = false, homeDat = false;
    return {
      before(pc) {
        const action = boot.before(pc);
        const site = writers.get(pc);
        if (!site || vm.peek(pc).op !== 'MOV') return action;
        const cursor = add(at('cursor'), site.shift), meter = add(at('meter'), site.shift);
        return { ...site, pc, target: add(cursor, vm.peek(cursor).b), bomb: vm.peek(add(meter, vm.peek(meter).b)) };
      },
      after(action) {
        boot.after(action);
        if (action && typeof action === 'object') {
          const { shift, lane, pc, target, bomb } = action;
          if (!attacked[lane] && (reachedCap || bomb.op !== 'SPL' || target !== add(at('cursor'), shift + P.START))) {
            throw new Error('paired-clear-feeder: first attack did not use the live SPL before the process cap');
          }
          if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== pc || !same(vm.peek(target), bomb)) {
            throw new Error('paired-clear-feeder: sweep did not write its live selector source');
          }
          attacked[lane] = true;
          if (lane === 0 && bomb.op === 'DAT') homeDat = true;
        }
        if (!reachedCap && vm.processes(0).length === 8) {
          if (!liveWorkers(api, feederHop, 'feed', 'bounce').every(n => n === 4)) {
            throw new Error('paired-clear-feeder: expected four workers per site at the first cap');
          }
          reachedCap = true;
        }
      },
      final() {
        if (api.entered() && (!boot.dispatched() || !attacked.every(Boolean) || !reachedCap || !homeDat)) {
          throw new Error('paired-clear-feeder: boot, overlapping attack and growth, or DAT handoff was absent');
        }
      },
    };
  },
};

export default [pairedClear, pairedStagedClear, pairedFanClear, pairedStreamClear, pairedClearFeeder];
