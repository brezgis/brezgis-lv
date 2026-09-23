// Road regression probe: does the carriageway ever sink under the ground it
// crosses, and does anything grow in the middle of it?
//
// Both questions are answered from the RENDERED meshes, not from the source
// splines — the road ribbon's own vertices are the road, and the vegetation
// instance matrices are the trees. Nothing here trusts the placement rules
// that were supposed to keep them apart.
//
//   node data/roadcheck.mjs
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=900,520', '--no-sandbox', '--disable-dev-shm-usage'],
});
let failures = 0;
try {
  const page = await browser.newPage();
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));

  // A sampler over the rendered terrain mesh, matching terrain.meshHeightAt.
  await page.evaluate(() => {
    const t = window.__scene.getObjectByName('terrain');
    const p = t.geometry.attributes.position;
    const n = Math.round(Math.sqrt(p.count));
    const x0 = p.getX(0), z0 = p.getZ(0);
    const sx = p.getX(1) - x0, sz = p.getZ(n) - z0;
    // the engine's own rendered height (the 2 m shore mesh replaces the
    // 17 m grid along every shore); the grid sampler is the fallback
    if (window.__meshHeightAt) { window.__ground = window.__meshHeightAt; return; }
    window.__ground = (x, z) => {
      const fx = Math.max(0, Math.min(n - 1.001, (x - x0) / sx));
      const fz = Math.max(0, Math.min(n - 1.001, (z - z0) / sz));
      const c = Math.floor(fx), r = Math.floor(fz), u = fx - c, v = fz - r;
      const hA = p.getY(r * n + c), hB = p.getY(r * n + c + 1);
      const hC = p.getY((r + 1) * n + c), hD = p.getY((r + 1) * n + c + 1);
      return u + v <= 1 ? hA + (hB - hA) * u + (hC - hA) * v
        : hD + (hC - hD) * (1 - u) + (hB - hD) * (1 - v);
    };
  });

  for (const era of [3, 4, 5]) {
    await page.evaluate((e) => window.__sim.era(e), era);
    await new Promise((r) => setTimeout(r, 1400));

    const res = await page.evaluate(() => {
      // ---- every carriageway vertex, and how far under the ground it sits.
      // Bridge decks legitimately fly, so anything above ground is fine; we
      // only measure the sunk side.
      const roadPts = [];
      let buried = 0, worst = 0, total = 0, worstAt = null;
      window.__scene.traverse((o) => {
        if (!o.isMesh || !/^road-ribbon-/.test(o.name)) return;
        const p = o.geometry.attributes.position, role = o.geometry.userData.carriage;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          roadPts.push(x, z);
          // verge/skirt vertices tuck into the slope beside a cutting by
          // design; only the carriageway itself must stay above the ground
          if (role && !role[i]) continue;
          total++;
          // The outermost verge vertex is deliberately tucked 8 cm under the
          // turf so no seam shows along the edge; anything deeper than that
          // is the carriageway genuinely sinking into the ground.
          const under = window.__ground(x, z) - y;
          if (under > 0.12) { buried++; if (under > worst) { worst = under; worstAt = [Math.round(x), Math.round(z), o.name]; } }
        }
      });

      // ---- trees standing in the road.
      // Bucket the road vertices so the tree test is O(1) per instance.
      const CELL = 12, grid = new Map();
      for (let i = 0; i < roadPts.length; i += 2) {
        const k = `${Math.round(roadPts[i] / CELL)},${Math.round(roadPts[i + 1] / CELL)}`;
        let a = grid.get(k); if (!a) grid.set(k, a = []);
        a.push(roadPts[i], roadPts[i + 1]);
      }
      const nearRoad = (x, z) => {
        let best = Infinity;
        const cx = Math.round(x / CELL), cz = Math.round(z / CELL);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          const a = grid.get(`${cx + dx},${cz + dz}`);
          if (!a) continue;
          for (let i = 0; i < a.length; i += 2) {
            const d = Math.hypot(x - a[i], z - a[i + 1]);
            if (d < best) best = d;
          }
        }
        return best;
      };
      const offenders = [];
      let trees = 0;
      const veg = window.__scene.getObjectByName('vegetation');
      if (veg) {
        veg.traverse((o) => {
          if (!o.isInstancedMesh || !/bark|impostor|far:/.test(o.name || '')) return;
          const m = o.instanceMatrix.array;
          for (let i = 0; i < o.count; i++) {
            const x = m[i * 16 + 12], y = m[i * 16 + 13], z = m[i * 16 + 14];
            if (!Number.isFinite(x) || (x === 0 && y === 0 && z === 0)) continue;
            trees++;
            const d = nearRoad(x, z);
            // road vertices run out to half+skirt; a trunk inside 1.6 m of
            // one is standing ON the made surface
            if (d < 1.6) offenders.push([o.name, Math.round(x), Math.round(z), +d.toFixed(2)]);
          }
        });
      }
      return { total, buried, worst: +worst.toFixed(2), worstAt, trees, offenders: offenders.slice(0, 14), nOff: offenders.length };
    });

    const pct = res.total ? (100 * res.buried / res.total).toFixed(1) : '0.0';
    const ok1 = res.buried === 0;
    const ok2 = res.nOff === 0;
    console.log(`era ${era}: ${ok1 ? 'PASS' : 'FAIL'} carriageway under ground ${res.buried}/${res.total} verts (${pct}%), worst ${res.worst} m at ${JSON.stringify(res.worstAt)}`);
    console.log(`era ${era}: ${ok2 ? 'PASS' : 'FAIL'} trees in the road ${res.nOff} of ${res.trees} trunks`);
    for (const o of res.offenders) console.log('        ', o.join('  '));
    if (!ok1) failures++;
    if (!ok2) failures++;
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nALL PASS');
process.exit(failures ? 1 : 0);
