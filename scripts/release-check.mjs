import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dist = new URL('../dist/', import.meta.url);
const release = JSON.parse(await readFile(new URL('release.json', dist), 'utf8'));
const digest = (data) => createHash('sha256').update(data).digest('hex');
for (const [name, expected] of Object.entries(release.checksums)) {
  assert.equal(digest(await readFile(new URL(`hosted/${name}`, dist))), expected, name);
}
const portable = await readFile(new URL('portable/tuno.html', dist));
assert.equal(digest(portable), release.portableSha256);
assert.deepEqual(portable, await readFile(new URL(`hosted/tuno-${release.build}.html`, dist)));
for (const format of ['hosted/index.html', 'portable/tuno.html']) {
  const html = await readFile(new URL(format, dist), 'utf8');
  assert.ok(html.includes(`name="tuno-version" content="${release.build}"`));
  assert.ok(html.includes(`name="tuno-release" content="${release.version}"`));
  assert.ok(html.includes(`name="tuno-source" content="https://github.com/butterfras-code/tuno/tree/${release.revision}"`));
}
const manifest = JSON.parse(await readFile(new URL('hosted/manifest.webmanifest', dist), 'utf8'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
for (const size of [192, 512]) {
  const icon = manifest.icons.find((icon) => icon.sizes === `${size}x${size}`);
  assert.ok(icon);
  const png = await readFile(new URL(`hosted/${icon.src}`, dist));
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
assert.equal(/<link\b/.test(portable.toString()), false, 'Portable has no manifest or external stylesheet');
console.log(`Release ${release.version} / ${release.build}: checksums, matching download, icons, manifest and shared versions passed; source ${release.revision}${release.dirty ? ' (working changes)' : ''}.`);
