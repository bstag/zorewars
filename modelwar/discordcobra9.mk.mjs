// discordcobra9.mk.mjs src.red out.red name arms(csv of entry labels) [B=4 LO=-3 HI=12 UP=2 DOWN=2 T=1]
// v8's selector generalised to N random-mode arms. src is a linked switch tree whose first arm is boot(flag-cmp-scanner).
// Weights live in P-space 26..26+N-1 (LO<=w<=HI): +UP after a win with the arm, -DOWN otherwise; drawn in proportion to w+B.
// v9:  node modelwar/link.mjs modelwar/discordcobra9.json t.red 600 && node modelwar/discordcobra9.mk.mjs t.red out.red "Discord Cobra v9" b1boot,b3spBoot,b4boot
// v10: node modelwar/link.mjs modelwar/discordcobra10.json t.red 600 && node modelwar/discordcobra9.mk.mjs t.red out.red "Discord Cobra v10" b1boot,b3spBoot,b4boot,b7scan
import fs from 'node:fs';
const [, , inp, out, name, armsCsv, B = '4', LO = '-3', HI = '12', UP = '2', DOWN = '2', T = '1'] = process.argv;
const arms = armsCsv.split(','); const N = arms.length;
let src = fs.readFileSync(inp, 'utf8').replace(/\r/g, '');
const rep = (a, b) => { if (!src.includes(a)) throw new Error('missing: ' + a); src = src.replace(a, b); };
src = src.replace(/^;name .*$/m, ';name ' + name);
src = src.replace(/^;strategy (.*)$/m, `;strategy $1; after its first loss or tie it plays one of ${N} arms at random (seeded by where its scanner found things), each weighted by how it has done`);
rep('ORG b0start', 'ORG xsel');
rep('b2fcAim MOV.B b2fcPtr, #0', ' STP.B b2fcPtr, #22\nb2fcAim MOV.B b2fcPtr, #0');
rep('b1copyCount DAT.F #0, #17', 'b1copyCount DAT.F #0, #18');
for (const a of arms) if (!new RegExp('^' + a + ' ', 'm').test(src)) throw new Error('no label ' + a);
let s = `xsel LDP.AB #20, xm
 LDP.AB #0, xres
 SLT.AB #${T - 1}, xm
 JMP.B xnorm, 0
 LDP.AB #25, xa
`;
for (let i = 0; i < N; i++) s += ` LDP.AB #${26 + i}, xw${i ? '+' + i : ''}\n`;
s += ` ADD.B xa, xp
 SEQ.AB #1, xres
 SUB.AB #${+UP + +DOWN}, @xp
 ADD.AB #${UP}, @xp
 SLT.AB #${+HI}, @xp
 JMP.B xlo, 0
 SLT.AB #12600, @xp
 MOV.AB #${+HI}, @xp
xlo SLT.AB #12600, @xp
 JMP.B xsto, 0
 SLT.AB #${25200 + +LO - 1}, @xp
 MOV.AB #${+LO}, @xp
xsto ADD.AB #26, xa
 STP.B @xp, xa
 LDP.AB #21, xs
 LDP.AB #22, xe
 MUL.AB #421, xs
 ADD.B xe, xs
 ADD.AB #9973, xs
 STP.B xs, #21
 DIV.AB #25, xs
 MOV.B xw, xt
`;
for (let i = 1; i < N; i++) s += ` ADD.B xw+${i}, xt\n`;
s += ` ADD.AB #${N * B}, xt
 MOD.B xt, xs
 ADD.AB #${B}, xw
`;
for (let i = 0; i < N - 1; i++) {
  s += ` SLT.B xs, xw
 JMP.B x${i + 1}, 0
 STP.AB #${i}, #25
 JMP.B ${arms[i]}, 0
x${i + 1} ${i + 1 < N - 1 ? `ADD.B xw+${i + 1}, xw\n ADD.AB #${B}, xw\n` : ''}`;
}
s += `STP.AB #${N - 1}, #25
 JMP.B ${arms[N - 1]}, 0
xnorm JMZ.B xup, xres
 SEQ.AB #1, xres
 JMP.B xtie, 0
 JMZ.B b0start, xm
 SUB.AB #1, xm
 JMP.B xst, 0
xup ADD.AB #1, xm
xst STP.B xm, #20
 JMP.B b0start, 0
xtie SNE.AB #2, xres
 JMP.B xup, 0
 JMP.B b0start, 0
xm DAT.F #0, #0
xres DAT.F #0, #0
xs DAT.F #0, #0
xe DAT.F #0, #0
xt DAT.F #0, #0
xa DAT.F #0, #0
xp DAT.F #0, #xw-xp
xw DAT.F #0, #0
`;
for (let i = 1; i < N; i++) s += ` DAT.F #0, #0\n`;
rep('b0start LDP.AB #0, b0result', s + 'b0start LDP.AB #0, b0result');
fs.writeFileSync(out, src);
