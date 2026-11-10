// Where does a frame go? Triangles and draw calls actually SUBMITTED per scene
// branch, measured by rendering with one branch visible at a time.
// node data/profile.mjs [era=2] [view=pagalms] [branch]   (branch: break one top-level group down)
import puppeteer from 'puppeteer-core';
const era = +(process.argv[2] ?? 2), view = process.argv[3] || 'pagalms';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
  await page.evaluate((e, v) => { window.__sim.era(e); window.__sim.jump(v); }, era, view);
  await new Promise((r) => setTimeout(r, 9000));
  await page.evaluate((b) => { window.__branch = b; }, process.argv[4] || '');
  const rows = await page.evaluate(async () => {
    const R = window.__renderer, S = window.__scene;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const branch = window.__branch ? S.children.find((o) => o.name === window.__branch) : S;
    if (branch !== S) for (const o of S.children) if (o !== branch && !o.isLight) o.visible = false;
    const kids = branch.children.filter((o) => o.visible);
    const out = [];
    await frame();
    out.push(['ALL', R.info.render.triangles, R.info.render.calls]);
    for (const k of kids) {
      for (const o of kids) o.visible = o === k;
      await frame();
      out.push([k.name || k.type, R.info.render.triangles, R.info.render.calls, k.children.length]);
    }
    for (const o of kids) o.visible = true;
    return out;
  });
  rows.sort((a, b) => b[1] - a[1]);
  for (const r of rows) if (r[1] > 100000 || r[2] > 20) console.log(String(r[0]).padEnd(28), (r[1] / 1e6).toFixed(2).padStart(7), 'M tris', String(r[2]).padStart(6), 'calls');
} finally { await browser.close(); }
