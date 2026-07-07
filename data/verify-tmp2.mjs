// Round 2: in-page timing for double-tap; ground-referenced collider probes.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__sim !== undefined', { timeout: 40000 });
await new Promise((r) => setTimeout(r, 3000));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- T1: double-Space from cinema, taps 150ms apart in-page ---------------
const t1 = await page.evaluate(() => new Promise((res) => {
  const tap = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  };
  const out = { pre: window.__rig.mode };
  tap();
  out.afterTap1 = window.__rig.mode;
  setTimeout(() => {
    tap();
    out.afterTap2 = window.__rig.mode;
    out.grounded = window.__rig.grounded;
    out.baseY = +window.__rig.basePos.y.toFixed(1);
    res(out);
  }, 150);
}));
console.log('T1 cinema double-space:', JSON.stringify(t1));
await sleep(3000);
console.log('T1 later:', JSON.stringify(await page.evaluate(() => ({
  mode: window.__rig.mode, y: +window.__rig.basePos.y.toFixed(1), velY: +window.__rig.velY.toFixed(1),
}))));

// ---- T2a: era-2 stead cabin collider (ground-referenced) -------------------
const t2a = await page.evaluate(() => {
  window.__sim.jump('seta');
  const tg = window.__sim.controls.target;
  const S = { x: tg.x, z: tg.z, gy: tg.y - 4 };   // seta target = (S.x, steadY+4, S.z)
  const probe = (x, z, feetY) => {
    const c = window.__rig.collideFn(x, z, feetY);
    return +Math.hypot(c[0] - x, c[1] - z).toFixed(2);
  };
  // dwelling logCabin at (S.x-5, S.z-9); scan feetY around ground
  const scans = {};
  for (const dy of [-2, -1, 0, 1]) scans['dy' + dy] = probe(S.x - 5, S.z - 9, S.gy + dy);
  return { S, scans };
});
console.log('T2a era2 cabin collider:', JSON.stringify(t2a));

// ---- T2b: era-3 manor collider + roof-sink lateral jump --------------------
await page.evaluate(() => window.__sim.era(3));
await sleep(1200);
const t2b = await page.evaluate(() => {
  window.__sim.jump('muiza');
  const tg = window.__sim.controls.target;      // (Mn.x, ground+5, Mn.z)
  const Mn = { x: tg.x, z: tg.z, gy: tg.y - 5 };
  const probe = (x, z, feetY) => {
    const c = window.__rig.collideFn(x, z, feetY);
    return { d: +Math.hypot(c[0] - x, c[1] - z).toFixed(2), to: [+c[0].toFixed(1), +c[1].toFixed(1)] };
  };
  return {
    Mn,
    centreAtGround: probe(Mn.x, Mn.z, Mn.gy),
    centreSinkingOntoRoof: probe(Mn.x, Mn.z, Mn.gy + 4.9), // fly feetY as eye reaches roofTop+0.68
    offCentre: probe(Mn.x + 5, Mn.z + 2, Mn.gy),
  };
});
console.log('T2b manor collider:', JSON.stringify(t2b));

// ---- T5 continue: flyTo putns while walking, wait for tween completion -----
const t5pre = await page.evaluate(() => {
  window.__sim.jump('pagalms');
  window.__rig.setMode('walk');
  return null;
});
void t5pre;
await sleep(4000); // settle (few frames at low fps)
console.log('T5 pre :', JSON.stringify(await page.evaluate(() => ({
  mode: window.__rig.mode, y: +window.__rig.basePos.y.toFixed(1), grounded: window.__rig.grounded,
}))));
await page.evaluate(() => window.__sim.flyTo('putns'));
await sleep(35000); // tween needs ~44 frames; headless runs ~2fps
const t5 = await page.evaluate(() => ({
  mode: window.__rig.mode,
  baseY: +window.__rig.basePos.y.toFixed(1),
  camY: +window.__sim.camera.position.y.toFixed(1),
  velY: +window.__rig.velY.toFixed(1),
  grounded: window.__rig.grounded,
}));
console.log('T5 post:', JSON.stringify(t5));
await sleep(8000);
console.log('T5 +8s :', JSON.stringify(await page.evaluate(() => ({
  mode: window.__rig.mode, baseY: +window.__rig.basePos.y.toFixed(1),
  camY: +window.__sim.camera.position.y.toFixed(1), velY: +window.__rig.velY.toFixed(1),
}))));

await browser.close();
