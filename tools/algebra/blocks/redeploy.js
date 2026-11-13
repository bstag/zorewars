// redeploy: a second deployment of a body that a `boot` (SHARE 1) already
// carries, so a switch can boot the same payload to two places without a
// second copy of its code (the Sunset shape: one scanner reached by two boots,
// beside a paper/stone). Written from scratch. Any rule set, ring only.
//
//   switch(boot{SHARE 1, HOP a}(x), redeploy{HOP b}, ...)
//
// The boot provides `payload`, `payloadEnd` and `payloadEntry`: the first
// cell of x, the cell after it and x's entry. This block copies those cells
// HOP away from the source, last cell first, and jumps into the copy:
//
//   rdGo   mov.i <rdSrc, <rdDst
//          djn   rdGo, rdCnt
//          jmp   payloadEntry + HOP
//   rdSrc  dat   0, payloadEnd
//   rdDst  dat   0, payloadEnd + HOP
//   rdCnt  dat   0, payloadEnd - payload
//
// Six cells, whatever x is: it saves the size of x minus six (the boot's own
// copy loop is six cells too). Its watch checks what the boot's would: the
// copy holds x cell for cell and lies clear of the warrior, the jump lands on
// x's entry in the copy, and a process runs there afterwards. It does not run
// x's own watch on this copy (the gate watches x where the boot puts it); x's
// own checks hold for the boot's deployment.
// The capabilities of shared payload k (boot SHARE k), as tools/algebra/contracts.js names them.
const caps = (k) => (k === 1 ? ['payload', 'payloadEnd', 'payloadEntry'] : [`payload${k}`, `payload${k}End`, `payload${k}Entry`]);
const redeploy = {
  id: 'redeploy',
  kind: 'body', exit: 'never', writes: 'sparse', roams: true,
  processes: (P) => P.PROCS,
  purpose: 'A second deployment of the payload a boot with SHARE FROM carries (a leaf or a whole subtree): copies its cells HOP from where they lie in the image and jumps to its entry in the copy, in six cells whatever its size, so a switch can boot one payload to two places without a second copy of its code. Up to four payloads per tree, one boot each (SHARE 1 to 4). PROCS is the most processes the payload runs (it declares nothing itself).',
  params: { HOP: [256, 54000], PROCS: [1, 64], FROM: [1, 4] },
  defaults: { HOP: 3000, PROCS: 1, FROM: 1 },
  entry: 'rdGo',
  needs: (P) => caps(P.FROM),
  mutable: [['rdSrc', ['b']], ['rdDst', ['b']], ['rdCnt', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, h = ((P.HOP % core) + core) % core, out = [];
    if (h < 256 || core - h < 256) out.push('redeploy: HOP lands on the warrior itself');
    if (settings.topology === 'torus') out.push('redeploy is ring-only');
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx, [cp, ce, cn] = caps(P.FROM), from = ctx.ref(cp), end = ctx.ref(ce), entry = ctx.ref(cn);
    ctx.ins('rdGo', 'MOV', 'I', `<${L('rdSrc')}`, `<${L('rdDst')}`);
    ctx.ins('', 'DJN', 'B', L('rdGo'), L('rdCnt'));
    ctx.ins('rdJmp', 'JMP', 'B', `${entry}+${P.HOP}`, '0');
    ctx.ins('rdSrc', 'DAT', 'F', '#0', `#(${end}-${L('rdSrc')})`);
    ctx.ins('rdDst', 'DAT', 'F', '#0', `#(${end}+${P.HOP}-${L('rdDst')})`);
    ctx.ins('rdCnt', 'DAT', 'F', '#0', `#(${end}-${from})`);
  },
  // Running: a process in the deployed copy.
  running(api) {
    const [cp, ce] = caps(api.P.FROM), from = api.ref(cp), size = api.rel(api.ref(ce), from), dst = api.add(from, api.P.HOP);
    return api.vm.processes(0).some((q) => api.rel(q, dst) < size);
  },
  watch(api) {
    const { vm, P } = api, [cp, ce, cn] = caps(P.FROM);
    const from = api.ref(cp), size = api.rel(api.ref(ce), from), dst = api.add(from, P.HOP);
    const want = api.add(api.ref(cn), P.HOP), jmp = api.at('rdJmp');
    let launched = null, ranThere = false;
    return {
      before(pc) {
        if (launched !== null && !ranThere && api.rel(pc, dst) < size && vm.cycle > launched) ranThere = true;
        if (pc !== jmp || launched !== null || !api.same(vm.peek(jmp), api.code('rdJmp'))) return null;
        // The copy is complete: x cell for cell, HOP from its source, clear of the warrior.
        for (let k = 0; k < size; k++) {
          const c = api.add(dst, k);
          if (api.rel(c, api.image.start) < api.image.size) throw new Error('redeploy: the copy lands on the warrior');
          if (!api.same(vm.peek(c), vm.peek(api.add(from, k)))) throw new Error(`redeploy: the copy differs from the payload at cell ${k}`);
        }
        return { jump: true };
      },
      after(tok) {
        if (!tok) return;
        const q = vm.processes(0).at(-1);
        if (q !== want) throw new Error(`redeploy: jumped to ${api.rel(q, dst)} cells into the copy, not to the payload's entry (${api.rel(want, dst)})`);
        launched = vm.cycle;
      },
      final() {
        if (!api.entered()) return;
        if (launched === null) throw new Error('redeploy never launched its copy');
        if (!ranThere) throw new Error('redeploy: nothing ran in the copy after the launch');
      },
    };
  },
};

export default redeploy;
