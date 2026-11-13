// A read-only FIFO mirror. Claims label the first entry; continuations and
// admitted children keep the label even if their instructions change.
export function createFifoLineage(vm, warrior = 0) {
  const queue = vm.warriors[warrior].queue;
  const tags = new Int32Array(queue.buf.length).fill(-1);
  let pending = null;
  return {
    before(claim) {
      if (pending) throw new Error('Finish the previous lineage step first');
      if (vm.turn !== warrior) return;
      const { head, size } = queue;
      const pc = queue.buf[head];
      const tag = tags[head] < 0 ? (claim(pc) ?? -1) : tags[head];
      pending = { pc, tag, size, step: vm.steps + 1 };
    },
    after() {
      if (!pending) return null;
      if (vm.steps !== pending.step) throw new Error('Lineage observation requires exactly one VM step');
      const { size, head, buf } = queue;
      const count = size - (pending.size - 1);
      if (count < 0 || count > 2) throw new Error('Unexpected lineage successor count');
      const successors = [];
      for (let i = size - count; i < size; i++) {
        const index = (head + i) % buf.length;
        tags[index] = pending.tag;
        successors.push(buf[index]);
      }
      const result = { ...pending, successors };
      pending = null;
      return result;
    },
    snapshot() {
      if (pending) throw new Error('Finish the current lineage step before reading the queue');
      return [...queue].map((pc, i) => ({ pc, tag: tags[(queue.head + i) % tags.length] }));
    },
  };
}
