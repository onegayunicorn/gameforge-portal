'use strict';
/**
 * electron-builder afterPack hook.
 *
 * The packager's file matcher drops `**\/.gitkeep` placeholder files when copying
 * extraResources, which would leave the embedded payload with empty directories instead of
 * the markers the source trees ship. This copies exactly the missing files across so the
 * payload inside the application is structurally identical to the supplied builds.
 */

const fs = require('fs');
const path = require('path');

function relFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) out.push(path.relative(root, full));
    }
  };
  walk(root);
  return out;
}

exports.default = async function afterPack(context) {
  const srcRoot = path.join(context.packager.projectDir, 'payload');
  const dstRoot = path.join(context.appOutDir, 'resources', 'payload');
  if (!fs.existsSync(srcRoot)) return;

  let copied = 0;
  for (const rel of relFiles(srcRoot)) {
    const dst = path.join(dstRoot, rel);
    if (fs.existsSync(dst)) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(srcRoot, rel), dst);
    copied += 1;
  }

  const srcCount = relFiles(srcRoot).length;
  const dstCount = relFiles(dstRoot).length;
  console.log(`  • payload sync  restored=${copied} source=${srcCount} packaged=${dstCount}`);

  // Also mirror the sidecar metadata for completeness.
  const metaSrc = path.join(context.packager.projectDir, 'build-meta');
  const metaDst = path.join(context.appOutDir, 'resources', 'build-meta');
  if (fs.existsSync(metaSrc)) {
    for (const rel of relFiles(metaSrc)) {
      const dst = path.join(metaDst, rel);
      if (fs.existsSync(dst)) continue;
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(path.join(metaSrc, rel), dst);
    }
  }

  if (dstCount !== srcCount) {
    throw new Error(`Payload mirror mismatch: source=${srcCount} packaged=${dstCount}`);
  }
};
