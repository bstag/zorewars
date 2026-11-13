import {definition} from './link.js';

// Knowledge is evidence and interface guidance, not a fitness guarantee.
export function describeBlock(id){
 const def=definition(id);if(!def)throw Error(`Unknown block: ${id}`);
 return structuredClone({id,purpose:def.purpose,kind:def.combinator?'combinator':def.kind,parameters:def.params,defaults:def.defaults,
  observationRole:def.observationRole??null,phaseContract:def.phaseContract??null,knowledge:def.knowledge??{},status:def.status??(def.file?.startsWith('_')?'draft':'supported'),testedProfiles:def.testedProfiles??[],draft:def.status!=='supported'&&!!def.file?.startsWith('_')});
}
