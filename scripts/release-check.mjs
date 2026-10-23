import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dist = new URL('../dist/', import.meta.url);
const manifestRelease = JSON.parse(await readFile(new URL('release.json', dist), 'utf8'));
assert.deepEqual(Object.keys(manifestRelease.apps).sort(), ['rhythm', 'tuno', 'tunotes']);
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
  assert.equal('portableFile' in release, false);
  assert.equal('portableSha256' in release, false);
  assert.equal(Object.keys(release.checksums).some(name => /^.+-[a-f0-9]+\.html$/.test(name)), false);
  for (const format of [`${hosted}index.html`]) {
    const html = await readFile(new URL(format, dist), 'utf8');
    assert.ok(html.includes(`name="${id}-version" content="${release.build}"`));
    assert.ok(html.includes(`name="${id}-release" content="${release.version}"`));
    assert.ok(html.includes(`name="${id}-source" content="https://github.com/butterfras-code/tuno/tree/${release.revision}"`));
  }
  const manifest = JSON.parse(await readFile(new URL(`${hosted}manifest.webmanifest`, dist), 'utf8'));
  assert.equal(manifest.start_url, id === 'tuno' ? '/tune/' : './');
  assert.equal(manifest.scope, id === 'tuno' ? '/' : './');
  if (id === 'tuno') {
    assert.equal(manifest.id, '/');
    assert.deepEqual(manifest, JSON.parse(await readFile(new URL('hosted/manifest.webmanifest', dist), 'utf8')));
  }
  assert.equal(manifest.display, 'standalone');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find((icon) => icon.sizes === `${size}x${size}`);
    assert.ok(icon);
    const png = await readFile(new URL(id === 'tuno' ? `hosted${icon.src}` : `${hosted}${icon.src}`, dist));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  console.log(`Release ${release.version} / ${release.build}: checksums, icons, manifest and shared versions passed; source ${release.revision}${release.dirty ? ' (working changes)' : ''}.`);
}

const metadata = JSON.parse(await readFile(new URL('build-meta.json', dist), 'utf8'));
for (const input of Object.keys(metadata.apps.tunotes.inputs)) {
  assert.ok(!/^src\/(practice|audio|ui)\//.test(input), `tuNotes must not import tUno policy: ${input}`);
}

assert.equal((await readdir(dist)).includes('portable'), false, 'No standalone HTML output');
