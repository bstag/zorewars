// Python warriors in the browser, via Pyodide (loaded on first use).
// The Python program uses lang/python/zorewars.py to emit Redcode, exactly
// as it does under the CLI.

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
let pyodidePromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.appendChild(s);
  });
}

export function pythonReady() {
  return pyodidePromise !== null;
}

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await loadScript(PYODIDE_URL);
      const py = await window.loadPyodide();
      const lib = await fetch('../lang/python/zorewars.py').then((r) => r.text());
      py.FS.writeFile('/home/pyodide/zorewars.py', lib);
      return py;
    })().catch((e) => { pyodidePromise = null; throw e; });
  }
  return pyodidePromise;
}

// Loads Pyodide without running anything (so a caller can tell loading from running).
export const loadPython = () => getPyodide();

// One run at a time: the source and settings go through Pyodide's shared
// globals, so a second run starting before the first has read them would
// swap its program in.
let queue = Promise.resolve();
export function generateFromPython(source, settings) {
  const run = queue.then(() => generate(source, settings));
  queue = run.catch(() => {});
  return run;
}

async function generate(source, settings) {
  const py = await getPyodide();
  py.globals.set('__zw_source', source);
  py.globals.set('__zw_coresize', settings.coreSize);
  py.globals.set('__zw_maxproc', settings.maxProcesses);
  py.globals.set('__zw_maxlen', settings.maxLength);
  py.globals.set('__zw_mindist', settings.minDistance);
  py.globals.set('__zw_maxcycles', settings.maxCycles);
  const torus = settings.topology === 'torus';
  py.globals.set('__zw_sizex', torus ? settings.sizeX : settings.coreSize);
  py.globals.set('__zw_sizey', torus ? (settings.sizeY ?? 1) : 1);
  py.globals.set('__zw_sizez', torus ? (settings.sizeZ ?? 1) : 1);
  const out = await py.runPythonAsync(`
import sys, importlib
if '/home/pyodide' not in sys.path:
    sys.path.insert(0, '/home/pyodide')
import zorewars
importlib.reload(zorewars)
zorewars.no_auto_print()
zorewars.CORESIZE = __zw_coresize
zorewars.MAXPROCESSES = __zw_maxproc
zorewars.MAXLENGTH = __zw_maxlen
zorewars.MINDISTANCE = __zw_mindist
zorewars.MAXCYCLES = __zw_maxcycles
zorewars.SIZEX = __zw_sizex
zorewars.SIZEY = __zw_sizey
zorewars.SIZEZ = __zw_sizez
__zw_globals = {'__name__': '__main__'}
exec(compile(__zw_source, 'warrior.py', 'exec'), __zw_globals)
zorewars.render()
`);
  return out;
}
