// River-zone invariants — the water contract, node-runnable, no DOM.
// Run after ANY change to riverzone/terrain/water/landuse:
//   node data/riverprobe.mjs
// Asserts: (1) the carved bed is really below the water, across the rugged
// width; (2) no sunken pans just outside the shore shelf; (3) the vegetation
// rule holds everywhere inside the channel; (4) the bank skirt is welded to
// the ribbon and collapsed inside lakes; (5) wading levels are sane.
import { RIVER, STREAM_CHANNELS, CONFLUENCES, LAKE_SHORES, channelRows, lakeAt,
  lakeShoreDistAt, riverAt, streamAt, confluenceAt, inConfluenceMask,
  bankCharSideAt, vegExcluded, waterLevelAt } from '../src/riverzone.js';
import { skirtRows } from '../src/water.js';
import { heightAt } from '../src/terrain.js';
import { LOC } from '../src/landuse.js';

let pass = 0, fail = 0;
const failures = [];
function check(ok, label, detail) {
  if (ok) pass++;
  else { fail++; if (failures.length < 12) failures.push(`${label} ${detail}`); }
}

// (6) canonical profiles: no spline overshoot rises, no mesh-only width
// smoothing, and the contiguous Pīsla records share exact endpoint state.
{
  for (const chan of [RIVER, ...STREAM_CHANNELS]) {
    for (let i = 1; i < chan.samples.length; i++) {
      check(chan.samples[i][2] <= chan.samples[i - 1][2] + 1e-7,
        'level-rise', `${chan.name} sample ${i}`);
    }
    const rows = channelRows(chan, Math.min(2600, chan.pts.length * 7));
    for (let i = 1; i < rows.length; i++) {
      const ds = Math.hypot(rows[i].x - rows[i - 1].x, rows[i].z - rows[i - 1].z) || 1;
      check(Math.abs(rows[i].hw - rows[i - 1].hw) <= 0.50001,
        'width-step', `${chan.name} row ${i} dW=${Math.abs(rows[i].hw - rows[i - 1].hw).toFixed(3)}`);
      if (!rows[i].lake && !rows[i - 1].lake) check((rows[i - 1].y - rows[i].y) / ds <= 0.04001,
        'level-grade', `${chan.name} row ${i}`);
    }
  }
  const a = STREAM_CHANNELS[0].samples.at(-1), b = STREAM_CHANNELS[1].samples[0];
  check(Math.abs(a[2] - b[2]) < 1e-6 && Math.abs(a[3] - b[3]) < 1e-6,
    'pisla-join', `level ${a[2]}/${b[2]} width ${a[3]}/${b[3]}`);
}

// (7) receiver model and mouth oracle. The query follows the canonical
// tributary profile; once it overlaps the receiver, waterLevelAt reports the
// visible receiver sheet rather than the submerged tributary ribbon.
{
  const expected = ['continuation', 'river', 'river', 'wetHollow'];
  CONFLUENCES.forEach((mouth, i) => check(mouth.type === expected[i],
    'receiver', `stream ${i}: ${mouth.type}, expected ${expected[i]}`));
  for (const mouth of CONFLUENCES.filter((m) => m.type === 'river')) {
    const chan = mouth.channel;
    const rows = channelRows(chan, Math.min(2600, chan.pts.length * 7));
    check(rows.at(-1).y <= mouth.receivingLevel - 0.249,
      'mouth-submerge', `stream ${mouth.streamIndex} y=${rows.at(-1).y.toFixed(3)} recv=${mouth.receivingLevel.toFixed(3)}`);
    const approach = rows.filter((r) => r.s >= chan.length - mouth.approachDistance - mouth.blendEndOffset);
    for (let k = 0; k < 20; k++) {
      const row = approach[Math.round(k * (approach.length - 1) / 19)];
      const st = streamAt(row.x, row.z);
      check(st && Math.abs(st.level - row.y) <= 0.05001,
        'mouth-query', `stream ${mouth.streamIndex} s=${row.s.toFixed(1)} q=${st?.level.toFixed(3)} row=${row.y.toFixed(3)}`);
      const rv = riverAt(row.x, row.z);
      const visible = rv && rv.d < rv.hw + 1.5 ? Math.max(row.y, rv.level) : row.y;
      check(Math.abs(waterLevelAt(row.x, row.z) - visible) <= 0.05001,
        'mouth-waterlevel', `stream ${mouth.streamIndex} s=${row.s.toFixed(1)}`);
    }
  }
  for (const [x, z] of [[-1493.02, 3159.80], [-1492.92, 3159.57], [1495.77, -547.66], [1496.00, -547.76]]) {
    check(inConfluenceMask(x, z) && confluenceAt(x, z), 'mouth-mask', `@${x},${z}`);
  }
  const wet = STREAM_CHANNELS[3];
  check(wet.samples.at(-1)[3] <= wet.samples[wet.samples.length - 9][3] * 0.66,
    'wet-hollow-width', `${wet.samples.at(-1)[3].toFixed(2)}`);
  check(wet.samples.at(-1)[2] < wet.samples[wet.samples.length - 9][2] - 0.25,
    'wet-hollow-level', `${wet.samples.at(-1)[2].toFixed(2)}`);
}

// (8) near-shore distance is exact against the polygon actually rendered.
{
  for (const lake of LAKE_SHORES) {
    const edgeLengths = [], poly = lake.poly;
    let perimeter = 0;
    for (let i = 0; i < poly.length; i++) {
      perimeter += Math.hypot(poly[(i + 1) % poly.length][0] - poly[i][0], poly[(i + 1) % poly.length][1] - poly[i][1]);
      edgeLengths.push(perimeter);
    }
    for (let n = 0; n < 200; n++) {
      const target = perimeter * n / 200;
      let i = edgeLengths.findIndex((s) => s >= target);
      if (i < 0) i = edgeLengths.length - 1;
      const before = i ? edgeLengths[i - 1] : 0, span = edgeLengths[i] - before || 1;
      const a = poly[i], b = poly[(i + 1) % poly.length], u = (target - before) / span;
      const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
      check(lakeShoreDistAt(x, z) <= 0.3, 'shore-exact', `${lake.name} @${x.toFixed(1)},${z.toFixed(1)}`);
    }
  }
}

// (9) every stream skirt uses its own channel length, welds to the ribbon,
// and collapses structurally at receivers and lake crossings. Gauja notches
// collapse the receiver-side apron at both tributary throats.
{
  for (const chan of STREAM_CHANNELS) {
    const rows = channelRows(chan, Math.min(2600, chan.pts.length * 7));
    const sk = skirtRows(rows, chan);
    rows.forEach((row, i) => {
      check(Math.abs(sk[i].W_IN - (row.hw + 1.6)) < 1e-6, 'stream-weld', `${chan.name} row ${i}`);
      check(Number.isFinite(sk[i].wOutLeft) && Number.isFinite(sk[i].wOutRight), 'stream-skirt-finite', `${chan.name} row ${i}`);
      if (row.lake) check(sk[i].wOutLeft === sk[i].W_IN && sk[i].wOutRight === sk[i].W_IN,
        'stream-lake-collapse', `${chan.name} row ${i}`);
    });
    for (let i = 1; i < rows.length; i++) for (const side of [-1, 1]) {
      const key = side > 0 ? 'wOutLeft' : 'wOutRight';
      const ix = (j, w) => rows[j].x - rows[j].dz * side * w;
      const iz = (j, w) => rows[j].z + rows[j].dx * side * w;
      const idx = ix(i, sk[i].W_IN) - ix(i - 1, sk[i - 1].W_IN);
      const idz = iz(i, sk[i].W_IN) - iz(i - 1, sk[i - 1].W_IN);
      const odx = ix(i, sk[i][key]) - ix(i - 1, sk[i - 1][key]);
      const odz = iz(i, sk[i][key]) - iz(i - 1, sk[i - 1][key]);
      check(idx * odx + idz * odz >= -1e-6, 'stream-skirt-fold', `${chan.name} row ${i}`);
    }
    if (chan.confluence.type !== 'continuation') check(
      Math.abs(sk.at(-1).wOutLeft - sk.at(-1).W_IN) < 1e-6 && Math.abs(sk.at(-1).wOutRight - sk.at(-1).W_IN) < 1e-6,
      'stream-mouth-collapse', chan.name);
  }
  const rows = channelRows(RIVER, Math.min(2600, RIVER.pts.length * 7));
  const sk = skirtRows(rows, RIVER);
  for (const mouth of CONFLUENCES.filter((m) => m.type === 'river')) {
    let i = 0;
    for (let j = 1; j < rows.length; j++) if (Math.abs(rows[j].s - mouth.receiverS) < Math.abs(rows[i].s - mouth.receiverS)) i = j;
    const width = mouth.bankSide > 0 ? sk[i].wOutLeft : sk[i].wOutRight;
    check(width - sk[i].W_IN < 0.25, 'receiver-notch', `stream ${mouth.streamIndex} band=${(width - sk[i].W_IN).toFixed(3)}`);
  }
  const outlet = streamAt(1419.7, -2417.3);
  check(outlet && outlet.d < outlet.hw + 4, 'lake-outlet-collapse', `d=${outlet?.d.toFixed(2)}`);
}

// (10) geomorphic character opposes the two banks on bends but converges
// to the historical noise field on straight reaches.
{
  const ranked = RIVER.samples.map((p, i) => ({ p, i, k: Math.abs(RIVER.curvature[i]) }))
    .filter((q) => q.i > 8 && q.i < RIVER.samples.length - 9)
    .sort((a, b) => b.k - a.k).slice(0, 5);
  for (const q of ranked) {
    const innerSide = RIVER.curvature[q.i] > 0 ? 1 : -1;
    const inner = bankCharSideAt(q.p[0], q.p[1], innerSide, RIVER);
    const outer = bankCharSideAt(q.p[0], q.p[1], -innerSide, RIVER);
    check(inner.bar > outer.bar, 'bend-bar', `sample ${q.i}`);
    check(outer.erosion > inner.erosion, 'bend-erosion', `sample ${q.i}`);
  }
  const straight = RIVER.samples.map((p, i) => ({ p, i, k: Math.abs(RIVER.curvature[i]) }))
    .filter((q) => q.i > 8 && q.i < RIVER.samples.length - 9 && q.k < 0.00015).slice(0, 20);
  for (const q of straight) {
    const l = bankCharSideAt(q.p[0], q.p[1], 1, RIVER), r = bankCharSideAt(q.p[0], q.p[1], -1, RIVER);
    check(Math.abs(l.bar - r.bar) < 0.08 && Math.abs(l.erosion - r.erosion) < 0.08,
      'straight-noise', `sample ${q.i}`);
  }
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
