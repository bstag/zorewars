// Inspector markup and memory provenance, sharing the live VM facade.
import {WARRIOR_COLORS} from './arena.js';
import {escapeHtml} from './editor-status.js';
function inspectorRows(state, center, pad4) {
  const vm = state.vm;
  const rows = [];
  for (let d = -4; d <= 4; d++) {
    const p = vm.norm(center + d);
    const o = vm.owner[p];
    const who = o >= 0 ? `<span style="color:${WARRIOR_COLORS[state.roster[o]]}">${escapeHtml(vm.warriors[o].name)}</span>` : '';
    const running = vm.warriors.some((w) => w.alive && [...w.queue].includes(p)) ? ' ◂ pc' : '';
    const text = `${d === 0 ? '▸' : ' '}${pad4(p)}  ${vm.disassemble(p).padEnd(22)}`;
    rows.push(d === 0 ? `<span class="cur">${escapeHtml(text)}${who}${running}</span>` : `${escapeHtml(text)}${who}${running}`);
  }
  return rows;
}
function cellOrigin(vm, p, colorName, pad4) {
    const o = vm.owner[p];
    const wpc = vm.writerPc[p];
    const origin = o < 0 ? 'Empty core: never written.'
      : wpc < 0 ? `Loaded as part of ${colorName(o, vm.warriors[o].name)}.`
      : `Written by ${colorName(o, vm.warriors[o].name)} at cycle ${vm.writeCycle[p].toLocaleString()}, using ${escapeHtml(vm.disassemble(wpc))} at ${pad4(wpc)}.`;
  return origin;
}
export function paintInspector(state, $, colorName, pad4) {
  const vm = state.vm;
  const addr = state.pinned >= 0 ? state.pinned : state.hover;
  const el = $('inspector');
  const hint = $('inspectHint');
  if (!vm) { el.textContent = ''; return; }
  const ls = state.lastStep;
  let center = addr;
  if (center < 0 && ls && !state.running) center = ls.pc;
  if (center < 0) {
    el.innerHTML = '';
    hint.textContent = 'Hover over the core to read memory. Click to pin.';
    return;
  }
  const rows = inspectorRows(state, center, pad4);
  el.innerHTML = rows.join('\n');
  if (addr < 0 && ls) {
    hint.innerHTML = `Last step: ${colorName(ls.warrior, vm.warriors[ls.warrior].name)} ran address ${pad4(ls.pc)}${ls.killed ? ' and the process <b>died</b>' : ''}.`;
  } else {
    // Where this cell's current contents came from.
    const p = vm.norm(addr);
    const origin = cellOrigin(vm, p, colorName, pad4);
    hint.innerHTML = `${origin} ${state.pinned >= 0 ? `Pinned at ${pad4(state.pinned)}; click again to unpin.` : 'Click to pin.'}`;
    const peek = $('cellPeek');
    peek.hidden = state.pinned < 0;
    if (state.pinned >= 0) peek.innerHTML = `<b>${pad4(p)}</b> ${escapeHtml(vm.disassemble(p))} · ${origin} <span class="muted">Tap again to unpin.</span>`;
  }
}
