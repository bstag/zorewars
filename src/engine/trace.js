export const MAX_TRACE_TAIL = 100000;

const ENTRY_WIDTH = 9;
const DEATH_CAUSES = [undefined, 'ownCode', 'enemyCode', 'emptyCore', 'divideByZero'];

// Until the trace is read, keep instruction metadata in one word and reuse
// the same numeric slots. Float64 keeps the VM's full step and cycle range.
export class PackedTrace {
  constructor(capacity, geometry) {
    this.capacity = capacity;
    this.data = null;
    this.formats = geometry ? [] : null;
    this.cursor = 0;
    this.count = 0;
  }

  record(vm, pc, warrior, processes) {
    const data = this.data ??= new Float64Array(this.capacity * ENTRY_WIDTH);
    const at = this.cursor;
    data[at] = vm.steps;
    data[at + 1] = vm.cycle;
    data[at + 2] = warrior;
    data[at + 3] = pc;
    data[at + 4] = vm.op[pc] | (vm.mod[pc] << 8) | (vm.aMode[pc] << 16) | (vm.bMode[pc] << 24);
    data[at + 5] = vm.a[pc];
    data[at + 6] = vm.b[pc];
    data[at + 7] = processes;
    data[at + 8] = 0;
    if (this.formats) this.formats[at / ENTRY_WIDTH] = vm.geo?.format;
    this.cursor = at + ENTRY_WIDTH === data.length ? 0 : at + ENTRY_WIDTH;
    if (this.count < this.capacity) this.count++;
  }

  markDeath(cause) {
    const end = this.cursor || this.data.length;
    this.data[end - 1] = DEATH_CAUSES.indexOf(cause);
  }

  unpack(size) {
    const entries = [];
    let at = this.count === this.capacity ? this.cursor : 0;
    for (let i = 0; i < this.count; i++) {
      const [step, cycle, warrior, pc, word, a, b, processes, death] = this.data.subarray(at, at + ENTRY_WIDTH);
      entries.push({ step, cycle, warrior, pc, op: word & 255, mod: (word >>> 8) & 255,
        am: (word >>> 16) & 255, bm: word >>> 24, a, b, processes,
        format: this.formats?.[at / ENTRY_WIDTH], size, died: DEATH_CAUSES[death] });
      at += ENTRY_WIDTH;
      if (at === this.data.length) at = 0;
    }
    return entries;
  }
}

export function createTraceStorage(size, geometry) {
  return Number.isInteger(size) && size > 0 && size <= MAX_TRACE_TAIL ? new PackedTrace(size, geometry) : [];
}
