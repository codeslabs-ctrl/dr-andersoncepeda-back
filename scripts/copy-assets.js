/**
 * Copia la carpeta assets al directorio dist tras compilar.
 * Así, en producción (node dist/server.js) se sirven firmas y logos desde dist/assets.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcAssets = path.join(root, 'assets');
const distAssets = path.join(root, 'dist', 'assets');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created:', path.relative(root, dir));
  }
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
    console.log('Copied:', path.relative(root, src), '->', path.relative(root, dest));
  }
}

// Asegurar estructura mínima en dist/assets (firmas, logos)
ensureDir(path.join(distAssets, 'firmas'));
ensureDir(path.join(distAssets, 'logos'));

// Si existe assets en la raíz del backend, copiarla a dist/assets
if (fs.existsSync(srcAssets)) {
  copyRecursive(srcAssets, distAssets);
  console.log('Assets copied to dist/assets');
} else {
  console.log('No assets/ folder at backend root; dist/assets structure created.');
}
