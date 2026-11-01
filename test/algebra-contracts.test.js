import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { annotate, iface, combinators, treeMismatches } from '../tools/algebra/link.js';
import { leaves, recipes, treeSettings } from '../tools/algebra/index.js';

// Start the hang deadline after imports, separately from the startup deadline.
function guardedChild(script, executionTimeout=3000) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--input-type=module','-e',script]);
    let stdout='',stderr='',ready=false,timedOut=null;
    const stop=phase=>{timedOut=phase;child.kill('SIGKILL');};
    let timer=setTimeout(()=>stop('module startup'),30000);
    child.stdout.on('data',chunk=>{
      stdout+=chunk;
      if(!ready&&stdout.includes('__ready__\n')){ready=true;clearTimeout(timer);timer=setTimeout(()=>stop('invalid-input processing'),executionTimeout);}
    });
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',status=>{clearTimeout(timer);if(timedOut)reject(Error(timedOut+' timed out'));else resolve({status,stdout:stdout.replace('__ready__\n',''),stderr});});
  });
}

test('invalid parameters are rejected before block-specific calculations can hang', async () => {
  const script = 'import { treeMismatches } from "./tools/algebra/link.js"; import { treeSettings } from "./tools/algebra/index.js"; console.log("__ready__"); console.log(JSON.stringify([0, -1, NaN, Infinity].map(PROCS => treeMismatches({ id: "bomb-paper", P: { PROCS } }, treeSettings("94nop", 100)))));';
  const result=await guardedChild(script);
  assert.equal(result.status,0,result.stderr);
  assert.ok(JSON.parse(result.stdout).every(messages=>messages.some(message=>/PROCS must be an integer/.test(message))));
});

test('hang guard separates startup latency and stops synchronous processing loops',async()=>{
  const delayed=await guardedChild('await new Promise(r=>setTimeout(r,1250)); console.log("__ready__"); console.log("done");',1000);
  assert.equal(delayed.status,0);assert.match(delayed.stdout,/done/);
  await assert.rejects(guardedChild('console.log("__ready__"); while(true){}',1000),/invalid-input processing timed out/);
});

test('parallel boot rejects workers that cannot be watched and replacement copies that collide', () => {
  const ring = treeSettings('94nop', 100);
  const boot = (P = {}, kid = { id: 'mod-stone' }) => ({ id: 'parboot', P: { REACT: 1, ...P }, kids: [kid] });
  const mismatches = (tree, settings = ring) => treeMismatches(tree, settings).join('; ');
  assert.match(mismatches(boot({}, { id: 'opening-none' })), /opening-none must run forever/);
  assert.match(mismatches(boot({}, { id: 'leap' })), /leap moves itself away, so the watchers would lose it/);
  assert.match(mismatches(boot({ HOP2: 100 })), /HOP2 lands on the warrior itself/);

  const volume = treeSettings('94nop', 20, '100x80x10');
  const at = (P) => boot({ HOP: 0, HOPY: 30, HOPZ: 2, HOP2: 10, HOP2Y: 30, HOP2Z: 2, ...P }, { id: 'vector-stone' });
  assert.match(mismatches(at({}), volume), /new copy would land on the first/);
  for (const P of [{ HOP2Y: 31 }, { HOP2Z: 3 }, { HOP2: 50 }]) {
    assert.equal(mismatches(at(P), volume), '', `separate copies: ${JSON.stringify(P)}`);
  }
});

// Captured before splitting iface at 9ec91fb. Every leaf and combinator, varied
// child counts and every recipe are compared across dialects and topologies.
// Derived from the current branch contract implementation before reconciliation.
const snapshots = [
  [
    "88",
    null,
    "adde3ebf6f0bf13e73dcb88668aae593c423791bdca7ae002a32e74ec40efd1b"
  ],
  [
    "94nop",
    null,
    "d5cab95f92e00c035a3ee6a7d7bed6cd65f2032d7bc1c3374a360a3b3e82f4b6"
  ],
  [
    "lp",
    null,
    "9a6c48a54ce677e81b2804acc0a97c1958ed1c490b093f490de492d9039dacc6"
  ],
  [
    "94x",
    null,
    "0e2814a0ac30f61ed98b124bf09c8387720c8579a9bb77d2ec18bb4b52cdfdc6"
  ],
  [
    "94x-hill",
    null,
    "1f6f1151ede8f03535c5587d39a3b192af9f52541c98b4beb71c61860859a392"
  ],
  [
    "94nop",
    "100x80",
    "8b6a76d9cfadfdb5b3e31dd8b7ef5aeb0125acc3699d9473953eb00b42a01fff"
  ],
  [
    "94nop",
    "40x20x10",
    "ca3a06c3ad95a267faad43d019edc62d6de90c6ebde0bba7361156db6fe3f30d"
  ]
];

for (const [rules, torus, expected] of snapshots) test(`contracts preserve ${rules} ${torus ?? 'ring'} behavior`, () => {
  const settings = treeSettings(rules, 100, torus);
  const members = ['stone', 'finisher-counted', 'decoys', 'opening-none', 'paper', 'imp'];
  const trees = Object.keys(leaves).map(id => ({ id }));
  for (const id of Object.keys(combinators)) for (let n = 0; n <= 5; n++) {
    trees.push({ id, kids: Array.from({ length: n }, (_, i) => ({ id: members[i] })) });
  }
  for (const recipe of Object.values(recipes)) trees.push(recipe.tree(rules));
  const hash = createHash('sha256');
  for (const tree of trees) {
    let result;
    try { const out = iface(annotate(tree), settings); result = { ...out, provides: [...out.provides], needs: [...out.needs] }; }
    catch (error) { result = { error: error.message }; }
    hash.update(JSON.stringify(result)).update('\n');
  }
  assert.equal(hash.digest('hex'), expected);
});
