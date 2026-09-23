// Controls test, Minecraft flow: ArrowUp from the intro leaves cinema FLYING
// and moves; forcing walk mode grounds the player and ArrowUp walks.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 120000,
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=900,560', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  let browserErrors = 0;
  await page.setViewport({ width: 900, height: 560 });
  page.on('pageerror', (e) => { browserErrors++; console.log('[pageerror]', e.message.slice(0, 300)); });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
  // __sim is exposed before the initial era finishes activating. Switching
  // immediately races two 600k-instance forest fills and can kill the GPU
  // process before the first keyboard event.
  await new Promise((r) => setTimeout(r, 3000));
  await page.evaluate(() => {
    window.__sim.era(3);
    window.__sim.jump('pagalms');
  });
  const before = await page.evaluate(() => {
    const c = window.__sim.camera.position;
    return { x: c.x, z: c.z, mode: window.__rig.mode };
  });
  const advance = (frames) => page.evaluate((n) => {
    for (let i = 0; i < n; i++) window.__rig.update(1 / 60);
  }, frames);
  // real keyboard event: cinema -> fly via the ArrowUp alias
  await page.keyboard.down('ArrowUp');
  await advance(45);
  await page.keyboard.up('ArrowUp');
  const mid = await page.evaluate(() => {
    const c = window.__sim.camera.position;
    return { x: c.x, z: c.z, mode: window.__rig.mode };
  });
  const flew = Math.hypot(mid.x - before.x, mid.z - before.z);
  // teleport to the yard at eye height, then walk forward on the ground
  await page.evaluate(() => {
    const S = window.__sim;
    S.jump('pagalms');
    window.__rig.setMode('walk');
  });
  await advance(45);
  const walkBefore = await page.evaluate(() => {
    const c = window.__sim.camera.position;
    return { x: c.x, z: c.z };
  });
  await page.keyboard.down('ArrowUp');
  await advance(75);
  await page.keyboard.up('ArrowUp');
  const after = await page.evaluate(() => {
    const c = window.__sim.camera.position;
    return { x: c.x, z: c.z, mode: window.__rig.mode, grounded: window.__rig.grounded };
  });
  const walked = Math.hypot(after.x - walkBefore.x, after.z - walkBefore.z);
  console.log(`cinema->${mid.mode} flew ${flew.toFixed(1)}m; walk grounded=${after.grounded} walked ${walked.toFixed(1)}m`);
  const passed = mid.mode === 'fly' && flew > 0.5 && after.mode === 'walk'
    && after.grounded && walked > 0.5 && browserErrors === 0;
  console.log(passed ? 'PASS' : 'FAIL');
  process.exitCode = passed ? 0 : 1;
  if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
} finally {
  await browser.close();
}
