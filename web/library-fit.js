import { compile, VM, DEFAULT_SETTINGS } from '../src/engine/index.js';

const SLICE_MS = 4;
const INSTRUCTION_BATCH = 512;

// Compatibility results for the picker. Python entries follow the in-process
// warrior they mirror because their generators run separately in Pyodide.
export async function scanLibraryFit(library, settings, {
  signal,
  yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)),
} = {}) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const fit = new Map();
  const resultsByCode = new Map();
  let deadline = performance.now() + SLICE_MS;
  for (const entry of library.filter((e) => e.language !== 'python')) {
    if (signal?.aborted) return null;
    let ok = false;
    if (!(entry.battlefield && cfg.topology !== 'torus')) {
      try {
        const compiled = compile(entry.source, entry.language, cfg);
        if (compiled.ok && cfg.topology !== 'torus') ok = true;
        else if (compiled.ok) {
          // Conversions can emit the same program. Only the loaded instructions
          // and entry point affect this solo run, and every scan has fresh rules.
          const norm = (v) => ((v % cfg.coreSize) + cfg.coreSize) % cfg.coreSize;
          const code = JSON.stringify([compiled.start, compiled.instructions.map((i) =>
            [i.op, i.mod, i.aMode, norm(i.a), i.bMode, norm(i.b)])]);
          if (resultsByCode.has(code)) {
            ok = resultsByCode.get(code);
          } else {
            const vm = new VM(cfg);
            vm.load([compiled], { seed: 1 });
            // Match the solo battle used by fitsBattlefield, including its full
            // cycle limit. The browser must get turns *within* a long battle.
            let remaining = cfg.maxCycles;
            while (remaining > 0 && !vm.done) {
              if (signal?.aborted) return null;
              remaining -= vm.run(Math.min(INSTRUCTION_BATCH, Math.ceil(remaining)));
              if (performance.now() >= deadline) {
                await yieldControl();
                deadline = performance.now() + SLICE_MS;
                if (signal?.aborted) return null;
              }
            }
            ok = vm.warriors[0].alive;
            resultsByCode.set(code, ok);
          }
        }
      } catch { /* cannot play here */ }
    }
    fit.set(entry.file, ok);
    if (performance.now() >= deadline) {
      await yieldControl();
      deadline = performance.now() + SLICE_MS;
    }
  }
  if (signal?.aborted) return null;
  for (const entry of library.filter((e) => e.language === 'python')) {
    const twin = entry.convertedFrom ?? library.find((e) => e.name === entry.name.replace(/ \(Python\)$/, '') && e.language === 'redcode')?.file;
    fit.set(entry.file, twin ? fit.get(twin) !== false : cfg.topology !== 'torus');
  }
  return fit;
}
