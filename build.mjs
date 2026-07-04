// Bundle the sim and inline it (plus the chronicle) into the artifact page.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'fs';

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: 'dist/bundle.js',
  logLevel: 'info',
});

let page = readFileSync('artifact/page.html', 'utf8');
const bundle = readFileSync('dist/bundle.js', 'utf8');

// chronicle: WRITEUP.html fragment if present
let about = '<p>Chronicle forthcoming.</p>';
if (existsSync('artifact/about-fragment.html')) {
  about = readFileSync('artifact/about-fragment.html', 'utf8');
}
page = page.replace('<!--ABOUT-->', about);
page = page.replace('/*BUNDLE*/', () => bundle.replace(/<\/script>/g, '<\\/script>'));
writeFileSync('artifact/brezgi-taurene.html', page);
console.log('artifact/brezgi-taurene.html', (page.length / 1024 / 1024).toFixed(2) + 'MB');
