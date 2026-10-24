import { buildSuite } from './suite-build.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as esbuild from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dev = process.argv.includes('--dev');
const hostedRoot = path.join(root, 'dist/hosted');
await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(hostedRoot, { recursive: true });

const packageInfo = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const apps = [
  { id: 'tuno', name: 'tUno', title: 'tUno — Practice with a friend', description: 'Local-first tuner, reference tones, and metronome.', entry: 'src/main.ts', template: 'src/index.html', directory: 'tune', excluded: [] },
  { id: 'tunotes', name: 'tuNotes', title: 'tuNotes — Read Notes with a friend', description: 'Note-reading companion · Technical preview.', entry: 'src/apps/tunotes/main.ts', template: 'src/apps/tunotes/index.html', directory: 'notes', excluded: [] },
  { id: 'rhythm', name: 'Uno234', title: 'Uno234 — Practice rhythm with a friend', description: 'Rhythm and counting practice.', entry: 'src/apps/rhythm-walk/main.ts', template: 'src/apps/rhythm-walk/index.html', directory: 'rhythm', excluded: [] },
];
let revision = 'unknown';
let dirty = true;
try {
  revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
} catch { /* Source archives may not have Git metadata. */ }
const sourceUrl = /^[a-f0-9]{40}$/.test(revision) ? `https://github.com/butterfras-code/tuno/tree/${revision}` : 'https://github.com/butterfras-code/tuno';
const releases = {};
const metadata = {};
async function buildApp(app) {
  const hosted = path.join(hostedRoot, app.directory);
  await mkdir(hosted, { recursive: true });
  const manifest = JSON.stringify({
    id: app.id === 'tuno' ? '/' : './', name: app.title, short_name: app.name,
    start_url: app.id === 'tuno' ? '/tune/' : './', scope: app.id === 'tuno' ? '/' : './', display: 'standalone',
    background_color: '#f4efe7', theme_color: '#f4efe7',
    description: app.description,
    icons: [192, 512].map((size) => ({ src: app.id === 'tuno' ? `/tune/icon-${size}.png` : `./icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })),
  }, null, 2);
  const icons = Object.fromEntries(await Promise.all([192, 512].map(async (size) => [
    `icon-${size}.png`, await readFile(path.join(root, `src/assets/icons/icon-${size}.png`)),
  ])));
  const options = {
    absWorkingDir: root,
    entryPoints: [app.entry],
    bundle: true,
    loader: { '.svg': 'dataurl', '.ttf': 'dataurl', '.txt': 'text' },
    define: { HOSTED_OFFLINE_ENABLED: String(!dev), FONT_LICENSES: JSON.stringify((await Promise.all([
      readFile(path.join(root, 'src/assets/fonts/nunito-OFL.txt'), 'utf8'),
      readFile(path.join(root, 'src/assets/fonts/nunito-sans-OFL.txt'), 'utf8'),
    ])).join('\n\n')) },
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    outfile: path.join(hosted, 'app.js'),
    minify: !dev,
    legalComments: 'inline',
    metafile: true,
    plugins: [{
      name: 'distribution-html',
      setup(build) {
        build.onLoad({ filter: /[/\\]main\.ts$/ }, async (args) => ({
          contents: await readFile(args.path, 'utf8'),
          loader: 'ts',
          watchFiles: [path.join(root, app.template)],
        }));
        build.onEnd(async (result) => {
          if (result.errors.length) return;
          for (const [name, output] of Object.entries(result.metafile.outputs)) {
            if (output.imports.some((resource) => !resource.path.startsWith('data:'))) {
              throw new Error(`Unbundled resource in ${name}`);
            }
            if (!['app.js', 'app.css'].includes(path.basename(name))) {
              throw new Error(`Build does not yet handle ${name}`);
            }
          }
          const [template, js, css] = await Promise.all([
            readFile(path.join(root, app.template), 'utf8'),
            readFile(path.join(hosted, 'app.js'), 'utf8'),
            readFile(path.join(hosted, 'app.css'), 'utf8'),
          ]);
          const workerTemplate = await readFile(path.join(root, 'src/distribution/service-worker.js'), 'utf8');
          const worker = workerTemplate.replaceAll('__APP_ID__', app.id).replace('__EXCLUDED_PATHS__', JSON.stringify(app.excluded));
          const version = createHash('sha256').update(template + js + css + worker + manifest + packageInfo.version + sourceUrl).update(icons['icon-192.png']).update(icons['icon-512.png']).digest('hex').slice(0, 16);
          const render = (styles, scripts) => template
            .replace('<!-- version -->', `<meta name="${app.id}-version" content="${version}"><meta name="${app.id}-release" content="${packageInfo.version}"><meta name="${app.id}-source" content="${sourceUrl}">`)
            .replace('<!-- styles -->', () => styles)
            .replace('<!-- scripts -->', () => scripts);
          const hostedHtml = render('<link rel="stylesheet" href="./app.css">' + (!dev
            ? `<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icon-192.png">` : ''), '<script defer src="./app.js"></script>');
          const resources = { 'index.html': hostedHtml, 'app.js': js, 'app.css': css,
            ...(!dev ? { 'manifest.webmanifest': manifest, ...icons } : {}),
          };
          const integrity = Object.fromEntries(Object.entries(resources)
            .map(([name, contents]) => [name, 'sha256-' + createHash('sha256').update(contents).digest('base64')]));
          const workerSource = worker.replace('__BUILD_VERSION__', version).replace('__RESOURCE_INTEGRITY__', JSON.stringify(integrity));
          const allHosted = { ...resources, ...(!dev ? { 'sw.js': workerSource } : {}) };
          const checksums = Object.fromEntries(Object.entries(allHosted).map(([name, contents]) => [name, createHash('sha256').update(contents).digest('hex')]));
          await Promise.all([
            ...Object.entries(allHosted).map(([name, contents]) => writeFile(path.join(hosted, name), contents)),
          ]);
          if (app.id === 'rhythm') {
            for (const route of ['rhythm-walk', 'count-writing']) {
              const legacy = path.join(hostedRoot, 'prototypes', route);
              await mkdir(legacy, { recursive: true });
              await writeFile(path.join(legacy, 'index.html'), hostedHtml.replaceAll('./app.', '/rhythm/app.').replaceAll('href="./', 'href="/rhythm/'));
            }
          }
          if (app.id === 'tuno') {
            const siteFiles = Object.fromEntries(await Promise.all([
              '_redirects', '_headers', '404.html', ...(!dev ? ['sw.js'] : []),
            ].map(async (name) => [name, await readFile(path.join(root, 'src/site', name))])));
            if (!dev) siteFiles['manifest.webmanifest'] = manifest;
            await Promise.all(Object.entries(siteFiles).map(([name, contents]) => writeFile(path.join(hostedRoot, name), contents)));
          }
          releases[app.id] = { version: packageInfo.version, build: version, revision, dirty, checksums, hostedDirectory: app.directory };
          metadata[app.id] = result.metafile;
          await writeFile(path.join(root, 'dist/release.json'), JSON.stringify({ ...releases.tuno, apps: releases }, null, 2));
          if (dev) await buildSuite(true);
          await writeFile(path.join(root, 'dist/build-meta.json'), JSON.stringify({ ...metadata.tuno, apps: metadata }, null, 2));
        });
      },
    }],
  };

  if (dev) {
    const context = await esbuild.context(options);
    await context.rebuild();
    await context.watch();
    if (app.id === 'tuno') {
      const { port } = await context.serve({ servedir: hostedRoot, host: '127.0.0.1', port: 5173 });
      console.log(`Practice Tools: http://127.0.0.1:${port}/ — refresh after editing.`);
    }
    const shutdown = async () => { await context.dispose(); process.exit(0); };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } else {
    await esbuild.build(options);
  }
}
for (const app of apps) await buildApp(app);
await buildSuite(dev);
console.log('Hosted PWA builds passed.');
