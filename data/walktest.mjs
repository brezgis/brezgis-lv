// Controls test: pressing ArrowUp in orbit mode must auto-enter walk mode
// and actually move the player forward (the arrow-key alias path).
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load' });
await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
await page.evaluate(() => {
  window.__sim.era(3);
  window.__sim.jump('pagalms');
});
const before = await page.evaluate(() => {
  const c = window.__sim.camera.position;
  return { x: c.x, z: c.z, mode: window.__rig.mode };
});
// real keyboard event: orbit -> walk via the ArrowUp alias
await page.keyboard.down('ArrowUp');
// headless throttles rAF; screenshots force frames
for (let i = 0; i < 12; i++) await page.screenshot({ path: '/dev/null' }).catch(() => {});
await page.keyboard.up('ArrowUp');
const after = await page.evaluate(() => {
  const c = window.__sim.camera.position;
  return { x: c.x, z: c.z, mode: window.__rig.mode, grounded: window.__rig.grounded };
});
const dist = Math.hypot(after.x - before.x, after.z - before.z);
console.log(`mode ${before.mode} -> ${after.mode}, moved ${dist.toFixed(2)}m, grounded=${after.grounded}`);
console.log(after.mode === 'walk' && dist > 0.5 ? 'PASS' : 'FAIL');
if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
await browser.close();
