import fs from 'node:fs';
import path from 'node:path';
import { compile } from '../src/engine/index.js';
import { buildAirbag, airbagDefaults, airbagGenerator } from '../tools/blocks/airbag.js';
import { parseTunable } from '../tools/tune.js';
import { hash } from '../tools/blocks/inventory.js';

const [command,...args]=process.argv.slice(2),options={};
if(!['build','verify'].includes(command))throw new Error('Usage: node scripts/airbag.js build|verify [--recipe file] [--generator file] [--out prefix]');
for(let i=0;i<args.length;i+=2) {
  if(!['--recipe','--generator','--out'].includes(args[i])||!args[i+1])throw new Error('Unknown/missing option');
  options[args[i].slice(2)]=args[i+1];
}
const saved=options.recipe?JSON.parse(fs.readFileSync(options.recipe,'utf8')):null;
if(saved?.rules && saved.rules!=='94x')throw new Error('Lifeboat requires 94x');
const generator=options.generator?fs.readFileSync(options.generator,'utf8'):null;
const P=generator?parseTunable(generator).current:saved?.P??airbagDefaults;
const b=buildAirbag(P);
if(generator) {
  const actual=compile(generator,'javascript',b.settings),code=w=>JSON.stringify(w.instructions.map(({line,...x})=>x));
  if(!actual.ok || actual.start!==b.w.start || code(actual)!==code(b.w))throw new Error('Generator code differs from the verified recipe');
}
const receipt={schemaVersion:1,rules:'94x',P,sourceHash:hash(b.source),instructions:b.w.instructions.length,verification:b.verification};
if(command==='build') {
  const out=path.resolve(options.out??'evolved/lifeboat/example');
  for(const suffix of ['.red','.js','.recipe.json'])if(fs.existsSync(out+suffix))throw new Error(`Output already exists: ${out+suffix}`);
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out+'.red',b.source);fs.writeFileSync(out+'.js',airbagGenerator(P));fs.writeFileSync(out+'.recipe.json',JSON.stringify(receipt,null,2)+'\n');
}
console.log(JSON.stringify(receipt,null,2));
