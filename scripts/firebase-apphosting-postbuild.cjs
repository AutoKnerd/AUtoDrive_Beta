const fs = require('fs');
const path = require('path');

/**
 * Firebase App Hosting adapter for Next.js currently expects
 * `.next/standalone/.next/routes-manifest.json`.
 *
 * With newer Next.js versions, that file may only exist at
 * `.next/routes-manifest.json`. Mirror it when needed so deploy
 * packaging does not fail after a successful build.
 */
function ensureRoutesManifestMirror() {
  const root = process.cwd();
  const source = path.join(root, '.next', 'routes-manifest.json');
  const targetDir = path.join(root, '.next', 'standalone', '.next');
  const target = path.join(targetDir, 'routes-manifest.json');

  if (!fs.existsSync(source)) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(source, target);
}

ensureRoutesManifestMirror();
