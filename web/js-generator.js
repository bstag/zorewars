// JavaScript generators run in a worker with a time limit. One request at a
// time; a generator that doesn't finish has its worker terminated.
import { generateFromJS } from '../src/engine/generator.js';

const defaultFactory = () => new Worker(new URL('./generator-worker.js', import.meta.url), { type: 'module' });

export function createJsGenerator({ createWorker = defaultFactory, timeoutMs = 3000, fallback = generateFromJS } = {}) {
  let worker = null, broken = false, nextId = 1;
  let tail = Promise.resolve();
  const drop = () => { worker?.terminate(); worker = null; };

  const run = (source, settings) => new Promise((resolve, reject) => {
    if (!broken && !worker) {
      try { worker = createWorker(); } catch { broken = true; }
    }
    // No workers here (or the worker script failed to load): run on the page, as before.
    if (broken) {
      try { resolve(fallback(source, settings)); } catch (e) { reject(e); }
      return;
    }
    const id = nextId++;
    const timer = setTimeout(() => {
      drop();
      reject(new Error(`This code didn't finish within ${timeoutMs / 1000} seconds (an endless loop?), so it was stopped.`));
    }, timeoutMs);
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      clearTimeout(timer);
      if (data.error !== undefined) reject(new Error(data.error)); else resolve(data.redcode);
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      clearTimeout(timer);
      drop();
      broken = true;
      try { resolve(fallback(source, settings)); } catch (e) { reject(e); }
    };
    worker.postMessage({ id, source, settings });
  });

  return function generate(source, settings) {
    const result = tail.then(() => run(source, settings));
    tail = result.catch(() => {});
    return result;
  };
}
