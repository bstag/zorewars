// discordcobra8.mk.mjs out.red 1 4 -3 12 "Discord Cobra v8" 2 2 0 rebuilds discordcobra8.red. v7's generator with the low clamp fixed (v7 never raised a weight that fell below LO).
// Arguments: out.red T B LO HI name : Discord Cobra v4b + a three-arm random mode (Discord, Sunset, King Cobra) after T losses or ties.
// Each arm has a weight B+s (s kept in P-space 26-28, LO<=s<=HI): +1 after a win with it, -1 otherwise. Arms are drawn in proportion.
import fs from 'node:fs';
const [, , out, T = '1', B = '3', LO = '-2', HI = '5', name = 'Discord Cobra v7', UP = '1', DOWN = '1', TD = '0'] = process.argv;
let src = fs.readFileSync(new URL('discordcobra4b.red', import.meta.url), 'utf8').replace(/\r/g, '');
src = src.replace(/^;name .*$/m, ';name ' + name);
src = src.replace(/^;strategy (.*)$/m, ';strategy $1; after its first loss or tie it plays Discord, Sunset or King Cobra at random (seeded by where its scanner found things), each weighted by how it has done');
src = src.replace('ORG b0start', 'ORG xsel');
src = src.replace('b2fcAim MOV.B b2fcPtr, #0', ' STP.B b2fcPtr, #22\nb2fcAim MOV.B b2fcPtr, #0');
src = src.replace('b1copyCount DAT.F #0, #17', 'b1copyCount DAT.F #0, #18');
const sel = `xsel LDP.AB #20, xm
 LDP.AB #0, xres
 SLT.AB #${T - 1}, xm
 JMP.B xnorm, 0
 LDP.AB #25, xa
 LDP.AB #26, xw
 LDP.AB #27, xw+1
 LDP.AB #28, xw+2
 ADD.B xa, xp
 SEQ.AB #1, xres
 SUB.AB #${+UP + +DOWN}, @xp
 ADD.AB #${UP}, @xp${+TD ? `
 SNE.AB #2, xres
 ADD.AB #${TD}, @xp` : ""}
 SLT.AB #${+HI}, @xp
 JMP.B xlo, 0
 SLT.AB #${12600}, @xp
 MOV.AB #${+HI}, @xp
xlo SLT.AB #${12600}, @xp
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
 ADD.B xw+1, xt
 ADD.B xw+2, xt
 ADD.AB #${3 * B}, xt
 MOD.B xt, xs
 ADD.AB #${B}, xw
 SLT.B xs, xw
 JMP.B x1, 0
 STP.AB #0, #25
 JMP.B b1boot, 0
x1 ADD.B xw+1, xw
 ADD.AB #${B}, xw
 SLT.B xs, xw
 JMP.B x2, 0
 STP.AB #1, #25
 JMP.B b3spBoot, 0
x2 STP.AB #2, #25
 JMP.B b5scan, 0
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
 DAT.F #0, #0
 DAT.F #0, #0
`;
src = src.replace('b0start LDP.AB #0, b0result', sel + 'b0start LDP.AB #0, b0result');
fs.writeFileSync(out, src);
