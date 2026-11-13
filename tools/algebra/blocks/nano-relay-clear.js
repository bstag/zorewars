// An original five-cell attack whose first strike rewrites its read cursor.
const core = 80;
const wrap = n => ((n % core) + core) % core;
const gcd = (a, b) => b ? gcd(b, a % b) : a;

function feedbackProbe(base, { CURSOR, RELAY }) {
  const cursor = wrap(base + CURSOR);
  let next = CURSOR + 2;
  while (wrap(next) < 5 || wrap(next) === RELAY) next++;
  return {
    first: wrap(cursor - 1),
    next: wrap(base + next),
    payload: { op: 'DAT', mod: 'F', aMode: '#', a: 7, bMode: '#', b: wrap(next - CURSOR + 1) },
    witness: { op: 'JMP', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 0 },
  };
}

export default {
  id: 'nano-relay-clear', kind: 'body', exit: 'never', processes: 1, grows: true,
  writes: 'sparse', dialects: '94', entry: 'feed',
  purpose: 'Reads through a remote B-predecrement cursor into a relay, then sweeps one Nano residue class with the relayed instruction. The first strike overwrites the cursor the next read uses.',
  params: { CURSOR: [6, 79], RELAY: [5, 79], STEP: [5, 40] },
  defaults: { CURSOR: 37, RELAY: 19, STEP: 8 },
  testedProfiles: ['nano'],
  observationRole: 'cursor-feedback',
  mutable: [['feed', ['b']]],
  knowledge: {
    parameterRoles: { CURSOR: 'Remote read pointer and initial strike', RELAY: 'Staging cell outside the attack orbit', STEP: 'Strike stride modulo 80' },
    invariants: ['The strike orbit excludes the image and relay.', 'The first strike overwrites the remote cursor before the next prime reads it.'],
    evidence: ['docs/hill-block-review.md#a-second-writer-can-stop-an-attack-or-redirect-its-own', 'test/algebra-nano-relay-clear.test.js'],
  },
  mismatches(P, settings) {
    if (settings.coreSize !== core) return ['nano-relay-clear requires the 80-cell ring'];
    const grain = gcd(core, P.STEP), lane = P.CURSOR % grain;
    if (lane < 5 || P.RELAY % grain === lane) return ['nano-relay-clear: the strike orbit intersects the image or relay'];
    return [];
  },
  linked(_P, _settings, _label, { total, shiftedFrame }) {
    return total === 5 && !shiftedFrame ? [] : ['nano-relay-clear must own its unshifted five-cell image'];
  },
  emit({ ins, L, P }) {
    const cursor = L('feed') + '+' + P.CURSOR, relay = L('feed') + '+' + P.RELAY;
    ins('feed', 'SPL', 'B', '#0', '#' + P.CURSOR);
    ins('prime', 'MOV', 'I', '<' + cursor, '$' + relay);
    ins('strike', 'MOV', 'I', '$' + relay, '@' + L('feed'));
    ins('advance', 'ADD', 'AB', '#' + P.STEP, L('feed'));
    ins('', 'JMP', 'B', L('prime'));
  },
  plant(api) {
    const probe = feedbackProbe(api.entry(), api.P);
    return [[probe.first, probe.payload], [probe.next, probe.witness]];
  },
  observe(api) {
    const cursor = wrap(api.at('feed') + api.P.CURSOR);
    let previousWriter, primes = 0;
    return {
      before(event) {
        if (api.matches(event, 'prime')) previousWriter = api.provenance(cursor).writerPc;
      },
      after(event) {
        if (api.matches(event, 'prime') && api.wrote(event, event.operands[1].address)) {
          api.work('relay-writes', { target: event.operands[1].address });
          if (++primes <= 2) {
            api.phase(primes === 1 ? 'first-read' : 'second-read', { source: event.operands[0].address, cursorWriter: previousWriter });
          }
        }
        if (api.matches(event, 'strike') && api.wrote(event, event.operands[1].address)) {
          const target = event.operands[1].address;
          api.work('strike-writes', { target });
          if (target === cursor) api.phase('cursor-replaced', { target });
        }
      },
    };
  },
  watch(api) {
    const { vm, P, at } = api;
    const feed = at('feed'), prime = at('prime'), strike = at('strike'), advance = at('advance');
    const cursor = wrap(feed + P.CURSOR), relay = wrap(feed + P.RELAY);
    const planted = api.scenario === 'nano-relay-clear: planted target';
    const probe = feedbackProbe(feed, P);
    const hit = new Set();
    let primes = 0, strikes = 0, nextStrike = cursor;
    const fresh = (pc, target, value) => {
      if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== pc || !api.same(vm.peek(target), value)) {
        throw new Error('nano-relay-clear: expected a fresh write of the resolved instruction');
      }
    };
    return {
      before(pc) {
        if (pc === prime) {
          const pointer = vm.peek(cursor);
          pointer.b = wrap(pointer.b - 1);
          const source = wrap(cursor + pointer.b);
          if (planted && primes < 2 && source !== (primes === 0 ? probe.first : probe.next)) {
            throw new Error('nano-relay-clear: the previous strike did not redirect the cursor');
          }
          return { pc, pointer, value: source === cursor ? pointer : vm.peek(source) };
        }
        if (pc === strike) {
          const target = wrap(feed + vm.peek(feed).b);
          if (target !== nextStrike || api.inImage(target) || target === relay) {
            throw new Error('nano-relay-clear: strike left its declared orbit');
          }
          return { pc, target, value: vm.peek(relay) };
        }
        if (pc === advance) return { pc, value: vm.peek(feed) };
        return null;
      },
      after(event) {
        if (!event) return;
        const { pc, pointer, target, value } = event;
        if (pc === prime) {
          fresh(pc, cursor, pointer);
          fresh(pc, relay, value);
          primes++;
        } else if (pc === strike) {
          fresh(pc, target, value);
          if (planted && strikes === 0 && !api.same(vm.peek(cursor), probe.payload)) {
            throw new Error('nano-relay-clear: first strike did not install the planted payload in the cursor');
          }
          hit.add(target);
          strikes++;
        } else {
          value.b = wrap(value.b + P.STEP);
          fresh(pc, feed, value);
          nextStrike = wrap(nextStrike + P.STEP);
        }
      },
      final() {
        if (primes < 2 || hit.size !== core / gcd(core, P.STEP)) {
          throw new Error('nano-relay-clear: incomplete feedback sequence or strike orbit');
        }
      },
    };
  },
};
