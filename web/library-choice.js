import {fieldKey} from './battlefield.js';
export function librarySwitchPrompt(entry,settings,fit) {
  const field=entry.battlefield??'ring';
  if(fit!==false || (fieldKey(settings)===field&&!settings.rulesName))return null;
  return fieldKey(settings)!==field
    ? `${entry.name} plays on ${field==='ring'?'the ring':`the ${field.replace('torus:','')} battlefield`}. Switch to it?`
    : `${entry.name} doesn't play under the ${settings.rulesName} rules. Switch to the standard rules?`;
}
