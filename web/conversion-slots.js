// Slot installation and status behavior shared by browser conversion actions.
export function conversionTarget(state,slot,maxSlots,makeSlot,confirmReplace) {
  if(state.slots.length<maxSlots){const target=makeSlot(null);state.slots.push(target);state.active=state.slots.length-1;return target;}
  return confirmReplace('All four slots are in use. Replace this warrior with its conversion?')?slot:null;
}
export function installConversion(target,slot,lang,result) {
  const label=lang==='python'?'Python':'JavaScript';
  Object.assign(target,{language:lang,source:result.code,libFile:null,edited:false,compiled:null,origin:{name:`${slot.compiled.name}, converted to ${label}`,url:slot.origin?.url??null}});
  return label;
}
export function conversionStatus(lang,ready){return lang==='python'&&!ready?'loading Python to verify the conversion…':'converting…';}
export function clearConversionStatus(status,buttons){for(const b of buttons)b.disabled=false;if(status.textContent.startsWith('converting')||status.textContent.startsWith('loading'))status.textContent='';}
