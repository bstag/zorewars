#!/usr/bin/env node
// The block algebra from the command line (docs/block-algebra.md).
//   node scripts/algebra.js build tree.json --rules 94nop [--length 50] [--out x.red]
//   node scripts/algebra.js build tree.json --verification full --json
//   node scripts/algebra.js observe tree.json [--opponent enemy.red] --json
//   node scripts/algebra.js explain <block> --json
//   node scripts/algebra.js random --rules 88 [--seed 1]      a random tree that passes the gate
//   node scripts/algebra.js recipe compass --rules 94x         a named tree (tools/algebra/recipes.js)
//   node scripts/algebra.js catalog                           writes docs/block-algebra-catalog.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32, RULESETS } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { buildTree, randomTree, leaves, combinators, recipes,describeBlock,observeTree,configureStoneImp,treeSettings } from '../tools/algebra/index.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [command, ...rest] = process.argv.slice(2);
const flags = {}, args = [];
for (let i = 0; i < rest.length; i++) rest[i]==='--json'?flags.json=true:rest[i].startsWith('--') ? (flags[rest[i].slice(2)] = rest[++i]) : args.push(rest[i]);
const rules = flags.rules ?? '94nop', length = Number(flags.length ?? Math.min(50, RULESETS[rules]?.maxLength ?? 50));

function report(built) {
  if(flags['tree-out'])fs.writeFileSync(flags['tree-out'],JSON.stringify(built.tree,null,2));
  if(flags.json){if(flags.out)fs.writeFileSync(flags.out,built.source);console.log(JSON.stringify({source:built.source,total:built.total,shape:built.shape,verification:built.verification,...(built.configuration?{configuration:built.configuration}:{})},null,2));return;}
  if (flags.out) fs.writeFileSync(flags.out, built.source);
  else process.stdout.write(built.source);
  console.error(`${built.shape}: ${built.total} instructions, gate ${built.verification.shape} passed${flags.out ? ` -> ${flags.out}` : ''}`);
}

if (command === 'build') {
  const text = args[0] === '-' || !args[0] ? fs.readFileSync(0, 'utf8') : fs.readFileSync(args[0], 'utf8');
  report(buildTree(JSON.parse(text), { rules, length,verification:flags.verification??'quick' }));
} else if (command === 'configure') {
  const tree=JSON.parse(fs.readFileSync(args[0]??0,'utf8')),options=flags.options?JSON.parse(fs.readFileSync(flags.options,'utf8')):{},limit=Number(flags.length??100),proposal=configureStoneImp(tree,treeSettings(rules,limit),options);
  const built=buildTree(proposal.tree,{rules,length:limit,verification:flags.verification??'full'});built.configuration={before:proposal.before,after:proposal.after,preserved:proposal.preserved,scope:proposal.scope};report(built);
} else if (command === 'random') {
  const settings = recipeSettings(rules, length), random = mulberry32(Number(flags.seed ?? 1));
  for (let i = 0; ; i++) {
    const tree = randomTree(settings, random);
    try { const built = buildTree(tree, { rules, length,verification:flags.verification??'quick' }); console.error(JSON.stringify(tree)); report(built); break; }
    catch (e) { if (i > 200) throw e; }
  }
} else if (command === 'recipe') {
  const r = recipes[args[0]];
  if (!r) { console.error(`recipes: ${Object.keys(recipes).join(', ')}`); process.exit(2); }
  if(r.strictRules&&!r.rules.includes(rules))throw Error(`${args[0]} is profile-tested only for ${r.rules.join(', ')}`);
  report(buildTree(r.tree(rules), { rules, length: Number(flags.length ?? r.length ?? length), name: args[0],verification:flags.verification??r.verification??'quick' }));
} else if (command === 'observe') {
  const built=buildTree(JSON.parse(fs.readFileSync(args[0],'utf8')),{rules,length,verification:flags.verification??'quick'}),base=Number(flags.base??0),opponent=flags.opponent?fs.readFileSync(flags.opponent,'utf8'):null;
  const {observation}=observeTree(built,{opponent,positions:opponent?[base,(base+Math.floor(built.settings.coreSize/2))%built.settings.coreSize]:[base],cycles:Number(flags.cycles??built.settings.maxCycles)});
  if(flags.out)fs.writeFileSync(flags.out,JSON.stringify(observation,null,2));
  if(flags.json)console.log(JSON.stringify(observation,null,2));else {console.log(`${observation.scope}: ${observation.cycles} cycles, alive ${observation.alive}`);for(const b of observation.blocks)console.log(`${b.id}: entered ${b.enteredAt}, ${Object.entries(b.work).map(([name,w])=>`${name}=${w.count} (last ${w.lastCycle})`).join(', ')}`);}
} else if (command === 'explain') {
  const description=describeBlock(args[0]);console.log(flags.json?JSON.stringify(description,null,2):`${description.id}: ${description.purpose}\n${JSON.stringify({phaseContract:description.phaseContract,knowledge:description.knowledge},null,2)}`);
} else if (command === 'catalog') {
  const range = (p) => Object.entries(p).map(([k, [lo, hi]]) => `${k} ${lo}–${hi}`).join(', ') || 'none';
  const val = (v) => (typeof v === 'function' ? 'depends on parameters' : v ?? '');
  const caps = (b) => [...(typeof b.needs === 'function' ? ['needs capabilities that depend on parameters'] : (b.needs ?? []).map((c) => `needs ${c}`)), ...(typeof b.provides === 'function' ? ['provides bomb cells (depends on parameters)'] : Object.keys(b.provides ?? {}).map((c) => `provides ${c}`))].join('; ');
  const rows = Object.values(leaves).map((b) => `| \`${b.id}\` | ${b.kind} | ${b.status??(b.file?.startsWith('_')?'draft':'supported')} | ${b.purpose} | ${range(b.params)} | ${val(b.processes)}${b.grows ? ', grows' : ''} | ${b.exit} | ${b.dialects === '94' ? "'94 only" : "'88 and '94"} | ${caps(b)} |`);
  const crows = Object.values(combinators).map((c) => `| \`${c.id}\` | ${c.purpose} | ${c.kids[0]}–${c.kids[1]} | ${range(c.params)} |`);
  const rrows = Object.entries(recipes).map(([name, r]) => `| \`${name}\` | ${r.status??'example'} | ${r.purpose} | ${r.rules.join(', ')} |`);
  const text = `# Block algebra catalog\n\nGenerated by \`node scripts/algebra.js catalog\` from \`tools/algebra/\`; don't edit by hand. The design is in [block-algebra.md](block-algebra.md).\n\n## Blocks\n\n| Block | Kind | Status | What it does | Parameters | Processes | Exits | Dialects | Capabilities |\n|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Combinators\n\n| Combinator | What it does | Members | Parameters |\n|---|---|---|---|\n${crows.join('\n')}\n\n## Recipes\n\nNamed trees in \`tools/algebra/recipes.js\`: \`node scripts/algebra.js recipe <name> --rules <rules>\`.\n\n| Recipe | Status | What it is | Rule sets |\n|---|---|---|---|\n${rrows.join('\n')}\n`;
  const known=[...Object.values(leaves),...Object.values(combinators)].filter(b=>b.knowledge),knowledgeRows=known.map(b=>`| \`${b.id}\` | ${b.observationRole??'composition'} | ${b.phaseContract?'Declared':'Intrinsic checks / observation only'} |`);
  const learned=`\n## Verification and tuning knowledge\n\nUse \`node scripts/algebra.js explain <block> --json\` for parameter roles, linked tuning groups, invariants, known failure modes and evidence. The supported compact pump keeps its legacy underscore filename and loads normally. Other drafts still require explicit \`ALGEBRA_DRAFTS\` activation. [Full verification and observation](block-algebra-verification.md).\n\n| Block or combinator | Observed role | Phase contract |\n|---|---|---|\n${knowledgeRows.join('\n')}\n`;
  fs.writeFileSync(path.join(ROOT, 'docs', 'block-algebra-catalog.md'), text+learned);
  console.log(`docs/block-algebra-catalog.md: ${rows.length} blocks, ${crows.length} combinators`);
} else {
  console.error('usage: node scripts/algebra.js build <tree.json|-> | configure <tree.json> [--options options.json] | observe <tree.json> | explain <block> | random | recipe <name> | catalog [--rules 94nop] [--length 50] [--verification quick|full] [--json] [--seed 1] [--out file] [--tree-out file]');
  process.exit(2);
}
