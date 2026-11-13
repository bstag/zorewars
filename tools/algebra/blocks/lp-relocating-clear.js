// A one-process clear that moves out of the way of its own front.
//
// The idea is the clear of Heavy cavalry (LP hill), as traced in the VM: a forward
// carpet of SPL bombs with two guard cells beside the code that are compared
// every lap; when they differ, because the carpet has come round to the code
// or because an opponent wrote on one, the code copies itself ahead, carries
// its pointer so the carpet continues at the same cell, and goes on from the
// copy. This block is written from that description, not from its code:
//
//   arrive  writes one of its own lines onto both guard cells (GUARD cells
//           before the block and after it), so any bomb on either shows
//   sweep   two bombs a lap through one post-increment pointer (0.5c)
//   watch   `sne.i front, back`: equal, back to the sweep
//   leap    copies the 17 cells LEAP ahead through one cell whose two fields
//           are the source and destination pointers, moves the copy's front
//           pointer back by LEAP (the same cell of the core), overwrites the
//           copy's SPL bomb with the DAT, and jumps to the copy's `arrive`
//
// So the first pass is an SPL carpet, every later pass a DAT clear, and the
// change is made by the first leap; there is no counter and no SPL of its own,
// so it is one process however long it runs.
//
// lp-relocating-clear starts its carpet just past its image. lp-relocating-finisher
// is the same code with three cells after it that aim the front at the cell a
// scanner hands on (`probe`); they are not carried by a leap.
const wrap = (value, core) => ((value % core) + core) % core;
const CELLS = ['ctr', 'arrive', 'mark2', 'sweep', 'sweep2', 'watch', 'again', 'leap', 'count', 'cp', 'more', 'carry', 'arm', 'go', 'ptr', 'sbomb', 'dbomb'];
const N = CELLS.length, at = Object.fromEntries(CELLS.map((name, i) => [name, i]));
const FIXED = ['arrive', 'mark2', 'sweep', 'sweep2', 'watch', 'again', 'leap', 'count', 'cp', 'more', 'carry', 'arm', 'go', 'dbomb'];
const AIM = 3;                                    // the finisher's aiming cells, after the carried code

// Under a switch, a roaming process of the member that runs (a paper's copy, an imp) can execute the
// cell where a member not taken starts, and the gate then counts that member as entered. A block has
// really started only when a process runs its entry while its first instruction is still there.
const started = new WeakMap();
const sameShape = (a, b) => a.op === b.op && a.mod === b.mod && a.aMode === b.aMode && a.bMode === b.bMode;
function entryWatch(api, label) {
  const state = { entered: false }, entry = api.entry(), code = api.code(label);
  started.set(api, state);
  return { state, see(pc) { if (!state.entered && pc === entry && sameShape(api.vm.peek(pc), code)) state.entered = true; } };
}
const notStarted = (api) => !started.get(api)?.entered;

function relocating(id, aimed) {
  const pokeAt = aimed ? 6000 : 600;              // when the gate writes on a guard cell: after any opening has handed on
  return {
    id,
    kind: aimed ? 'finisher' : 'body', exit: 'never', dialects: '94', processes: 1, writes: 'core', roams: true, moves: true, attacks: 'all',
    entry: aimed ? 'aimAt' : 'arrive', entryFirst: false, relocatable: false, protects: 'self',
    ...(aimed ? { needs: ['probe'] } : {}),
    purpose: aimed
      ? 'lp-relocating-clear as a finisher (20 cells, one process): three extra cells aim its SPL carpet at the cell the opening\'s probe points to; it then guards, leaps LEAP ahead and arms its DAT exactly as the body does. A probe that points at or near the finisher only makes the first leap come early.'
      : 'A 17-cell, one-process forward clear (two bombs a lap, 0.5c) that compares a guard cell GUARD before its code with one GUARD after it every lap; when its own front (or an opponent) changes one, it copies itself LEAP ahead, carries its front pointer, and continues from the copy. The first pass lays SPL bombs; the first leap arms the DAT, so every later pass kills.',
    params: { LEAP: [200, 7700], GUARD: [4, 64] },
    defaults: { LEAP: 6180, GUARD: 12 },
    mutable: [['ctr', ['a', 'b']], ['ptr', ['b']]],
    mismatches(P, settings) {
      if (settings.coreSize !== 8000 || settings.maxProcesses !== 8 || settings.topology) {
        return [`${id} requires the 8,000-cell LP ring with eight process slots`];
      }
      const span = N + 2 * P.GUARD + 2;
      return P.LEAP < span + 8 || settings.coreSize - P.LEAP < span + 8 ? [`${id}: LEAP lands the copy on the code it leaves or on its guard cells`] : [];
    },
    linked(P, { coreSize }, label, { total, shiftedFrame }) {
      if (shiftedFrame) return [];
      const low = wrap(label('ctr') + P.LEAP - P.GUARD, coreSize);
      return low < total + P.GUARD || low + N + 2 * P.GUARD > coreSize ? [`${id}: its first leap lands on the warrior`] : [];
    },
    emit(ctx) {
      const { ins, L, P, total, pc } = ctx;
      const start = pc(), front = `${L('ctr')}-${P.GUARD}`, back = `${L('dbomb')}+${P.GUARD}`;
      // The front starts past the back guard and past whatever follows the block in the image.
      const first = Math.max(total - (start + at.ptr), N - at.ptr + P.GUARD) + 1;
      ins('ctr', 'DAT', 'F', '#0', '#0');
      ins('arrive', 'MOV', 'I', L('cp'), front);
      ins('mark2', 'MOV', 'I', L('cp'), back);
      ins('sweep', 'MOV', 'I', L('sbomb'), `>${L('ptr')}`);
      ins('sweep2', 'MOV', 'I', L('sbomb'), `>${L('ptr')}`);
      ins('watch', 'SNE', 'I', front, back);
      ins('again', 'JMP', 'B', L('sweep'), '0');
      ins('leap', 'MOV', 'A', `#${P.LEAP + N}`, L('ctr'));
      ins('count', 'MOV', 'AB', `#${N}`, L('ctr'));
      ins('cp', 'MOV', 'I', `<${L('ctr')}`, `{${L('ctr')}`);
      ins('more', 'JMN', 'B', L('cp'), L('ctr'));
      ins('carry', 'SUB', 'AB', `#${P.LEAP}`, `${L('ptr')}+${P.LEAP}`);
      ins('arm', 'MOV', 'I', L('dbomb'), `${L('sbomb')}+${P.LEAP}`);
      ins('go', 'JMP', 'B', `${L('arrive')}+${P.LEAP}`, '0');
      ins('ptr', 'DAT', 'F', '#0', `#${aimed ? 0 : first}`);
      ins('sbomb', 'SPL', 'B', '#0', '0');
      ins('dbomb', 'DAT', 'F', '#1', '#1');
      if (!aimed) return;
      // The probe's B-field is an offset from the probe; the front pointer counts from ptr.
      const probe = ctx.ref('probe');
      ins('aimAt', 'MOV', 'B', probe, L('ptr'));
      ins('aimFix', 'ADD', 'AB', `#${probe}-${L('ptr')}`, L('ptr'));
      ins('aimGo', 'JMP', 'B', L('arrive'), '0');
    },
    running(api) {
      if (notStarted(api)) return true;
      const code = FIXED.slice(0, -1).map((label) => api.code(label));
      return api.vm.processes(0).some((pc) => code.some((ins) => api.same(api.vm.peek(pc), ins)));
    },
    // An opponent's write on the back guard, once the clear is under way.
    plant(api) {
      return [[api.norm(api.at('dbomb') + api.P.GUARD), { op: 'DAT', mod: 'F', aMode: '#', a: 7, bMode: '#', b: 7 }, pokeAt]];
    },
    watch(api) {
      const { vm, P, norm, same, core } = api;
      const planted = api.scenario === `${id}: planted target`;
      const pure = api.alone && api.total === N, real = entryWatch(api, aimed ? 'aimAt' : 'arrive');
      let home = api.at('ctr');
      const cell = (label) => norm(home + at[label]);
      const front = () => norm(home - P.GUARD), back = () => norm(home + N - 1 + P.GUARD);
      const written = { SPL: 0, DAT: 0 };
      const leaps = [];
      let lastTarget = null, lastWrite = null, pending = null, aimedAt = null, firstTarget = null;
      return {
        before(pc) {
          real.see(pc);
          if (!real.state.entered) return null;
          if (aimed && aimedAt === null && pc === api.at('aimAt')) {
            const probe = api.ref('probe');
            aimedAt = norm(probe + vm.peek(probe).b);
          }
          if ((pc === cell('sweep') || pc === cell('sweep2')) && same(vm.peek(pc), api.code('sweep' + (pc === cell('sweep') ? '' : '2')))) {
            const ptr = cell('ptr');
            return { kind: 'sweep', target: norm(ptr + vm.peek(ptr).b) };
          }
          if (pc === cell('leap') && same(vm.peek(pc), api.code('leap')) && pending === null) {
            if (same(vm.peek(front()), vm.peek(back()))) throw new Error(`${id} leapt with its guard cells equal`);
            const byFront = lastTarget !== null && (api.rel(lastTarget, front()) < 2 || api.rel(lastTarget, back()) < 2);
            if (!byFront && !planted && pure) throw new Error(`${id} leapt before its front reached the guard`);
            pending = { cycle: vm.cycle, byFront, front: norm(cell('ptr') + vm.peek(cell('ptr')).b) };
            return null;
          }
          if (pc === cell('go') && pending && same(vm.peek(pc), api.code('go'))) {
            const there = (label) => norm(cell(label) + P.LEAP);
            for (const label of FIXED) if (!same(vm.peek(there(label)), api.code(label))) throw new Error(`${id}: ${label} was not carried`);
            if (norm(there('ptr') + vm.peek(there('ptr')).b) !== pending.front) throw new Error(`${id}: the copy does not continue at the same cell`);
            if (!same(vm.peek(there('sbomb')), api.code('dbomb'))) throw new Error(`${id}: the leap did not arm the DAT`);
            return { kind: 'go', target: there('arrive') };
          }
          return null;
        },
        after(event) {
          if (!event) return;
          if (event.kind === 'go') {
            if (vm.processes(0).at(-1) !== event.target) throw new Error(`${id} did not move into its copy`);
            leaps.push({ ...pending, sweeps: written.SPL + written.DAT });
            home = norm(home + P.LEAP); pending = null; lastTarget = null;
            return;
          }
          const { target } = event, op = vm.peek(target).op;
          if (vm.lastWrite[target] !== vm.steps) throw new Error(`${id} lost a write`);
          if (api.rel(target, home) < N) throw new Error(`${id} cleared its own code`);
          if (op !== (leaps.length ? 'DAT' : 'SPL')) throw new Error(`${id} wrote ${op} in its ${leaps.length ? 'DAT' : 'SPL'} pass`);
          firstTarget ??= target;
          written[op]++; lastTarget = target; lastWrite = vm.steps;
        },
        final() {
          if (!real.state.entered) return;
          if (aimed && firstTarget !== aimedAt) throw new Error(`${id} did not start its carpet at the probe`);
          if (lastWrite === null || vm.steps - lastWrite > 4 * N + 16) throw new Error(`${id} stopped clearing`);
          if (planted) {
            // The poked cell is the first home's guard: if the code has already leapt away from it, there is nothing to react to.
            if (!leaps.some((leap) => leap.cycle < pokeAt) && !leaps.some((leap) => leap.cycle >= pokeAt && leap.cycle <= pokeAt + 40)) throw new Error(`${id} did not leap when its guard cell was hit`);
            return;
          }
          // A tree that grows is only run for 20,000 cycles: time for the SPL pass and one leap.
          if (leaps.length < (pure ? 3 : 1)) throw new Error(`${id} did not keep leaping ahead of its front`);
          if (!pure) return;
          if (vm.warriors[0].peak !== 1) throw new Error(`${id} is a one-process clear`);
          // One SPL pass ends when the front comes round to the guard; each later leap follows about LEAP cells of DATs.
          if (!leaps.every((leap) => leap.byFront)) throw new Error(`${id} leapt without its front at a guard`);
          if (written.SPL < core - 3 * N - 4 * P.GUARD - api.total || written.DAT < core) throw new Error(`${id} did not lay an SPL pass and then a DAT pass`);
        },
      };
    },
  };
}

export default [relocating('lp-relocating-clear', false), relocating('lp-relocating-finisher', true)];
