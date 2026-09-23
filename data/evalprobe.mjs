// node data/evalprobe.mjs era file.js — boots the artifact, runs the JS, prints the result
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'fs';
const [,, era = '4', file] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-gl=angle', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 300)); });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
  await page.evaluate((e) => window.__sim.era(+e), era);
  await new Promise((r) => setTimeout(r, 1500));
  console.log(await page.evaluate(readFileSync(file, 'utf8')));
} finally { await browser.close(); }
