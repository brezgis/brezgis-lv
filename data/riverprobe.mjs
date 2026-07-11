// River-zone invariants — the water contract, node-runnable, no DOM.
// Run after ANY change to riverzone/terrain/water/landuse:
//   node data/riverprobe.mjs
// Asserts: (1) the carved bed is really below the water, across the rugged
// width; (2) no sunken pans just outside the shore shelf; (3) the vegetation
// rule holds everywhere inside the channel; (4) the bank skirt is welded to
// the ribbon and collapsed inside lakes; (5) wading levels are sane.
import { RIVER, STREAM_CHANNELS, channelRows, lakeAt, riverAt, streamAt, vegExcluded, waterLevelAt } from '../src/riverzone.js';
import { skirtRows } from '../src/water.js';
import { heightAt } from '../src/terrain.js';
import { LOC } from '../src/landuse.js';

let pass = 0, fail = 0;
const failures = [];
function check(ok, label, detail) {
  if (ok) pass++;
  else { fail++; if (failures.length < 12) failures.push(`${label} ${detail}`); }
}

// perpendicular from neighbouring samples
function perp(samples, i) {
  const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
  let dx = b[0] - a[0], dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  return [-dz / l, dx / l];
}

// (1) bed depth + shelf across the rugged width. The shelf criterion is the
// VISUAL invariant: terrain may never rise within 0.2m of the flat water
// plane inside the channel (lake-mouth rim raises legitimately shallow the
// carve to ~-0.25 in a couple of reaches; that is still underwater).
{
  const S = RIVER.samples;
  for (let i = 0; i < S.length; i += 5) {
    const [x, z, lvl, hw] = S[i];
    if (lakeAt(x, z)) continue;
    check(heightAt(x, z) <= lvl - 1.6, 'bed', `@${x.toFixed(0)},${z.toFixed(0)} h=${heightAt(x, z).toFixed(2)} lvl=${lvl}`);
    const [px, pz] = perp(S, i);
    for (const s of [-1, 1]) {
      const qx = x + px * hw * 0.6 * s, qz = z + pz * hw * 0.6 * s;
      if (lakeAt(qx, qz)) continue;
      check(heightAt(qx, qz) <= lvl - 0.2, 'shelf', `@${qx.toFixed(0)},${qz.toFixed(0)} h=${heightAt(qx, qz).toFixed(2)} lvl=${lvl.toFixed(2)}`);
    }
  }
  for (const chan of STREAM_CHANNELS) {
    for (let i = 0; i < chan.samples.length; i += 5) {
      const [x, z, lvl] = chan.samples[i];
      if (lakeAt(x, z)) continue;
      check(heightAt(x, z) <= lvl - 0.7, 'streambed', `@${x.toFixed(0)},${z.toFixed(0)}`);
    }
  }
}

// (2) no sunken pans on the banks (floor clamp)
{
  const S = RIVER.samples;
  const P = LOC.POND;
  for (let i = 0; i < S.length; i += 8) {
    const [x, z, lvl, hw] = S[i];
    const [px, pz] = perp(S, i);
    for (const s of [-1, 1]) {
      const qx = x + px * (hw + 8) * s, qz = z + pz * (hw + 8) * s;
      if (lakeAt(qx, qz)) continue;
      if (Math.hypot((qx - (P.x + 4)) / 70, (qz - P.z) / 52) < 1.3) continue;
      const rv = riverAt(qx, qz), st = streamAt(qx, qz);
      // meanders: only judge points that really belong to THIS bank ring
      if (!rv || rv.d < rv.hw + 6 || (st && st.d < st.hw + 5)) continue;
      check(heightAt(qx, qz) >= lvl - 0.6, 'pan', `@${qx.toFixed(0)},${qz.toFixed(0)} h=${heightAt(qx, qz).toFixed(2)} lvl=${lvl}`);
    }
  }
}

// (3) the vegetation rule: nothing can grow in the channel
{
  const S = RIVER.samples;
  for (let i = 0; i < S.length; i += 3) {
    const [x, z, , hw] = S[i];
    const [px, pz] = perp(S, i);
    const off = (i % 7 / 7 - 0.5) * 2 * hw;             // sweep the width
    const qx = x + px * off, qz = z + pz * off;
    check(vegExcluded(qx, qz, heightAt(qx, qz), 2, 0), 'veg-river', `@${qx.toFixed(0)},${qz.toFixed(0)}`);
  }
  for (const chan of STREAM_CHANNELS) {
    for (let i = 0; i < chan.samples.length; i += 4) {
      const [x, z] = chan.samples[i];
      check(vegExcluded(x, z, heightAt(x, z), 2, 0), 'veg-stream', `@${x.toFixed(0)},${z.toFixed(0)}`);
    }
  }
}

// (4) skirt weld + lake collapse
{
  const rows = channelRows(RIVER, Math.min(2600, RIVER.pts.length * 7));
  const sk = skirtRows(rows);
  check(rows.length === sk.length, 'skirt-len', `${rows.length} vs ${sk.length}`);
  let lakeRows = 0;
  rows.forEach((r, i) => {
    check(Math.abs(sk[i].W_IN - (r.hw + 1.6)) < 1e-6, 'weld', `row ${i}`);
    check(Number.isFinite(sk[i].wOut) && Number.isFinite(r.y), 'nan', `row ${i}`);
    if (r.lake) {
      lakeRows++;
      check(sk[i].wOut === sk[i].W_IN, 'collapse', `row ${i}`);
      check(r.y <= r.lake.level - 0.34, 'sunk', `row ${i} y=${r.y.toFixed(2)}`);
    }
  });
  check(lakeRows > 100, 'crossings', `only ${lakeRows} in-lake rows`);
}

// (5) wading levels
{
  check(Math.abs(waterLevelAt(1800, -300, 4) - 178.7) < 1e-6, 'wade-lake', '');
  const mid = RIVER.samples[(RIVER.samples.length / 2) | 0];
  check(Math.abs(waterLevelAt(mid[0], mid[1], 4) - mid[2]) < 1e-6, 'wade-river', '');
  check(waterLevelAt(1728, 4969, 4) === -Infinity, 'wade-hill', '');
}

console.log(`riverprobe: ${pass} pass, ${fail} fail`);
for (const f of failures) console.log('  FAIL', f);
process.exit(fail ? 1 : 0);
