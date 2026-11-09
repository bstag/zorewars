import {leaves} from './leaves.js';
import {makeGeometry} from '../../src/engine/geometry.js';
const isLeaf=node=>Object.hasOwn(leaves,node.id);

export function blockInstances(root, labels, spans, settings) {
  const out = [];
  // The cells each copying combinator lays down: its member's span at the new
  // shift. A copy holds only that member, not the whole warrior.
  const regions = out.regions = [];
  const copied = (kid, shifts) => { for (const shift of shifts) regions.push({ shift, start: spans[kid.ns].start, size: spans[kid.ns].size }); return shifts; };
  const geo = makeGeometry(settings);
  const vec = (x, y = 0, z = 0) => (geo ? geo.encode(x, y, z) : x);
  const plus = (a, b) => (geo ? geo.add(a, b) : a + b);
  const walk = (node, shifts, flags) => {
    if (isLeaf(node)) { for (const shift of shifts) out.push({ node, shift, ...flags }); return; }
    const k = node.kids;
    switch (node.id) {
      case 'boot': walk(k[0], copied(k[0], shifts.map((s) => plus(s, vec(node.P.HOP, node.P.HOPY, node.P.HOPZ)))), flags); if (k[1]) walk(k[1], shifts, flags); break;
      case 'relocate': {
        const probe = labels[node.probeLabel];
        walk(k[0], copied(k[0], shifts.map((s) => s + probe + node.P.HOP - spans[k[0].ns].start)), flags);
        break;
      }
      case 'apart': walk(k[0], shifts, flags); walk(k[1], shifts.map((s) => plus(s, vec(node.P.D, node.P.DY, node.P.DZ))), flags); break;
      case 'copies': walk(k[0], copied(k[0], shifts.flatMap((s) => Array.from({ length: node.P.N }, (_, i) => plus(s, vec(i * node.P.D, i * node.P.DY, i * node.P.DZ))))), flags); break;
      case 'trigger':
        walk(k[0], shifts, { ...flags, mayStop: true });
        walk(k[1], shifts, { ...flags, ...(node.P.MODE ? { optional: true, triggered: node.ns } : {}) });
        break;
      case 'switch': k.forEach((kid, i) => walk(kid, shifts, { ...flags, optional: true, branch: `${node.ns}:${i}` })); break;
      case 'fork':
        walk(k[0], shifts, flags);
        walk(k[1], shifts, { ...flags, optional: true, branch: `${node.ns}:1` });
        walk(k[2], shifts, { ...flags, optional: true, branch: `${node.ns}:2` });
        break;
      case 'parboot': {
        const { HOP, HOPY, HOPZ, STAY, REACT, HOP2, HOP2Y, HOP2Z } = node.P;
        walk(k[0], copied(k[0], shifts.map((s) => plus(s, vec(HOP, HOPY, HOPZ)))), REACT ? { ...flags, mayStop: true } : flags);   // the copy (a REACT scenario hits it)
        if (STAY) walk(k[0], shifts, flags);                                  // the original, still running
        if (REACT) walk(k[0], copied(k[0], shifts.map((s) => plus(s, vec(HOP2, HOP2Y, HOP2Z)))), { ...flags, optional: true, triggered: `${node.ns}:react` });
        break;
      }
      case 'fanboot3':
      case 'fanboot':
        // Each member's copy starts at its copy label and holds M cells (the copy lines copy
        // whole rounds of N, so a little of what follows the member comes along).
        k.forEach((kid, i) => {
          const hop = [node.P.HOPA,node.P.HOPB,node.P.HOPC][i], moved = shifts.map((s) => s + hop);
          for (const shift of moved) regions.push({ shift, start: labels[node.ns + 'c' + i], size: node.fan.M[i] });
          walk(kid, moved, flags);
        });
        break;
      case 'classify':
        walk(k[0], shifts, { ...flags, mayStop: true });
        walk(k[1], shifts, { ...flags, optional: true, branch: `${node.ns}:1` });
        walk(k[2], shifts, { ...flags, optional: true, branch: `${node.ns}:2` });
        break;
      default: for (const kid of k) walk(kid, shifts, flags);
    }
  };
  walk(root, [0], {});
  return out;
}
