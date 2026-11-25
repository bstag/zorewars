// discordcobra6.mk.mjs out.red T KMIN KMAX name TIE : Discord Cobra v4b + a random mode after T net losses (TIE 1: ties count as losses)
import fs from 'node:fs';
const [, , out, T = '6', KMIN = '1', KMAX = '7', name = 'Discord Cobra v6', TIE = '0'] = process.argv;
let src = fs.readFileSync(new URL('discordcobra4b.red', import.meta.url), 'utf8').replace(/\r/g, '');
src = src.replace(/^;name .*$/m, ';name ' + name);
src = src.replace(/^;strategy (.*)$/m, ';strategy $1; after ' + T + ' net losses it plays Sunset or Discord at random (seeded by where its scanner found things), leaning to the one that wins');
src = src.replace('ORG b0start', 'ORG xsel');
src = src.replace('b2fcAim MOV.B b2fcPtr, #0', ' STP.B b2fcPtr, #22\nb2fcAim MOV.B b2fcPtr, #0');
src = src.replace('b1copyCount DAT.F #0, #17', 'b1copyCount DAT.F #0, #18');
const sel = `xsel LDP.AB #20, xm
 LDP.AB #0, xres
 SLT.AB #${T - 1}, xm
 JMP.B xnorm, 0
 LDP.AB #24, xk
 LDP.AB #25, xa
 SLT.AB #1, xres
 JMP.B xupd, 0
 JMP.B xdraw, 0
xupd SEQ.B xa, xres
 SUB.AB #2, xk
 ADD.AB #1, xk
 SNE.AB #${KMIN - 4}, xk
 ADD.AB #1, xk
 SNE.AB #${KMAX - 2}, xk
 SUB.AB #1, xk
 STP.B xk, #24
xdraw LDP.AB #21, xs
 LDP.AB #22, xe
 MUL.AB #421, xs
 ADD.B xe, xs
 ADD.AB #9973, xs
 STP.B xs, #21
 DIV.AB #3150, xs
 ADD.AB #3, xk
 SLT.B xs, xk
 JMP.B xdis, 0
 STP.AB #1, #25
 JMP.B b3spBoot, 0
xdis STP.AB #0, #25
 JMP.B b1boot, 0
xnorm JMZ.B xup, xres
 SEQ.AB #1, xres
 JMP.B xtie, 0
 JMZ.B b0start, xm
 SUB.AB #1, xm
 JMP.B xst, 0
xup ADD.AB #1, xm
xst STP.B xm, #20
 JMP.B b0start, 0
xtie ${TIE === '1' ? `SNE.AB #2, xres
 JMP.B xup, 0
 ` : ''}JMP.B b0start, 0
xm DAT.F #0, #0
xres DAT.F #0, #0
xs DAT.F #0, #0
xe DAT.F #0, #0
xk DAT.F #0, #0
xa DAT.F #0, #0
`;
src = src.replace('b0start LDP.AB #0, b0result', sel + 'b0start LDP.AB #0, b0result');
fs.writeFileSync(out, src);
