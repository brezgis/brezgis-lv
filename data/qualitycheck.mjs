// Render the shipped, offline artifact, inspect every era, and exercise input.
// CHROME_PATH overrides the local Chrome binary. Screenshots use a fresh temp dir.
import puppeteer from 'puppeteer-core';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const output = mkdtempSync(join(tmpdir(), 'village-quality-'));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true, protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
});
const errors = [], results = [];
const assert = (ok, description) => {
  results.push({ pass: !!ok, description });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${description}`);
};
console.log('Screenshots:', output);
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 650 });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.text().startsWith('[boot]')) console.log(m.text());
  });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__renderer && document.querySelector("#loader.done, body:not(:has(#loader))")', { timeout: 120000 });
  await page.evaluate(() => {
    window.__sim.sky.state.paused = true;
    window.__sim.sky.state.t = 0.38;
    document.getElementById('panel').classList.add('closed');
  });
  for (let era = 0; era < 6; era++) {
    await page.evaluate((e) => { window.__sim.era(e); window.__sim.jump('seta'); }, era);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const info = await page.evaluate(() => {
      const bad = [], seen = new Set();
      let glass = 0, roofs = 0, promoted = 0;
      window.__scene.traverse((o) => {
        if (o.name === 'window-glass') glass++;
        if (o.name === 'roof') roofs++;
        if (o.name.startsWith('promoted:')) promoted += o.count;
        for (const n of [...o.position.toArray(), ...o.scale.toArray()]) if (!Number.isFinite(n)) bad.push(o.name);
        const g = o.geometry;
        if (!g || seen.has(g)) return;
        seen.add(g);
        for (const a of Object.values(g.attributes)) {
          if (!a.array) continue;
          for (let i = 0; i < a.array.length; i++) {
            if (!Number.isFinite(a.array[i])) { bad.push(`${o.name}:attribute`); break; }
          }
        }
        if (o.name === 'roof') {
          const p = g.attributes.position, uv = g.attributes.uv;
          for (let i = 0; i < 12; i += 3) {
            const area = (uv.getX(i+1)-uv.getX(i))*(uv.getY(i+2)-uv.getY(i))
              - (uv.getY(i+1)-uv.getY(i))*(uv.getX(i+2)-uv.getX(i));
            if (Math.abs(area) < 1e-6) bad.push('collapsed roof UV');
          }
        }
      });
      const r = window.__renderer;
      return { bad, roofs, glass, promoted, calls: r.info.render.calls, triangles: r.info.render.triangles,
        memory: { ...r.info.memory }, pixelRatio: r.getPixelRatio(), samples: r.capabilities.maxSamples,
        evidence: document.getElementById('era-evidence').textContent, frameErrors: window.__frameErrors };
    });
    assert(info.bad.length === 0 && info.frameErrors.length === 0, `era ${era}: finite geometry and valid roof UVs`);
    assert(info.evidence.length > 30, `era ${era}: reconstruction evidence visible`);
    assert(info.pixelRatio <= 1, `era ${era}: quality governor respects native pixel density`);
    assert(info.promoted < 56 * 9 * 2, `era ${era}: unused tree slots are not submitted`);
    const png = PNG.sync.read(await page.screenshot({ path: join(output, `era-${era}.png`) }));
    let mean = 0;
    for (let i = 0; i < png.data.length; i += 4) mean += png.data[i] * 0.2126 + png.data[i+1] * 0.7152 + png.data[i+2] * 0.0722;
    mean /= png.width * png.height;
    assert(mean > 10 && mean < 240, `era ${era}: visible render (mean luminance ${mean.toFixed(1)})`);
    console.log(JSON.stringify({ era, ...info }));
  }
  for (const view of ['pagalms', 'upe', 'muiza', 'ezers', 'putns']) {
    await page.evaluate((v) => { window.__sim.era(4); window.__sim.jump(v); }, view);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: join(output, `${view}.png`) });
    console.log('Captured', view);
  }
  const memorySamples = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const era of [3, 2]) {
      await page.evaluate((e) => window.__sim.era(e), era);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
    memorySamples.push(await page.evaluate(() => ({ ...window.__renderer.info.memory })));
  }
  assert(memorySamples[2].geometries <= memorySamples[1].geometries + 12
    && memorySamples[2].textures <= memorySamples[1].textures,
  'repeated era changes keep GPU resources bounded');
  console.log('Memory after repeated visits:', JSON.stringify(memorySamples));
  await page.evaluate(() => window.__sim.jump('pagalms'));
  const initial = await page.evaluate(() => window.__sim.camera.position.toArray());
  await page.keyboard.down('ArrowUp');
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__rig.update(1/60); });
  await page.keyboard.up('ArrowUp');
  const moved = await page.evaluate(() => window.__sim.camera.position.toArray());
  assert(Math.hypot(...initial.map((p,i) => p-moved[i])) > 1, 'arrow keys move the camera');
  await page.evaluate(() => { document.exitPointerLock(); document.getElementById('about-btn').click(); });
  await page.keyboard.down('KeyW');
  const blocked = await page.evaluate(() => !window.__rig.keys.has('KeyW'));
  await page.keyboard.up('KeyW');
  assert(blocked, 'chronicle blocks movement input');
  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => !document.getElementById('about').classList.contains('open')), 'Escape closes chronicle');

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  // Changing mobile emulation reloads the page; wait for the new world.
  await page.waitForFunction('window.__renderer && document.querySelector("#loader.done, body:not(:has(#loader))")', { timeout: 120000 });
  await page.evaluate(() => { window.__sim.jump('pagalms'); document.getElementById('panel').classList.add('closed'); });
  const button = await page.$('[data-move-key="KeyW"]');
  assert(await button.isVisible(), 'touch navigation is available');
  const box = await button.boundingBox();
  await page.touchscreen.touchStart(box.x + box.width / 2, box.y + box.height / 2);
  assert(await page.evaluate(() => window.__rig.keys.has('KeyW')), 'touch forward engages movement');
  await page.touchscreen.touchEnd();
  assert(await page.evaluate(() => !window.__rig.keys.has('KeyW')), 'touch release stops movement');
  const yaw = await page.evaluate(() => window.__rig.yawT);
  await page.touchscreen.touchStart(200, 300);
  await page.touchscreen.touchMove(270, 330);
  await page.touchscreen.touchEnd();
  assert(await page.evaluate((y) => Math.abs(window.__rig.yawT - y) > 0.1, yaw), 'touch drag turns the camera');
  await page.screenshot({ path: join(output, 'mobile.png') });
  assert(errors.length === 0, `no browser or shader errors (${errors.length})`);
  if (errors.length) console.log(errors.join('\n'));
} finally {
  await browser.close();
  writeFileSync(join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
}
console.log('Evidence:', output);
process.exitCode = results.some((r) => !r.pass) || errors.length ? 1 : 0;
