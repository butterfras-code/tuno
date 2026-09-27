import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dist = new URL('../dist/', import.meta.url);
const manifestRelease = JSON.parse(await readFile(new URL('release.json', dist), 'utf8'));
assert.deepEqual(Object.keys(manifestRelease.apps).sort(), ['tuno', 'tunotes']);
assert.equal(manifestRelease.build, manifestRelease.apps.tuno.build);
assert.deepEqual(manifestRelease.checksums, manifestRelease.apps.tuno.checksums);
for (const [id, release] of Object.entries(manifestRelease.apps)) {
  const hosted = `hosted/${release.hostedDirectory ? release.hostedDirectory + '/' : ''}`;
  assert.equal(release.version, manifestRelease.version);
  assert.equal(release.revision, manifestRelease.revision);
  assert.equal(release.dirty, manifestRelease.dirty);
  const digest = (data) => createHash('sha256').update(data).digest('hex');
  for (const [name, expected] of Object.entries(release.checksums)) {
    assert.equal(digest(await readFile(new URL(`${hosted}${name}`, dist))), expected, name);
  }
  const portable = await readFile(new URL(`portable/${id}.html`, dist));
  assert.equal(digest(portable), release.portableSha256);
  assert.deepEqual(portable, await readFile(new URL(`${hosted}${id}-${release.build}.html`, dist)));
  for (const format of [`${hosted}index.html`, `portable/${id}.html`]) {
    const html = await readFile(new URL(format, dist), 'utf8');
    assert.ok(html.includes(`name="${id}-version" content="${release.build}"`));
    assert.ok(html.includes(`name="${id}-release" content="${release.version}"`));
    assert.ok(html.includes(`name="${id}-source" content="https://github.com/butterfras-code/tuno/tree/${release.revision}"`));
  }
  const manifest = JSON.parse(await readFile(new URL(`${hosted}manifest.webmanifest`, dist), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find((icon) => icon.sizes === `${size}x${size}`);
    assert.ok(icon);
    const png = await readFile(new URL(`${hosted}${icon.src}`, dist));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  assert.equal(/<link\b/.test(portable.toString()), false, 'Portable has no manifest or external stylesheet');
  console.log(`Release ${release.version} / ${release.build}: checksums, matching download, icons, manifest and shared versions passed; source ${release.revision}${release.dirty ? ' (working changes)' : ''}.`);
}

const metadata = JSON.parse(await readFile(new URL('build-meta.json', dist), 'utf8'));
for (const input of Object.keys(metadata.apps.tunotes.inputs)) {
  assert.ok(!/^src\/(practice|audio|ui)\//.test(input), `tuNotes must not import tUno policy: ${input}`);
}
