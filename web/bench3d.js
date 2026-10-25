// Development helper: times the 3D view on a busy volume battle.
// In the browser console on the arena page: (await import('./bench3d.js')).bench()
import { compile, VM, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { CoreView3D } from './arena3d.js';

export async function bench(frames = 120) {
  const settings = { ...DEFAULT_SETTINGS, topology: 'torus', sizeX: 40, sizeY: 20, sizeZ: 10, coreSize: 8000 };
  const src = await Promise.all(['volume/volumesilk.js', 'volume/star.js'].map((f) => fetch(`../warriors/${f}`).then((r) => r.text())));
  const ws = src.map((s) => compile(s, 'javascript', settings));
  const vm = new VM(settings);
  vm.load(ws, { seed: 5 });
  for (let i = 0; i < 30000; i++) vm.step();          // a crowded core
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-2000px;top:0;width:600px';
  const canvas = document.createElement('canvas');
  holder.appendChild(canvas);
  document.body.appendChild(holder);
  const view = new CoreView3D(canvas);
  view.active = true;
  view.layout(vm.size, vm.geo);
  const t0 = performance.now();
  for (let f = 0; f < frames; f++) { view.yaw += 0.01; view.draw(vm, 200); }
  const ms = (performance.now() - t0) / frames;
  holder.remove();
  return { msPerFrame: +ms.toFixed(2), cells: vm.size };
}
