// Hydrology invariants (node, no browser): node data/hydroprobe.mjs
// 1. water runs downhill along every channel;
// 2. a lake a channel crosses is flat at the lake's level (one sheet);
// 3. every mouth meets its receiver flush;
// 4. the shore law: the bed is under the water, the bank climbs out of it,
//    and the land beside a channel never sinks into a dry pit below it.
import { RIVER, STREAM_CHANNELS, CONFLUENCES, riverAt } from '../src/riverzone.js';
import { heightAt } from '../src/terrain.js';
import { shoreBodies } from '../src/shore.js';
let fails = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { fails++; if (fails < 25) console.log('FAIL', msg); } };

for (const ch of [RIVER, ...STREAM_CHANNELS]) {
  for (let i = 1; i < ch.samples.length; i++) {
    check(ch.samples[i][2] <= ch.samples[i - 1][2] + 1e-9, `${ch.name} climbs at s=${ch.sampleS[i].toFixed(0)}`);
    const lk = ch.lakeRun[i];
    if (lk) check(Math.abs(ch.samples[i][2] - lk.level) < 1e-6, `${ch.name} not flush with ${lk.name} at s=${ch.sampleS[i].toFixed(0)}`);
  }
}
for (const m of CONFLUENCES) {
  if (m.type !== 'river' && m.type !== 'lake') continue;
  const end = m.channel.samples.at(-1)[2];
  check(Math.abs(end - m.receivingLevel) < 0.01, `${m.channel.name} mouth ${end.toFixed(2)} vs receiver ${m.receivingLevel.toFixed(2)}`);
}

// cross-sections every ~40 m along each channel (outside lakes)
let pits = 0, sections = 0;
for (const ch of [RIVER, ...STREAM_CHANNELS]) {
  for (let i = 3; i < ch.samples.length - 3; i += 7) {
    if (ch.lakeRun[i] || ch.lakeRun[i - 3] || ch.lakeRun[i + 3]) continue;
    const [x, z, level, hw] = ch.samples[i];
    const a = ch.samples[i + 1];
    let tx = a[0] - x, tz = a[1] - z; const L = Math.hypot(tx, tz); tx /= L; tz /= L;
    sections++;
    const centre = heightAt(x, z);
    // the thalweg sits under the water (brooks at least 0.25 m, the Gauja 1 m)
    check(centre < level - (ch === RIVER ? 1.0 : 0.25), `${ch.name} bed ${(centre - level).toFixed(2)} at s=${ch.sampleS[i].toFixed(0)}`);
    for (const side of [-1, 1]) {
      for (let off = hw + 4; off <= hw + 16; off += 2) {
        const px = x - tz * off * side, pz = z + tx * off * side;
        const bodies = shoreBodies(px, pz);
        if (bodies.some((b) => b.e < 0)) break;          // another water body (a bend, a mouth)
        const h = heightAt(px, pz);
        if (h < level - 0.15) { pits++; check(false, `${ch.name} dry pit ${(h - level).toFixed(2)} m at (${px.toFixed(0)},${pz.toFixed(0)})`); break; }
      }
    }
  }
}
console.log(`${checks} checks over ${sections} cross-sections, ${pits} pits — ${fails ? fails + ' FAIL' : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
