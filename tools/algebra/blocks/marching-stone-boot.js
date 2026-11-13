// Original recurring boot, inspired by Christian Schmidt's Master of the Wins.
// https://asdflkj.net/COREWAR/ODD/HILL32/masterotw.red
const id = 'marching-stone-boot';
const width = 3;
const norm = (x, core) => ((x % core) + core) % core;
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
const copyOffsets = [-1, 0, 1, 2]; // blank source followed by three live cells

function grains(P, core) {
  const boot = gcd(core, P.MARCH);
  return { boot, shot: gcd(boot, P.STRIDE) };
}

export default {
  id, kind: 'body', dialects: '94', entry: 'boot', exit: 'never',
  processes: 2, grows: true, writes: 'sparse', roams: true,
  purpose: 'Recopies a three-instruction stone backward through the SPL that launches it. A fixed lattice keeps the boot, copies, blank sources and bombing targets apart. The controller keeps recopying when the process table fills.',
  params: { FIRST: [1, 54000], MARCH: [1, 54000], STRIDE: [1, 54000], AIM: [1, 54000] },
  defaults: { FIRST: 294, MARCH: 280, STRIDE: 80, AIM: 5 },
  knowledge: {
    tuning: ['The boot stride is the distance between entry destinations. The ADD restores the three consumed address units and then advances by MARCH.', 'Only the stone worker depends on the nearby blank source. A hit there can change which instruction is thrown.'],
    placement: ['Deployment slots and their blank sources are on a lattice determined by MARCH and the core. Shot addresses follow a separate residue class determined by MARCH, STRIDE and the core.'],
    evidence: ['docs/hill-master-launcher.md'],
  },
  mutable: [['fire', ['a']], ['stone', ['b']]],
  mismatches(P, settings) {
    const grain = grains(P, settings.coreSize);
    const out = [];
    if (grain.boot >= settings.coreSize) out.push(`${id}: MARCH must visit more than one slot`);
    if (copyOffsets.some((offset) => norm(P.AIM - offset, grain.shot) === 0)) {
      out.push(`${id}: the shot lattice hits a copy or its blank source`);
    }
    return out;
  },
  linked(P, settings, at, { span }) {
    const grain = grains(P, settings.coreSize);
    const first = at('boot') + P.FIRST;
    for (let pc = 0; pc < span; pc++) {
      if (copyOffsets.some((offset) => norm(pc - first - offset, grain.boot) === 0)) {
        return [`${id}: a copy or blank source overlaps the linked image`];
      }
      if (norm(pc - first - P.AIM, grain.shot) === 0) return [`${id}: a shot overlaps the linked image`];
    }
    return [];
  },
  emit({ ins, L, P }) {
    ins('boot', 'MOV', 'I', `${L('stone')}+2`, `{${L('fire')}`);
    ins('copyMiddle', 'MOV', 'I', `${L('stone')}+1`, `{${L('fire')}`);
    ins('copyFirst', 'MOV', 'I', L('stone'), `{${L('fire')}`);
    ins('fire', 'SPL', 'B', `${L('boot')}+${P.FIRST + width}`);
    ins('advance', 'ADD', 'A', `#${P.MARCH + width}`, L('fire'));
    ins('back', 'JMP', 'B', L('boot'));
    ins('stone', 'MOV', 'I', '-1', `${P.AIM}`);
    ins('', 'ADD', 'AB', `#${P.STRIDE}`, '-1');
    ins('', 'JMP', 'B', '-2');
  },
  running(api) {
    const { vm, at, rel } = api;
    return vm.processes(0).some((pc) => rel(pc, at('boot')) <= rel(at('back'), at('boot')));
  },
  watch(api) {
    const { vm, at, add, norm: wrap, code, same, P } = api;
    const first = add(at('boot'), P.FIRST);
    const seen = new Set();
    let site = first, copied = 0, dispatches = 0, shots = 0;
    return {
      before(pc) {
        if (pc === at('fire')) return { kind: 'split', size: vm.warriors[0].queue.size };
        if (pc === at('boot') || pc === at('copyMiddle') || pc === at('copyFirst')) return { kind: 'copy', pc };
        if (seen.has(pc)) return { kind: 'shot', pc, target: add(pc, vm.peek(pc).b), source: vm.peek(add(pc, -1)) };
        const worker = add(pc, -1);
        if (seen.has(worker)) return { kind: 'stride', worker, want: wrap(vm.peek(worker).b + P.STRIDE) };
        return null;
      },
      after(event) {
        if (!event) return;
        if (event.kind === 'copy') {
          const index = width - 1 - copied, target = add(site, index);
          if (copied >= width || vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== event.pc
            || api.inImage(target) || !same(vm.peek(target), code('stone', index))) {
            throw new Error(`${id}: copy was not written intact in reverse order`);
          }
          copied++;
          return;
        }
        if (event.kind === 'split') {
          if (copied !== width || add(at('fire'), vm.peek(at('fire')).a) !== site) {
            throw new Error(`${id}: split did not target a complete copy`);
          }
          const queue = vm.processes(0);
          const added = event.size < api.settings.maxProcesses;
          if (queue.length !== event.size + Number(added)
            || queue.at(added ? -2 : -1) !== at('advance') || (added && queue.at(-1) !== site)) {
            throw new Error(`${id}: incorrect parent or child queue after split`);
          }
          seen.add(site);
          site = wrap(site + P.MARCH);
          copied = 0;
          dispatches++;
          return;
        }
        if (event.kind === 'stride') {
          if (vm.peek(event.worker).b !== event.want) throw new Error(`${id}: the stone did not advance its shot pointer`);
          return;
        }
        if (vm.lastWrite[event.target] !== vm.steps || vm.writerPc[event.target] !== event.pc
          || api.inImage(event.target) || !same(vm.peek(event.target), event.source)) {
          throw new Error(`${id}: the launched stone did not make its expected shot`);
        }
        shots++;
      },
      final() {
        if (api.entered() && (dispatches < 2 || !shots)) throw new Error(`${id}: expected repeated deployment and a worker shot`);
      },
    };
  },
};
