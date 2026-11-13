import { emitSectorTail, sectorSlack, sectorTail } from './lp-sector-clear.js';

const core = 8000;
const orbit = 4000;
const body = ['advance', 'probe', 'attack', 'guard', 'feed', 'clear'];
const sectorBody = ['advance', 'probe', 'attack', 'guard', ...sectorTail];
const sectorStart = 14;
const directions = ['back', 'fore'];
const forwardDelay = 48;
const pairShift = 3961;
const wrap = value => ((value % core) + core) % core;
const pointer = (side, step) => -step + (side === 'back' ? 1 : -1);
const key = (site, name) => site.tag + name;

function sites({ HOP, STEP }, pairCount) {
  return Array.from({ length: pairCount }, (_, pair) => directions.map((side, i) => ({
    side, pair, tag: pair ? `${side}${pair + 1}` : side, hop: HOP + pair * pairShift + i * 2 * STEP,
    step: i === 0 ? -STEP : STEP,
  }))).flat();
}

function deployed(api, pairCount) {
  const base = api.at('launch');
  return sites(api.P, pairCount).map(site => ({
    ...site, base: wrap(base + site.hop),
    pointer: wrap(base + site.hop + pointer(site.side, api.P.STEP)),
  }));
}

const phase = (pair, name) => pair ? `pair-${pair + 1}-${name}` : name;
const delay = site => site.pair ? `delay${site.pair + 1}` : 'delay';

function transparentScanners(pairCount, partitioned = false) {
  const quartet = pairCount === 2;
  const id = partitioned ? 'lp-partitioned-quartet' : quartet ? 'lp-transparent-quartet' : 'lp-transparent-pair';
  const imageSize = partitioned ? 68 : quartet ? 54 : 26;
  const bodyFor = site => partitioned && site.side === 'back' ? sectorBody : body;
  const addressOf = (site, name) => wrap(site.base + bodyFor(site).indexOf(name));
  return {
    id,
    kind: 'body', exit: 'never', dialects: '94', processes: 2 * pairCount, grows: true, writes: 'core', roams: true,
    entry: 'launch',
    purpose: partitioned
      ? 'Two transparent pairs hand off to counter-driven DAT clears in disjoint forward sectors.'
      : quartet
      ? 'Two opposed A-field scanner pairs scan opposite parities, then share the process queue between late DAT clears and locked peers.'
      : 'Two opposed A-field scanners hide their zero-A code, then a late peer lock and self-hit lead the backward scanner into a DAT clear.',
    params: { HOP: [500, 3600], STEP: [62, 98], ...(partitioned && { WIDTH: [256, 1850] }) },
    defaults: { HOP: 2000, STEP: 78, ...(partitioned && { WIDTH: 1800 }) },
    mutable: sites({ HOP: 2000, STEP: 78 }, pairCount).flatMap(site => [
      ...['count', 'destination', 'source'].map(name => [key(site, name), ['b']]),
      ...(site.side === 'fore' ? [[delay(site), ['b']]] : []),
      ...(partitioned && site.side === 'back' ? [[key(site, 'meter'), ['a']], [key(site, 'clearCursor'), ['b']]] : []),
    ]),
    observationRole: partitioned ? 'partitioned-quartet' : quartet ? 'transparent-quartet' : 'transparent-pair',
    phaseContract: { peerProbe: orbit - 3, selfProbe: orbit - 1, retiresLockedPeer: true, pairs: pairCount, partitioned },
    knowledge: {
      parameterRoles: {
        HOP: 'Distance from loader to the backward body. The forward body is another 2 × STEP away.',
        STEP: 'Magnitude of both signed steps. Its greatest common divisor with 8,000 must be two.',
        ...(partitioned && { WIDTH: 'Writes per meter lap, plus room for pending writes before the FIFO cursor reset.' }),
      },
      invariants: ['Only the probe instruction has a nonzero A field in either copied body.',
        'The backward scanner reaches the peer probe on distinct look 3,997 and its own on look 3,999.'],
      evidence: ['docs/lp-disciples-source.md', 'docs/lp-transparent-pair.md',
        ...(partitioned ? ['docs/lp-partitioned-quartet.md'] : [])],
    },
    mismatches(P, settings) {
      if (settings.topology === 'torus' || settings.coreSize !== core || settings.maxProcesses !== 8) {
        return [`${id} requires the 8,000-cell ring and eight process slots`];
      }
      if (P.STEP % 4 !== 2 || P.STEP % 5 === 0) return [`${id} needs a stride with gcd(STEP, 8000) equal to two`];
      return [];
    },
    linked(P, _settings, _label, { total, shiftedFrame }) {
      if (total !== imageSize || shiftedFrame) return [`${id} owns its unshifted ${imageSize}-cell image`];
      if (!partitioned) return [];
      const backwards = sites(P, pairCount).filter(site => site.side === 'back');
      const protectedCells = new Set(Array.from({ length: total }, (_, i) => i));
      for (const { hop } of backwards) {
        for (let i = 0; i < sectorBody.length; i++) protectedCells.add(wrap(hop + i));
      }
      const touched = new Set();
      for (const { hop } of backwards) {
        for (let i = 0; i < P.WIDTH + sectorSlack; i++) {
          const target = wrap(hop + sectorStart + i);
          if (protectedCells.has(target) || touched.has(target)) return [`${id} has overlapping or unsafe clear sectors`];
          touched.add(target);
        }
      }
      return [];
    },
    emit({ L, P, ins }) {
      const all = sites(P, pairCount);
      if (quartet) {
        ins('launch', 'SPL', 'B', L('pair2'));
        ins('', 'JMP', 'B', L('pair1'));
      }
      for (const site of all) {
        const { side, pair, hop } = site;
        const size = bodyFor(site).length;
        const ref = name => L(key(site, name));
        if (side === 'back') {
          ins(quartet ? `pair${pair + 1}` : 'launch', 'SPL', 'B', L(key(all[pair * 2 + 1], 'copy')));
        }
        ins(key(site, 'copy'), 'MOV', 'I', `<${ref('source')}`, `<${ref('destination')}`);
        ins(key(site, 'count'), 'DJN', 'B', ref('copy'), `#${size + Number(side === 'fore')}`);
        ins('', 'MOV', 'I', ref('seed'), `${L('launch')}+${hop + pointer(side, P.STEP)}`);
        ins(key(site, 'destination'), 'JMP', 'B', `@${ref('destination')}`, `${L('launch')}+${hop + size}`);
        ins(key(site, 'source'), 'DAT', 'F', '#0', `${ref('advance')}+${size}`);
        ins(key(site, 'seed'), 'JMP', 'B', '#0', `$${side === 'back' ? 0 : P.STEP + 2}`);
      }
      for (const site of all) {
        const { side } = site;
        const ref = name => L(key(site, name));
        const cursor = `${ref('advance')}+(${pointer(side, P.STEP)})`;
        // The forward loader finishes before waiting, outside the abandoned image.
        if (side === 'fore') ins(delay(site), 'DJN', 'B', '0', `#${forwardDelay}`);
        ins(key(site, 'advance'), side === 'back' ? 'ADD' : 'SUB', 'B', '#0', cursor);
        ins(key(site, 'probe'), 'JMZ', 'A', ref('advance'), `<${cursor}`);
        // The B field points to the cursor for both the bomb read and target write.
        ins(key(site, 'attack'), 'MOV', 'I', '@0', `>${cursor}`);
        ins(key(site, 'guard'), 'JMN', 'A', '@0', ref('probe'));
        if (partitioned && side === 'back') {
          emitSectorTail((name, ...args) => ins(key(site, name), ...args), ref, P.WIDTH);
        } else {
          ins(key(site, 'feed'), partitioned ? 'JMP' : 'SPL', 'B', '#0', '$0');
          if (partitioned) ins(key(site, 'clear'), 'DAT', 'F', '#0', '#0');
          else ins(key(site, 'clear'), 'MOV', 'I', '@0', `<${ref('advance')}-2`);
        }
      }
    },
    running(api) {
      const workers = api.vm.processes(0);
      return deployed(api, pairCount).some(site => workers.some(pc => wrap(pc - site.base) < bodyFor(site).length));
    },
    observe(api) {
      const all = deployed(api, pairCount);
      const byPc = label => new Map(all.filter(site => bodyFor(site).includes(label)).map(site => [addressOf(site, label), site]));
      const entries = byPc('advance'), probes = byPc('probe'), attacks = byPc('attack');
      const feeds = byPc('feed'), clears = byPc('clear'), resets = byPc('resetCursor');
      const holds = byPc('hold'), checks = byPc('check'), meterResets = byPc('resetMeter');
      const visited = all.map(() => new Set());
      const activeClears = new Set();
      const retiredClears = new Set();
      const queueUsage = Array.from({ length: 3 }, () => ({ turns: 0, sizes: {} }));
      let capRecorded = false;
      let fullFeed = false;
      const allocation = () => {
        const queue = api.processes();
        // The MOV falls through to base + 6. That queued DAT still uses a slot.
        const slots = all.map(site => queue.filter(pc => wrap(pc - site.base) <= bodyFor(site).length).length);
        const roles = queue.map(pc => {
          const { op } = api.peek(pc);
          if (op === 'DAT') return 'queued-dat';
          if (op === 'JMP' && probes.has(pc)) return 'locked';
          if (op === 'SPL' && feeds.has(pc)) return 'feeder';
          if (op === 'JMP' && holds.has(pc)) return 'feeder-return';
          if (op === 'MOV' && clears.has(pc)) return 'clear-writer';
          if (checks.has(pc) || meterResets.has(pc) || resets.has(pc)) return 'clear-control';
          return 'scanning';
        });
        return { queue, slots, roles };
      };
      return {
        before(event) {
          fullFeed = quartet && api.own(event) && feeds.has(event.pc) && event.instruction.op === 'SPL'
            && api.processes().length === api.settings.maxProcesses;
        },
        after(event) {
          if (!api.own(event)) return;
          const { pc, instruction, operands } = event;
          const target = operands[1]?.address;
          const entry = entries.get(pc), probe = probes.get(pc), strike = attacks.get(pc);
          const feed = feeds.get(pc), clear = clears.get(pc);
          if (entry && instruction.op === (entry.side === 'back' ? 'ADD' : 'SUB')) {
            api.phase(phase(entry.pair, `${entry.side}-entry`));
          }
          if (probe && instruction.op === 'JMZ') {
            visited[all.indexOf(probe)].add(target);
            api.work(phase(probe.pair, `${probe.side}-probes`), { target });
          }
          if (strike && instruction.op === 'MOV' && api.wrote(event, target) && api.peek(target).op === 'JMP') {
            const hit = probes.get(target);
            if (hit?.pair === strike.pair) {
              const prefix = strike.side === 'fore' ? 'forward-' : '';
              api.phase(phase(strike.pair, `${prefix}${hit === strike ? 'self' : 'peer'}-lock`), {
                target, distinctProbes: visited[all.indexOf(strike)].size,
              });
            }
          }
          if (feed && instruction.op === 'SPL') {
            const prefix = feed.side === 'fore' ? 'forward-' : '';
            if (!activeClears.has(feed)) {
              api.phase(phase(feed.pair, `${prefix}clear-feed`), quartet ? allocation() : {});
              activeClears.add(feed);
            }
            if (quartet) api.work(phase(feed.pair, `${prefix}feeds`));
            if (fullFeed) api.work(phase(feed.pair, `${prefix}capped-feeds`));
          }
          if (clear && instruction.op === 'MOV' && api.wrote(event, target) && api.peek(target).op === 'DAT') {
            const prefix = clear.side === 'fore' ? 'forward-' : '';
            api.phase(phase(clear.pair, `${prefix}first-dat`), { target });
            api.work(phase(clear.pair, `${clear.side}-dat-writes`), { target });
          }
          const reset = resets.get(pc);
          if (reset && instruction.op === 'MOV' && api.wrote(event, target)) {
            const initial = sectorStart - bodyFor(reset).indexOf('clearCursor');
            api.phase(phase(reset.pair, 'first-reset'), {
              ...allocation(), writesSinceCursorReset: wrap(operands[1].snapshot.b - initial),
            });
            api.work(phase(reset.pair, 'resets'));
          }
          if (probe?.side === 'fore' && instruction.op === 'JMP') {
            api.phase(phase(probe.pair, 'peer-executes-lock'), { target: pc });
          }
          if (probe?.side === 'fore' && instruction.op === 'DAT') {
            const { owner, writerPc } = api.provenance(pc);
            const writer = clears.get(writerPc);
            if (owner === event.actor && writer?.side === 'back') {
              api.phase(phase(probe.pair, 'peer-retires'), { target: pc, ...(quartet && { writerPc, ...allocation() }) });
            }
          }
          if (quartet && activeClears.size) {
            const queue = api.processes();
            if (!capRecorded && queue.length === api.settings.maxProcesses) {
              capRecorded = true;
              api.phase('first-cap', allocation());
            }
            for (const site of activeClears) {
              if (!retiredClears.has(site) && !queue.some(pc => wrap(pc - site.base) <= bodyFor(site).length)) {
                retiredClears.add(site);
                api.phase(phase(site.pair, 'clear-retires'), allocation());
              }
            }
            if (activeClears.size >= 2) {
              const locks = queue.filter(pc => probes.get(pc)?.side === 'fore' && api.peek(pc).op === 'JMP').length;
              const usage = queueUsage[Math.min(2, locks)];
              usage.turns++;
              usage.sizes[queue.length] = (usage.sizes[queue.length] ?? 0) + 1;
            }
          }
        },
        finish() {
          return quartet ? { queueUsage } : {};
        },
      };
    },
    verifyObservation({ phases, phaseContract, work }, report) {
      const issues = [];
      for (let pair = 0; pair < phaseContract.pairs; pair++) {
        if (phases[phase(pair, 'peer-lock')]?.distinctProbes !== phaseContract.peerProbe
          || phases[phase(pair, 'self-lock')]?.distinctProbes !== phaseContract.selfProbe
          || !phases[phase(pair, 'first-dat')]) {
          issues.push(`pair ${pair + 1} missed its late peer lock or self-triggered clear`);
        }
        if (phaseContract.retiresLockedPeer && !phases[phase(pair, 'peer-retires')]) {
          issues.push(`pair ${pair + 1} retained its locked peer`);
        }
      }
      if (phaseContract.pairs === 2 && !partitioned) {
        const cap = phases['first-cap'];
        if (!cap || cap.slots.some((count, i) => count !== (i % 2 ? 1 : 3))
          || cap.roles.filter(role => role === 'locked').length !== 2) {
          issues.push('the two-pair build did not fill its queue with both clear sites and both locks present');
        }
      }
      if (partitioned) {
        for (let pair = 0; pair < pairCount; pair++) {
          const lastWrite = work[phase(pair, 'back-dat-writes')]?.lastCycle ?? -Infinity;
          if (!work[phase(pair, 'resets')] || lastWrite < report.cycleLimit - 64) {
            issues.push(`pair ${pair + 1} did not reset and keep writing to the round limit`);
          }
        }
      }
      return issues;
    },
    watch(api) {
      const { vm, same } = api;
      const lanes = deployed(api, pairCount).map(site => ({
        ...site, visited: new Set(), entered: false, waiting: false, repeat: false, last: null,
      }));
      const pairs = Array.from({ length: pairCount }, (_, i) => ({
        back: lanes[2 * i], fore: lanes[2 * i + 1], peer: false, caught: false, self: false, clear: false,
      }));
      const lookPc = site => wrap(site.base + 1);
      const atOffset = (pc, offset) => lanes.find(site => pc === wrap(site.base + offset));
      return {
        before(pc) {
          for (const pair of pairs) {
            const { fore } = pair;
            if (pc === wrap(fore.base - 1) && !fore.waiting) {
              if (!same(vm.peek(pc), api.code(delay(fore)))) throw new Error(`${id} did not copy the remote delay`);
              fore.waiting = true;
            }
            if (pair.peer && pc === lookPc(fore) && vm.peek(pc).op === 'JMP') pair.caught = true;
          }
          const entry = atOffset(pc, 0);
          if (entry && !entry.entered) {
            if (!bodyFor(entry).every((label, i) => same(vm.peek(entry.base + i), api.code(key(entry, label))))
              || !same(vm.peek(entry.pointer), api.code(key(entry, 'seed')))) {
              throw new Error(`${id} did not deploy an intact body and cursor`);
            }
            entry.entered = true;
          }
          const look = atOffset(pc, 1);
          if (look && vm.peek(pc).op === 'JMZ') {
            const target = wrap(look.pointer + vm.peek(look.pointer).b - 1);
            const expected = look.last === null
              ? wrap(look.base + 1 + look.step * (look.side === 'back' ? 2 : 1))
              : wrap(look.last + (look.repeat ? 0 : look.step));
            if (target !== expected) throw new Error(`${id} went off its signed orbit`);
            look.repeat = false;
            look.last = target;
            look.visited.add(target);
          }
          const strike = atOffset(pc, 2);
          if (strike && vm.peek(pc).op === 'MOV') return { strike, pair: pairs[strike.pair], pc, target: strike.last };
          const pair = pairs.find(({ back, clear }) => (partitioned || !clear) && pc === addressOf(back, 'clear'));
          if (pair && vm.peek(pc).op === 'MOV') {
            const target = partitioned
              ? wrap(addressOf(pair.back, 'clearCursor') + vm.peek(addressOf(pair.back, 'clearCursor')).b)
              : wrap(pair.back.base - 3);
            if (partitioned && wrap(target - pair.back.base - sectorStart) >= api.P.WIDTH + sectorSlack) {
              throw new Error(`${id} wrote past its protected sector`);
            }
            return { pair, pc, target };
          }
          return null;
        },
        after(event) {
          if (!event) return;
          const { strike, pair, pc, target } = event;
          const expected = strike ? 'JMP' : 'DAT';
          if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== pc || vm.peek(target).op !== expected) {
            throw new Error(`${id} did not write the expected trap or clear cell`);
          }
          if (!strike) {
            pair.clear = true;
            return;
          }
          strike.repeat = true;
          if (strike === pair.back && target === lookPc(pair.fore)) pair.peer = strike.visited.size === orbit - 3;
          if (strike === pair.back && target === lookPc(pair.back)) pair.self = pair.peer && strike.visited.size === orbit - 1;
        },
        final() {
          const missedDeployment = lanes.some(site => !site.entered);
          const missedClear = pairs.some(({ peer, caught, self, clear }) => !peer || !caught || !self || !clear);
          // The bounded quick gate stops before the quartet finishes its first orbit.
          if (api.entered() && (missedDeployment || ((pairCount === 1 || vm.steps >= 40000) && missedClear))) {
            throw new Error(`${id} missed its deployment, late peer lock or self-triggered clear`);
          }
        },
      };
    },
  };
}

export default [transparentScanners(1), transparentScanners(2), transparentScanners(2, true)];
