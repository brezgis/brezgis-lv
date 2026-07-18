// Batch audit shots — one page load, many screenshots (era 1 visual audit)
import puppeteer from 'puppeteer-core';

const OUT = '/tmp/village-scratch/audit/';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

// STEAD anchor from the harness stub target (set before any jump)
const S = await page.evaluate(() => {
  const t = window.__sim.controls.target;
  return { x: t.x, z: t.z };
});
console.log('STEAD =', JSON.stringify(S));

// ground height helper via the rig (heightAt not exported to window)
await page.evaluate(() => {
  window.__ground = (x, z) => {
    const r = window.__rig;
    const prevMode = r.mode;
    const prevPos = r.basePos.clone();
    if (r.mode === 'cinema') r.mode = 'fly'; // skip adoptCamera
    else r.setMode('fly');
    r.basePos.set(x, -10000, z);
    r.setMode('walk');
    const y = r.basePos.y - 1.7;
    r.mode = prevMode === 'cinema' ? 'cinema' : prevMode;
    r.basePos.copy(prevPos);
    return y;
  };
});

await page.evaluate(() => window.__sim.era(1));
await page.evaluate(() => { window.__sim.sky.state.paused = true; window.__sim.sky.state.t = 0.42; });
await new Promise((r) => setTimeout(r, 3000));

async function shot(name, cx, cz, cyOff, tx, tz, tyOff) {
  await page.evaluate(({ cx, cz, cyOff, tx, tz, tyOff }) => {
    const cy = window.__ground(cx, cz) + cyOff;
    const ty = window.__ground(tx, tz) + tyOff;
    window.__sim.setCam(cx, cy, cz, tx, ty, tz);
    window.__rig.mode = 'cinema'; // freeze the rig so nothing drifts
  }, { cx, cz, cyOff, tx, tz, tyOff });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: OUT + name + '.png' });
  console.log('saved', name);
}

// 1. terrace edge, looking into the full-tier forest wall
await shot('e1_edge_low', S.x + 120, S.z - 20, 1.8, S.x + 230, S.z - 40, 8);
// 2. inside forest between stead and barrows
await shot('e1_forest_inside', S.x + 185, S.z + 55, 1.8, S.x + 240, S.z + 90, 5);
// 3+4. SAME stand from two orthogonal angles (T = S+205,-70)
await shot('e1_T_from_north', S.x + 205, S.z - 25, 1.8, S.x + 205, S.z - 70, 6);
await shot('e1_T_from_east', S.x + 250, S.z - 70, 1.8, S.x + 205, S.z - 70, 6);
// 5. camp clearing edge looking through the trees
await shot('e1_camp', S.x - 120, 210, 1.8, S.x - 120, 90, 5);
// 6. across the 260 m full/far boundary from a small rise
await shot('e1_boundary', S.x + 40, S.z - 10, 14, S.x + 430, S.z + 30, 4);
// 7. ground level far from every POI — impostor land
await shot('e1_far_ground', S.x + 150, S.z + 480, 1.8, S.x + 190, S.z + 540, 4);
// 8. understory: low camera in dense forest
await shot('e1_understory', S.x + 195, S.z + 30, 1.2, S.x + 203, S.z + 38, 0.4);
// 9. Brežģa kalns, high ground = spruce/pine mix, full tier
await shot('e1_brezga_low', 1728, 4999, 1.8, 1728, 4909, 6);
// 10+11. same high-ground stand, two angles (TB = 1790, 5010)
await shot('e1_TB_from_north', 1790, 5055, 1.8, 1790, 5010, 6);
await shot('e1_TB_from_east', 1835, 5010, 1.8, 1790, 5010, 6);

await browser.close();
console.log('done');
