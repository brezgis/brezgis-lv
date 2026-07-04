// Tiny static server for the Brezgi time machine.
// Serves artifact/ on all interfaces (tailnet included). No dependencies.
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, normalize, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'artifact');
const PORT = process.env.PORT ? +process.env.PORT : 4119; // Taurene: LV-4119
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/' || path === '/index.html') path = '/brezgi-taurene.html';
    if (path === '/writeup') path = '/../WRITEUP.md';
    const file = normalize(join(ROOT, path));
    const projectRoot = normalize(join(ROOT, '..'));
    if (!file.startsWith(projectRoot)) throw new Error('outside root');
    await stat(file);
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found — try /');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Brezgi time machine serving on http://0.0.0.0:${PORT}`);
});
