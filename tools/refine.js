// Model-guided refinement: a language model reads a warrior with its
// post-mortems and proposes targeted rewrites, which are kept only if they
// beat the current version on fresh seeds.
//
// Each iteration:
//   1. play the warrior against the field and find its worst opponents;
//   2. replay a lost round against each with a post-mortem (killing blow,
//      causes of death, the warrior's ending code against the original);
//   3. ask the model for a few rewrites, each a different idea, along with
//      what earlier iterations tried and how that went. The model has tools
//      to test its drafts first: compile and run alone, battle one opponent
//      with a post-mortem, and score against the whole field;
//   4. screen the rewrites, then check the best against the current version
//      on fresh seeds, opponent by opponent (paired, as tune does). Only a
//      gain larger than its noise margin replaces the current version.
//
// The model sees our warrior's code and the opponents' names, never the
// opponents' code, so nothing of anyone else's program can end up in ours.
// `propose` is injectable, so tests (and other models) need no network.

import { compile, runMatch, formatPostMortem, measureSpecies } from '../src/engine/index.js';
import { evaluate } from './hill.js';
import { pairedGain } from './tune.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';

// Dollars per million tokens, for the spending estimate and the budget.
// Cache writes cost 1.25x input; an unknown model has no estimate (and no budget).
const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
export function costOf(usage, model) {
  const p = PRICES[model];
  if (!p) return null;
  return ((usage.input_tokens ?? 0) * p.input + (usage.cache_creation_input_tokens ?? 0) * p.input * 1.25
    + (usage.cache_read_input_tokens ?? 0) * p.cacheRead + (usage.output_tokens ?? 0) * p.output) / 1e6;
}

function systemPrompt(settings, maxLength, turns) {
  const dialect = settings.dialect === '88'
    ? "ICWS'88 Redcode: DAT MOV ADD SUB JMP JMZ JMN DJN CMP SPL SLT only, modes # $ @ <, no modifiers, no ORG (use END label)."
    : "ICWS'94 Redcode with modifiers (.A .B .AB .BA .F .X .I), modes # $ @ * < { > }, ORG and END.";
  return [
    'You are an expert Core War player improving a warrior for a tournament.',
    `Battlefield: core size ${settings.coreSize}, at most ${maxLength} instructions per warrior, ${settings.maxProcesses} processes, ${settings.maxCycles} cycles per round, minimum distance ${settings.minDistance}${settings.pSpace === false ? ', no P-space' : ''}.`,
    `Language: ${dialect} Labels are case-insensitive, so never name a label after an opcode (dat, spl, mov...).`,
    'Scoring: win 3, tie 1, loss 0 per round; the score is the average over a field of strong opponents.',
    'You will see the warrior, its results per opponent, and post-mortems of rounds it lost. Diagnose why it loses, then write improved versions.',
    'Test your drafts before you submit them: `check` compiles a draft and runs it alone (a warrior that dies alone kills itself), `battle` plays one opponent and shows a post-mortem of a lost round, `score` plays the whole field. Fix what the tests show.',
    `You have about ${turns} turns in all, so spend them on the ideas that test well. Finish by calling \`submit\` once with your versions.`,
    'Each version must be a complete, working program written by you, built from the current warrior. Make each version test a different idea: a constant, a step size, a decoy, a different clear, a boot, a change of strategy.',
    'Keep the ;name line; put a short ;strategy line describing the version.',
  ].join('\n');
}

function userPrompt({ source, rows, mortems, history, variants }) {
  const table = rows.map((r) => `  ${r.name.padEnd(28)} won ${r.w}, lost ${r.l}, tied ${r.t}  (${r.pts.toFixed(2)} points/round)`).join('\n');
  const tried = history.length
    ? history.map((h) => `- ${h.idea} -> ${h.outcome}`).join('\n')
    : '(nothing yet)';
  return [
    'Current warrior:', '```redcode', source.trim(), '```', '',
    'Results per opponent:', table, '',
    ...mortems.flatMap((m) => [`Post-mortem of a round lost to ${m.name} (losses here: ${m.symptoms}):`, '```', m.text.trim(), '```', '']),
    'Already tried in earlier iterations (avoid repeating failures):', tried, '',
    `Test drafts with the tools, then submit ${variants} improved versions.`,
  ].join('\n');
}

const TOOL_SPECS = {
  check: {
    description: 'Compile a draft and run it alone for one round. Reports compile errors, length, whether it survives alone, and its behaviour (processes, cells executed).',
    inputSchema: { type: 'object', properties: { redcode: { type: 'string' } }, required: ['redcode'], additionalProperties: false },
  },
  battle: {
    description: 'Play a draft against one opponent of the field (by name). Reports wins, losses and ties and a post-mortem of the first round the draft lost.',
    inputSchema: { type: 'object', properties: { redcode: { type: 'string' }, opponent: { type: 'string' } }, required: ['redcode', 'opponent'], additionalProperties: false },
  },
  score: {
    description: 'Play a draft against the whole field. Reports its points per round overall and against each opponent.',
    inputSchema: { type: 'object', properties: { redcode: { type: 'string' } }, required: ['redcode'], additionalProperties: false },
  },
  submit: {
    description: 'Submit your final versions. Call once, at the end.',
    inputSchema: {
      type: 'object',
      properties: {
        variants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idea: { type: 'string', description: 'One sentence: what this version changes and why.' },
              redcode: { type: 'string', description: 'The complete warrior in Redcode.' },
            },
            required: ['idea', 'redcode'],
            additionalProperties: false,
          },
        },
      },
      required: ['variants'],
      additionalProperties: false,
    },
  },
};

// The default proposer: Claude via the Anthropic SDK (an optional dependency),
// running the testing tools in the SDK's tool runner until it submits. The key
// comes from ANTHROPIC_API_KEY (or another credential the SDK finds).
export async function claudeProposer({ model = DEFAULT_MODEL, effort = 'high', turns: maxTurns = 20 } = {}) {
  let Anthropic, betaTool;
  try {
    ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
    ({ betaTool } = await import('@anthropic-ai/sdk/helpers/beta/json-schema'));
  } catch {
    throw new Error('refine needs the Anthropic SDK: npm install @anthropic-ai/sdk');
  }
  const client = new Anthropic();
  // budget: dollars this call may spend. Near it, tool results ask the model to
  // submit; at it, the call stops.
  return async ({ system, prompt, tools, budget = Infinity }) => {
    let submitted = null, spent = 0;
    const run = { ...tools, submit: async ({ variants }) => { submitted = variants; return 'Submitted.'; } };
    const defs = Object.entries(TOOL_SPECS).map(([name, spec]) => betaTool({ name, ...spec, run: async (input) => {
      // The runner doesn't validate inputs against the schema: check the fields used.
      for (const k of spec.inputSchema.required) if (input?.[k] === undefined) return `Error: missing "${k}".`;
      const nudge = name !== 'submit' && spent > 0.75 * budget ? '\n(The budget is nearly spent: submit your versions now.)' : '';
      try { return (await run[name](input)) + nudge; } catch (e) { return `Error: ${e.message}${nudge}`; }
    } }));
    const runner = client.beta.messages.toolRunner({
      model, max_tokens: 32000, max_iterations: maxTurns, stream: true,   // turns this long must stream
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',   // a declined request is retried on Anthropic's fallback model
      output_config: { effort },
      cache_control: { type: 'ephemeral' },   // every turn resends the conversation: cache it
      system, tools: defs, messages: [{ role: 'user', content: prompt }],
    });
    const usage = { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 };
    const fail = (text) => Object.assign(new Error(text), { usage });   // a failed call still spent tokens
    let last = null, turns = 0;
    try {
      for await (const stream of runner) {
        const message = await stream.finalMessage();
        last = message; turns++;
        for (const k in usage) usage[k] += message.usage?.[k] ?? 0;
        spent = costOf(usage, model) ?? 0;
        if (!submitted && spent >= budget) break;   // out of budget: stop here
      }
    } catch (e) { throw fail(e.message); }
    if (!submitted) {
      if (last?.stop_reason === 'refusal') throw fail(`the model declined${last.stop_details?.category ? ` (${last.stop_details.category})` : ''}`);
      throw fail(`the model did not submit (${spent >= budget ? `budget of $${budget.toFixed(2)} spent` : `stopped: ${last?.stop_reason ?? 'no reply'}`} after ${turns} turns)`);
    }
    return { variants: submitted, usage, turns, model: last?.model };
  };
}

export async function refine({ pool, source, field, settings, entrySettings = settings, propose,
  iterations = 3, variants = 4, rounds = 20, checkRounds = 30, seeds = 3, worst = 3, seed = 1,
  model = DEFAULT_MODEL, turns = 20, budget = Infinity,   // budget: estimated dollars for the whole run
  onProgress = () => {} }) {
  const maxLength = entrySettings.maxLength;
  const build = (src) => compile(src, 'redcode', entrySettings);
  let current = { source, w: build(source), idea: 'starting warrior' };
  if (!current.w.ok) throw new Error(`the starting warrior does not compile: ${current.w.errors[0].message}`);
  const system = systemPrompt(entrySettings, maxLength, turns);
  const cost = () => costOf(usage, model) ?? 0;
  const history = [], log = [];
  const usage = { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 };
  const seedList = Array.from({ length: Math.max(1, seeds) }, (_, i) => seed * 7919 + 5003 + i * 1000);
  // Points per opponent and seed: the samples paired comparisons are made of.
  const samples = async (w, s) => {
    const out = [];
    for (const k of s) out.push(...(await evaluate(pool, w, field, { rounds: checkRounds, seed: k, settings })).rows.map((r) => r.pts));
    return out;
  };
  // A post-mortem of the first round `w` lost to field[i] (our code only), or null.
  const lostRound = (w, i, s) => {
    const m = runMatch([w, field[i].w], { ...settings, rounds: Math.min(rounds, 12) }, { seed: s, report: true });
    const lost = m.rounds.find((x) => x.report && x.winner !== 0 && !x.survivors.includes(0));
    return lost ? formatPostMortem({ ...lost.report, warriors: lost.report.warriors.slice(0, 1) }) : null;
  };
  const draft = (redcode) => {
    const w = build(String(redcode));
    if (!w.ok) throw new Error(`does not compile: line ${w.errors[0].line}: ${w.errors[0].message}`);
    if (w.instructions.length > maxLength) throw new Error(`too long: ${w.instructions.length} instructions (limit ${maxLength})`);
    return w;
  };

  for (let it = 1; it <= iterations; it++) {
    if (cost() >= budget) { log.push({ iteration: it, error: `budget of $${budget.toFixed(2)} spent` }); break; }
    const screenSeed = seed + it * 101, toolSeed = screenSeed + 50021;
    onProgress(`iteration ${it}: playing the field`);
    const base = await evaluate(pool, current.w, field, { rounds, seed: screenSeed, settings, diagnose: true });
    const losers = base.rows.map((r, i) => ({ ...r, i })).sort((a, b) => a.pts - b.pts).slice(0, worst).filter((r) => r.l > 0);
    const mortems = [];
    for (const r of losers) {
      const text = lostRound(current.w, r.i, screenSeed + r.i * 7);
      if (!text) continue;
      const d = r.d ?? {};
      mortems.push({ name: r.name, symptoms: Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', ') || 'none', text });
    }
    // The model's testing tools. They play on their own seed, not the screen's.
    const calls = { check: 0, battle: 0, score: 0 };
    const tools = {
      async check({ redcode }) {
        calls.check++;
        const w = draft(redcode);
        const sp = measureSpecies(w, settings);
        return `Compiles: ${w.instructions.length} instructions. ${sp.survives ? 'Survives alone' : 'DIES ALONE: it kills itself'}; ${sp.processes} processes at most, ${sp.coverage} cells executed (${sp.hint}).`;
      },
      async battle({ redcode, opponent }) {
        calls.battle++;
        const w = draft(redcode);
        const q = String(opponent).toLowerCase();
        const i = field.findIndex((o) => o.name.toLowerCase() === q) >= 0 ? field.findIndex((o) => o.name.toLowerCase() === q)
          : field.findIndex((o) => o.name.toLowerCase().includes(q));
        if (i < 0) throw new Error(`no opponent named "${opponent}"`);
        const r = (await evaluate(pool, w, [field[i]], { rounds, seed: toolSeed + i * 7, settings })).rows[0];
        const pm = r.l ? lostRound(w, i, toolSeed + i * 7) : null;
        return `Against ${field[i].name}: won ${r.w}, lost ${r.l}, tied ${r.t} (${r.pts.toFixed(2)} points/round).${pm ? `\nPost-mortem of a lost round:\n${pm}` : ''}`;
      },
      async score({ redcode }) {
        calls.score++;
        const w = draft(redcode);
        const r = await evaluate(pool, w, field, { rounds, seed: toolSeed, settings });
        return `${r.score.toFixed(2)} points/round over ${field.length} opponents:\n${r.rows.map((x) => `  ${x.name}: ${x.pts.toFixed(2)}`).join('\n')}`;
      },
    };
    onProgress(`iteration ${it}: the model is writing and testing`);
    let proposal;
    try {
      proposal = await propose({ system, prompt: userPrompt({ source: current.source, rows: base.rows, mortems, history, variants }), tools, budget: budget - cost() });
    } catch (e) {
      for (const k in usage) usage[k] += e.usage?.[k] ?? 0;
      log.push({ iteration: it, error: e.message, calls });
      break;
    }
    for (const k in usage) usage[k] += proposal.usage?.[k] ?? 0;
    // Screen every rewrite on the iteration's seed.
    const tried = [];
    for (const v of proposal.variants.slice(0, variants)) {
      let w;
      try { w = draft(v.redcode); } catch (e) { history.push({ idea: v.idea, outcome: e.message }); continue; }
      const r = await evaluate(pool, w, field, { rounds, seed: screenSeed, settings });
      tried.push({ ...v, w, screen: r.score });
    }
    tried.sort((a, b) => b.screen - a.screen);
    const entry = { iteration: it, score: base.score, worst: losers.map((r) => r.name), calls, turns: proposal.turns,
      variants: tried.map((t) => ({ idea: t.idea, screen: t.screen, redcode: t.redcode })) };
    // Check the screen's best (if it beat the current version there) on fresh seeds.
    const top = tried[0];
    if (top && top.screen > base.score) {
      onProgress(`iteration ${it}: checking the best rewrite on fresh seeds`);
      const keys = seedList.map((k) => k + it);
      const [a, b] = [await samples(top.w, keys), await samples(current.w, keys)];
      const { gain, margin } = pairedGain(a, b);
      entry.check = { idea: top.idea, gain, margin };
      if (gain - margin > 0) {
        history.push({ idea: top.idea, outcome: `kept: +${gain.toFixed(2)} points/round (margin ${margin.toFixed(2)})` });
        current = { source: top.redcode, w: top.w, idea: top.idea };
        entry.kept = true;
      } else history.push({ idea: top.idea, outcome: `best on the screen, but ${gain >= 0 ? '+' : ''}${gain.toFixed(2)} on fresh seeds is within the noise (margin ${margin.toFixed(2)})` });
    }
    for (const t of tried.slice(entry.check ? 1 : 0)) {
      history.push({ idea: t.idea, outcome: `screen ${t.screen.toFixed(2)} vs current ${base.score.toFixed(2)}` });
    }
    log.push(entry);
  }
  return { source: current.source, improved: current.source !== source, idea: current.idea, log, history, usage, cost: costOf(usage, model) };
}
