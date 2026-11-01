// Round-end text, independent of overlays and logging.
import {escapeHtml} from './editor-status.js';
export function roundOutcome(vm,{replaying,roster,colors,touch,colorName}) {
  const result={};
  const log=html=>{result.log=html;};
  const showOverlay=(title,sub,color)=>{result.overlay={title,sub,color};};
  const tag = replaying ? '<span class="replay-tag">Replay:</span> ' : '';
  if (vm.winner !== null && vm.winner !== undefined) {
    const w = vm.warriors[vm.winner];
    log(`${tag}${colorName(vm.winner, w.name)} <b>wins</b> at cycle ${vm.cycle}`);
    showOverlay(`${w.name} wins`, `cycle ${vm.cycle.toLocaleString()} · see "Why it ended" · ${touch ? "tap" : "click"} for a new round`, colors[roster[vm.winner]]);
  } else {
    const survivors = vm.warriors.filter((w) => w.alive);
    const msg = vm.warriors.length === 1
      ? (survivors.length ? `Survived all ${vm.cycle.toLocaleString()} cycles` : `Died at cycle ${vm.cycle}`)
      : `Tie: ${survivors.map((w) => w.name).join(', ')} survived ${vm.cycle.toLocaleString()} cycles`;
    log(`${tag}<b>${escapeHtml(msg)}</b>`);
    showOverlay(vm.warriors.length === 1 ? (survivors.length ? 'Survived' : 'Died') : 'Tie', `${msg} · ${touch ? "tap" : "click"} for a new round`);
  }
  return result;
}
