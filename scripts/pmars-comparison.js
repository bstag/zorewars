// Compare accepted assembly records; reference execution failures are handled by the caller.
export function compareAssembly(a,b) {
  if(b.crash)return {kind:'crash'};
  if(a.ok&&!a.ins.length&&!b.ok)return {kind:null,agreement:'skippedEmpty'};
  if(a.ok!==b.ok)return {kind:a.ok?'we-reject':'we-accept'};
  if(!a.ok)return {kind:null,agreement:'rejected'};
  if(a.ins.length!==b.ins.length)return {kind:'length'};
  if(a.ins.some((x,k)=>x!==b.ins[k]))return {kind:'instruction'};
  // A start outside the program is out of scope: pMARS warns and keeps it.
  if(a.start!==b.start&&a.start<a.ins.length&&!/outside of the program/.test(a.out))return {kind:'start'};
  return {kind:null,agreement:'accepted'};
}
