import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 120000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
  for (const era of [0, 1, 2, 3, 4, 5]) {
    await page.evaluate((e) => window.__sim.era(e), era);
    await page.screenshot({ path: '/dev/null' }).catch(() => {});
    const info = await page.evaluate(() => {
      // renderer not exposed; count via scene traversal
      let meshes = 0, instanced = 0, instances = 0, tris = 0;
      window.__scene.traverse((o) => {
        if (o.isInstancedMesh) { instanced++; instances += o.count; if (o.geometry.index) tris += (o.geometry.index.count / 3) * o.count; }
        else if (o.isMesh) { meshes++; const g = o.geometry; tris += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3; }
      });
      return { meshes, instanced, instances, tris: Math.round(tris / 1000) + 'k' };
    });
    console.log(`era ${era}:`, JSON.stringify(info));
  }
} finally {
  await browser.close();
}
