// Tiny static server for the Brezgi time machine.
// Serves artifact/ on all interfaces (tailnet included). No dependencies.
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, normalize, extname } from 'path';
import { brotliCompressSync, gzipSync, constants as Z } from 'zlib';
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

// Compressed copies, kept until the file changes: the 2.1 MB page goes out as
// 0.85 MB (brotli) or 0.92 MB (gzip; the base64 satellite JPEG barely shrinks). Keyed by mtime, so a rebuild is
// picked up on the next request exactly as before.
const packed = new Map();
function compressed(file, mtimeMs, body, enc) {
  const key = file + '|' + enc;
  const hit = packed.get(key);
  if (hit && hit.mtimeMs === mtimeMs) return hit.data;
  const data = enc === 'br'
    ? brotliCompressSync(body, { params: { [Z.BROTLI_PARAM_QUALITY]: 9, [Z.BROTLI_PARAM_SIZE_HINT]: body.length } })
    : gzipSync(body, { level: 9 });
  packed.set(key, { mtimeMs, data });
  return data;
}
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.md', '.json']);

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/' || path === '/index.html') path = '/brezgi-taurene.html';
    if (path === '/writeup') path = '/../WRITEUP.md';
    const file = normalize(join(ROOT, path));
    const projectRoot = normalize(join(ROOT, '..'));
    if (!file.startsWith(projectRoot)) throw new Error('outside root');
    const st = await stat(file);
    let body = await readFile(file);
    const headers = {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache',
      vary: 'accept-encoding',
    };
    const accept = String(req.headers['accept-encoding'] || '');
    if (COMPRESSIBLE.has(extname(file)) && body.length > 1024) {
      const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
      if (enc) { body = compressed(file, st.mtimeMs, body, enc); headers['content-encoding'] = enc; }
    }
    headers['content-length'] = body.length;
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found — try /');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Brezgi time machine serving on http://0.0.0.0:${PORT}`);
});
