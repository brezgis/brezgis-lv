// Controls test, Minecraft flow: ArrowUp from the intro leaves cinema FLYING
// and moves; forcing walk mode grounds the player and ArrowUp walks.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 120000,
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=900,560', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 560 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
  await page.evaluate(() => {
    window.__sim.era(3);
    window.__sim.jump('pagalms');
  });
  const before = await page.evaluate(() => {
    const c = window.__sim.camera.position;
    return { x: c.x, z: c.z, mode: window.__rig.mode };
  });
  // real keyboard event: cinema -> fly via the ArrowUp alias
  await page.keyboard.down('ArrowUp');
  // headless throttles rAF; screenshots force frames
  for (let i = 0; i < 8; i++) await page.screenshot({ path: '/dev/null' }).catch(() => {});
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
  for (let i = 0; i < 4; i++) await page.screenshot({ path: '/dev/null' }).catch(() => {});
  await page.keyboard.down('ArrowUp');
  for (let i = 0; i < 8; i++) await page.screenshot({ path: '/dev/null' }).catch(() => {});
  await page.keyboard.up('ArrowUp');
  const after = await page.evaluate(() => {
    const c = window.__sim.camera.position;
    return { x: c.x, z: c.z, mode: window.__rig.mode, grounded: window.__rig.grounded };
  });
  const walked = Math.hypot(after.x - mid.x, after.z - mid.z);
  console.log(`cinema->${mid.mode} flew ${flew.toFixed(1)}m; walk grounded=${after.grounded} walked ${walked.toFixed(1)}m`);
  console.log(mid.mode === 'fly' && flew > 0.5 && after.mode === 'walk' && after.grounded && walked > 0.5 ? 'PASS' : 'FAIL');
  if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
} finally {
  await browser.close();
}
