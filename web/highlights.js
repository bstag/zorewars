// Canvas adapter for the shared wall-clock highlight model. Both the flat and
// 3D arena views supply their own projection of each highlighted core cell.
import { HighlightModel } from './highlight-model.js';

export class Highlights extends HighlightModel {
  // Draw every effect with a projection: at(cell) -> [x, y, cellPixels] or null.
  draw(ctx, now, at, colors) {
    for (const e of this.effects) {
      const p = at(e.cell);
      if (!p) continue;
      const [x, y, px] = p;
      const t = Math.min(1, (now - e.t0) / e.ms);
      const fade = 1 - t;
      if (e.kind === 0) {
        // Override: a splash ring in the attacker's colour.
        ctx.globalAlpha = 0.9 * fade;
        ctx.strokeStyle = colors[e.attacker % colors.length] ?? '#ffffff';
        ctx.lineWidth = Math.max(1, 2 * fade + 0.5);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, px) * (0.8 + 4 * t), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Kill: a white flash and a burst of sparks.
        const r = Math.max(3, px) * (1 + 5 * t);
        ctx.globalAlpha = 0.55 * fade * fade;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, px) * (1.2 + 1.5 * t), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade;
        ctx.strokeStyle = t < 0.4 ? '#ffffff' : '#fca5a5';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + e.cell;            // a different burst per cell
          ctx.moveTo(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45);
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
