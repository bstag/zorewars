// Hand-designed '88 architectures. Fast streams use redundant fuses; optional
// checked scans add hard bounds. Clears use independent pointer bounds instead
// of mutable loop counters. Unrolling amortises checks within 50 cells.
const header = (name, strategy) => `;redcode\n;name ${name}\n;author ZoreWars\n;assert CORESIZE == 8000\n;strategy ${strategy}\n`;
const bounds = 'last+1-base';

function stream(event, scan) {
  return `go      SLT #${bounds}+${scan}, base
        JMP ${event}
${Array.from({ length: scan }, (_, i) => `s${i}      DJN ${i === scan - 1 ? 'go' : `s${i + 1}`}, <base\n        JMP ${event}`).join('\n')}
`;
}

function clear(label, bomb, exit, carpet) {
  return `${label}    SLT #${bounds}+${carpet}, base
        JMP ${exit}
${Array.from({ length: carpet }, () => `        MOV ${bomb}, <base`).join('\n')}
        JMP ${label}
`;
}

export function afterimage({ wire, hop, direction }) {
  // Bound both cursors before copying, use the source cursor as termination,
  // and verify the landing point. The entry words are rebuilt independently.
  return header('Afterimage 88', 'Tripwire-triggered moving clear with bounded source, destination and sweep pointers, verified landing, and a rebuilt prologue.') + `
HOP equ ${hop * direction}
src     DAT #0, #0
go      MOV mark, @watch
        MOV #last+1-ptr, ptr
sweep   SLT #last-ptr, ptr
        JMP move
        SLT ptr, #CORESIZE-(ptr-src)-1
        JMP move
        MOV last, @ptr
        ADD #1, ptr
        MOV last, @ptr
        ADD #1, ptr
        CMP mark, @watch
        JMP move
        JMP sweep
move    MOV #last+1-src, src
        MOV #HOP+last+1-dst, dst
copy    SLT #go+2-src, src
        JMP ready
        SLT src, #last+2-src
        JMP move
        SLT #last+1-dst, dst
        JMP move
        SLT dst, #CORESIZE-(dst-src)
        JMP move
        MOV <src, <dst
        JMP copy
ready   CMP #HOP+go+2-dst, dst
        JMP move
        MOV second, <dst
        MOV first, <dst
        JMP @dst
dst     DAT #0, #0
ptr     DAT #0, #0
watch   DAT #0, #go-watch+${wire * direction}
mark    DAT #0, #1
first   MOV mark-go, @watch-go
second  MOV #last+1-ptr, ptr-go-1
last    DAT #0, #0
        END go
`;
}

export function levy({ step, width, guard }) {
  const carpet = Array.from({ length: width }, (_, i) => `${i ? '        ADD shift, fang\n' : ''}        MOV fang, @fang`).join('\n');
  return header('Levy 88', 'Fangs recruit captured enemy processes into a bounded backward clear; the original process only lays fangs.') + `
base    DAT #0, #-1
inc     DAT #${-step - width + 1}, #${step + width - 1}
shift   DAT #1, #-1
go      ADD inc, fang
${carpet}
        JMP go
fang    JMP pit-(${32 - width}-(fang-base)), ${32 - width}-(fang-base)
pit     SLT #${guard}, base
        DAT #0, #0
        MOV bomb, <base
        JMP pit
bomb    DAT #0, #0
        END go
`;
}

export function riptide({ offset, stun, launch = false, ending = 'idle', adaptive = false, scan = 0, carpet = 2 }) {
  if (launch) throw new Error('shared stream pointers require a single process');
  const initial = -Math.max(1, offset);
  const passes = stun ? `prepare MOV #-1, base\n${clear('freeze', 'trap', 'setup', carpet)}` : '';
  const resume = ending === 'pulse' ? `idle    MOV #1, fuse\n        MOV #1, last\n        MOV #${initial}, base\n        JMP go`
    : `idle    JMP ${ending === 'sweep' ? 'setup' : 'idle'}`;
  return header(adaptive ? 'Telltale 88' : 'Riptide 88', adaptive
    ? 'Classify a zeroed word to choose SPL suppression or DAT killing. Redundant scan fuses and independent clear bounds protect the body.'
    : 'B-field corruption followed by DAT killing. Redundant scan fuses and independent clear bounds protect the body.') + `
base    DAT #0, #${initial}
${scan ? stream('contact', scan) : 'go      JMP s0\ns0      DJN s0, <base\n'}${adaptive ? 'contact CMP bomb, @base\n        JMP setup\n' : scan ? `contact JMP ${stun ? 'prepare' : 'setup'}\n` : ''}
${passes}setup   MOV #-1, base
${clear('kill', 'bomb', 'idle', carpet)}${resume}
trap    SPL 0, 0
bomb    DAT #0, #0
fuse    DAT #0, #1
last    DAT #0, #1
        END go
`;
}

export function undercurrent({ offset, tag, scan = 0 }) {
  const initial = -Math.max(1, offset);
  return header('Undercurrent 88', 'Pure B-field sabotage with two matching end markers. Either marker can stop a lap when the other is destroyed.') + `
base    DAT #0, #${initial}
${scan ? stream('check', scan) + `check   SLT #${bounds}+${scan}, base
        JMP reset
        JMP go
` : 'go      DJN go, <base\n        CMP tagword, @base\n        JMP go\n'}reset   MOV #1, fuse
        MOV #1, last
        MOV #${initial}, base
        JMP go
tagword DAT #${tag}, #0
fuse    DAT #${tag}, #1
last    DAT #${tag}, #1
        END go
`;
}

export function telltale(p) {
  return riptide({ ...p, adaptive: true, stun: true, launch: false });
}
