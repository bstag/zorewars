// Post-mortems: why a round ended the way it did.
//
// Built from the forensic records the VM keeps while it runs: who last
// wrote each cell and with which instruction, every process death and its
// cause, and the first time each warrior wrote into, or ran, another's code.

const CAUSES = {
  ownCode: 'its own code or data',
  enemyCode: 'a cell written by an opponent',
  emptyCore: 'empty core (it ran past its own code)',
  divideByZero: 'a division by zero',
};

function signed(v, size) {
  return v > size / 2 ? v - size : v;
}

function formatInstruction(ins, size) {
  return `${ins.op}.${ins.mod} ${ins.aMode}${signed(((ins.a % size) + size) % size, size)}, ${ins.bMode}${signed(((ins.b % size) + size) % size, size)}`;
}

const pad4 = (n) => String(n).padStart(4, '0');

export function postMortem(vm) {
  const size = vm.size;
  const name = (i) => (i >= 0 ? vm.warriors[i]?.name ?? `warrior ${i + 1}` : 'nobody');

  // Everything known about one cell: content, who wrote it, when, and how.
  const cell = (addr) => {
    const p = vm.norm(addr);
    const writer = vm.owner[p];
    const wpc = vm.writerPc[p];
    return {
      addr: p,
      instruction: vm.disassemble(p),
      owner: writer,
      ownerName: writer >= 0 ? name(writer) : null,
      writtenAtCycle: wpc >= 0 ? vm.writeCycle[p] : null,
      writtenBy: wpc >= 0 ? { addr: wpc, instructionNow: vm.disassemble(wpc) } : null,
    };
  };

  // Which program an instruction belongs to: match it against every
  // warrior's original code. (Ownership says who last *wrote* a cell; a
  // converted process may be busy copying an opponent's program.)
  // Exact matches first; then the instruction's shape (opcode, modifier and
  // modes), because running copies change their own data fields.
  const exact = new Map();
  const shape = new Map();
  const shapeOf = (i) => `${i.op}.${i.mod} ${i.aMode} ${i.bMode}`;
  const add = (map, key, idx) => map.set(key, (map.get(key) || new Set()).add(idx));
  for (const w of vm.warriors) {
    for (const ins of w.original) {
      add(exact, formatInstruction(ins, size), w.index);
      add(shape, shapeOf(ins), w.index);
    }
  }
  const programName = (pc) => {
    const set = exact.get(vm.disassemble(pc)) || shape.get(shapeOf(vm.peek(pc)));
    if (!set) return 'other code (bombs or data)';
    if (set.size > 1) return 'an instruction several programs share';
    return `${name([...set][0])}'s program`;
  };

  const warriors = vm.warriors.map((w) => {
    // Ending code: the warrior's original footprint, then and now.
    const code = w.original.map((orig, k) => {
      const now = cell(w.position + k);
      const was = formatInstruction(orig, size);
      return { offset: k, ...now, original: was, changed: was !== now.instruction };
    });
    // Where its live processes are, and whose code they are running.
    const byOwner = {};
    const byProgram = {};
    const hot = new Map();
    for (const pc of w.queue) {
      const prog = programName(pc);
      byProgram[prog] = (byProgram[prog] || 0) + 1;
      const o = vm.owner[pc];
      const key = o === w.index ? 'own code' : o < 0 ? 'empty core' : `${name(o)}'s code`;
      byOwner[key] = (byOwner[key] || 0) + 1;
      hot.set(pc, (hot.get(pc) || 0) + 1);
    }
    const hotspots = [...hot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([pc, count]) => ({ count, ...cell(pc) }));
    const lastDeath = w.lastDeath && {
      ...w.lastDeath,
      causeText: CAUSES[w.lastDeath.cause],
      codeOwnerName: w.lastDeath.codeOwner >= 0 ? name(w.lastDeath.codeOwner) : null,
      writerInstructionNow: w.lastDeath.writerPc >= 0 ? vm.disassemble(w.lastDeath.writerPc) : null,
    };
    return {
      index: w.index,
      name: w.name,
      position: w.position,
      alive: w.alive,
      diedAt: w.diedAt,
      peakProcesses: w.peak,
      finalProcesses: w.queue.size,
      deaths: { ...w.deaths },
      lastDeath,
      foreignSteps: w.foreignSteps,
      foreignFirst: w.foreignFirst && { ...w.foreignFirst, ownerName: name(w.foreignFirst.owner) },
      runningNow: byOwner,
      runningProgram: byProgram,
      hotspots,
      codeIntact: code.filter((c) => !c.changed).length,
      code,
    };
  });

  // Timeline of the moments that shaped the round.
  const timeline = [];
  for (const c of vm.contacts) {
    timeline.push({ cycle: c.cycle, kind: 'contact', text: `${name(c.attacker)} first wrote over ${name(c.victim)}'s memory at ${pad4(c.addr)} (${c.instruction} at ${pad4(c.pc)})` });
  }
  for (const w of warriors) {
    // (Skip the "first ran foreign code" event when that was the fatal step.)
    const fatal = w.lastDeath && w.foreignFirst && w.lastDeath.pc === w.foreignFirst.pc && w.lastDeath.cycle === w.foreignFirst.cycle;
    if (w.foreignFirst && !fatal) {
      timeline.push({ cycle: w.foreignFirst.cycle, kind: 'conversion', text: `${w.name}'s processes first ran code written by ${w.foreignFirst.ownerName} (${w.foreignFirst.instruction} at ${pad4(w.foreignFirst.pc)})` });
    }
    if (!w.alive && w.lastDeath) {
      const d = w.lastDeath;
      const what = d.cause === 'enemyCode' ? `a bomb ${d.codeOwnerName} wrote at cycle ${d.writeCycle}` : d.causeText;
      timeline.push({ cycle: d.cycle, kind: 'eliminated', text: `${w.name} was eliminated: its last process ran ${d.instruction} at ${pad4(d.pc)}, ${what}` });
    }
  }
  timeline.sort((a, b) => a.cycle - b.cycle);

  // The decisive moment: the last process death of the last warrior to fall.
  const fallen = warriors.filter((w) => !w.alive && w.lastDeath).sort((a, b) => a.lastDeath.step - b.lastDeath.step);
  const final = fallen.at(-1);
  let killingBlow = null;
  if (final) {
    const d = final.lastDeath;
    killingBlow = {
      victim: final.name,
      ...d,
      context: Array.from({ length: 7 }, (_, k) => ({ ...cell(d.pc + k - 3), here: k === 3 })),
    };
  }

  const survivors = warriors.filter((w) => w.alive);
  let result;
  if (vm.winner !== null && vm.winner !== undefined) {
    result = { outcome: 'win', winner: name(vm.winner), cycle: vm.cycle };
  } else if (!survivors.length) {
    result = { outcome: 'none survived', cycle: vm.cycle };
  } else {
    result = { outcome: vm.warriors.length === 1 ? 'survived' : 'tie', survivors: survivors.map((w) => w.name), cycle: vm.cycle };
  }

  return { result, summary: summarize(result, warriors, killingBlow), killingBlow, timeline, warriors };
}

function summarize(result, warriors, blow) {
  const parts = [];
  if (result.outcome === 'win') {
    parts.push(`${result.winner} won at cycle ${result.cycle.toLocaleString()}.`);
  } else if (result.outcome === 'tie') {
    parts.push(`Tie: ${result.survivors.join(' and ')} were still running when the cycle limit (${result.cycle.toLocaleString()}) was reached.`);
  } else if (result.outcome === 'survived') {
    parts.push(`Survived all ${result.cycle.toLocaleString()} cycles.`);
  } else {
    parts.push(`No warrior survived (cycle ${result.cycle.toLocaleString()}).`);
  }
  if (blow) {
    const how = blow.cause === 'enemyCode'
      ? `a bomb ${blow.codeOwnerName} wrote at cycle ${blow.writeCycle}${blow.writerInstructionNow ? ` using ${blow.writerInstructionNow} at ${pad4(blow.writerPc)}` : ''}`
      : CAUSES[blow.cause];
    parts.push(`${blow.victim}'s last process ran ${blow.instruction} at ${pad4(blow.pc)}: ${how}.`);
  }
  // Conversions: a survivor whose processes mostly run another program.
  for (const w of warriors) {
    if (!w.alive || !w.finalProcesses) continue;
    const others = Object.entries(w.runningProgram)
      .filter(([k]) => k.endsWith("'s program") && k !== `${w.name}'s program`)
      .sort((a, b) => b[1] - a[1]);
    if (others.length && others[0][1] >= w.finalProcesses / 2) {
      parts.push(`${w.name} has been converted: ${others[0][1].toLocaleString()} of its ${w.finalProcesses.toLocaleString()} processes are running ${others[0][0]}.`);
    }
  }
  return parts.join(' ');
}

// Why a warrior failed to win, one symptom per round (needs rounds played
// with report: true). Used by the tuner and evolver to pick repairs.
//   suicide:   died on its own code, empty core or a divide by zero
//   converted: died after running lots of enemy-written code (stunned or captured)
//   early:     killed by an enemy bomb before cycle 5000 (found fast)
//   late:      killed by an enemy bomb later (worn down)
//   tie:       still alive at the cycle limit with someone else (no kill power)
export function diagnoseRounds(rounds, index = 0) {
  const d = { suicide: 0, converted: 0, early: 0, late: 0, tie: 0 };
  for (const r of rounds) {
    if (!r.report || r.winner === index) continue;
    const me = r.report.warriors[index];
    if (me.alive) { d.tie++; continue; }
    const cause = me.lastDeath?.cause;
    if (cause !== 'enemyCode') d.suicide++;
    else if (me.foreignSteps > 100) d.converted++;
    else if (me.diedAt < 5000) d.early++;
    else d.late++;
  }
  return d;
}

// Plain-text rendering for the CLI.
export function formatPostMortem(r) {
  const out = [];
  out.push(r.summary, '');
  if (r.timeline.length) {
    out.push('Timeline:');
    for (const e of r.timeline) out.push(`  cycle ${String(e.cycle).padStart(6)}  ${e.text}`);
    out.push('');
  }
  if (r.killingBlow) {
    out.push(`Killing blow (${r.killingBlow.victim}, cycle ${r.killingBlow.cycle}):`);
    for (const c of r.killingBlow.context) {
      const who = c.ownerName ? `${c.ownerName}${c.writtenAtCycle !== null ? ` @${c.writtenAtCycle}` : ' (loaded)'}` : 'empty';
      out.push(`  ${c.here ? '>' : ' '} ${pad4(c.addr)}  ${c.instruction.padEnd(24)} ${who}`);
    }
    out.push('');
  }
  for (const w of r.warriors) {
    const d = w.deaths;
    out.push(`${w.name}: ${w.alive ? `alive, ${w.finalProcesses} processes` : `eliminated at cycle ${w.diedAt}`} (peak ${w.peakProcesses})`);
    if (d.total) {
      const causes = Object.entries(d).filter(([k, v]) => k !== 'total' && v).map(([k, v]) => `${v} on ${CAUSES[k]}`);
      out.push(`  ${d.total} process deaths: ${causes.join('; ')}`);
    }
    if (w.alive && Object.keys(w.runningProgram).length) {
      out.push(`  processes are running: ${Object.entries(w.runningProgram).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(', ')}`);
    }
    out.push(`  ending code (${w.codeIntact}/${w.code.length} unchanged, loaded at ${pad4(w.position)}):`);
    for (const c of w.code) {
      const mark = c.changed ? '*' : ' ';
      const now = c.changed ? `${c.instruction.padEnd(24)} ${c.ownerName ? `by ${c.ownerName} @${c.writtenAtCycle}` : ''}` : '';
      out.push(`   ${mark} ${pad4(c.addr)}  ${c.original.padEnd(24)} ${now}`.trimEnd());
    }
    out.push('');
  }
  return out.join('\n');
}
