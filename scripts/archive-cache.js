// Validated historical source cache. Fetching is injected for offline verification.
import fs from 'node:fs';import path from 'node:path';import{hash}from'../tools/blocks/inventory.js';
export function createArchiveCache({root,cache,base,download,receipts,fetchSource=fetch,retrievedAt=()=>new Date().toISOString()}) {
  const relative=file=>path.relative(root,file).replaceAll('\\','/');
function safeUrl(url) {
  const u=new URL(url);
  if(u.origin!==new URL(base).origin || !u.pathname.startsWith(new URL(base).pathname)) throw new Error('Outside archive: '+url);
}
async function obtain(url) {
  safeUrl(url);
  const old=receipts[url];
  if(old?.status==='downloaded') {
    const file=path.resolve(root,old.cache);
    if(!file.startsWith(cache+path.sep)) throw new Error('Cache path outside archive');
    const bytes=fs.readFileSync(file);
    if(hash(bytes)!==old.sha256) throw new Error('Cached file changed: '+url);
    return bytes;
  }
  if(!download) return null;
  let error;
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const response=await fetchSource(url,{signal:AbortSignal.timeout(15000)});
      safeUrl(response.url);
      if(!response.ok) throw new Error('HTTP '+response.status);
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length>2*1024*1024) throw new Error('File exceeds 2 MiB');
      if(/\.txt(?:$|[?#])/.test(url) && /<html|<!doctype html/i.test(bytes.subarray(0,200).toString())) throw new Error('HTML returned for text source');
      const file=path.join(cache,'files',hash(url)+'.txt');
      fs.writeFileSync(file,bytes);
      receipts[url]={status:'downloaded',resolvedUrl:response.url,cache:relative(file),sha256:hash(bytes),bytes:bytes.length,retrievedAt:retrievedAt()};
      return bytes;
    } catch(e) {error=e.message;}
  }
  receipts[url]={status:'fetch-failed',error};
  return null;
}
  return {obtain};
}
