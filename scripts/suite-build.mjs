import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out = new URL('../dist/hosted/', import.meta.url);
let launcherContext;
async function writeLauncher() {
  const template = await readFile(new URL('../src/site/index.html', import.meta.url), 'utf8');
  const launcher = template.replace('<!-- styles -->', '<link rel="stylesheet" href="/launcher.css">').replace('<!-- scripts -->', '<script defer src="/launcher.js"></script>');
  await writeFile(new URL('index.html', out), launcher);
}

/** Static directory entries work on Pages, ordinary hosts, refresh and bookmarks. */
export async function buildSuite(dev) {
  const options = { entryPoints: ['src/site/main.ts'], bundle: true, outfile: new URL('launcher.js', out).pathname,
    loader: { '.svg': 'dataurl', '.ttf': 'dataurl' }, format: 'iife', target: 'es2022', minify: !dev,
    define: { HOSTED_OFFLINE_ENABLED: String(!dev) },
    plugins: [{ name: 'launcher-html', setup(build) {
      build.onLoad({ filter: /site[/\\]main\.ts$/ }, async args => ({
        contents: await readFile(args.path, 'utf8'), loader: 'ts',
        watchFiles: [new URL('../src/site/index.html', import.meta.url).pathname],
      }));
      build.onEnd(async result => { if (!result.errors.length) await writeLauncher(); });
    } }],
  };
  if (dev) {
    if (!launcherContext) {
      launcherContext = await esbuild.context(options);
      await launcherContext.watch();
      process.on('SIGINT', () => void launcherContext.dispose());
      process.on('SIGTERM', () => void launcherContext.dispose());
    }
    await launcherContext.rebuild();
  } else await esbuild.build(options);
  const launcher = await readFile(new URL('index.html', out), 'utf8');
  const tune = await readFile(new URL('tune/index.html', out), 'utf8');
  const tuneHtml = tune.replaceAll('href="./', 'href="/tune/').replaceAll('src="./', 'src="/tune/').replaceAll('content="./', 'content="/tune/');
  const version = createHash('sha256').update(launcher).update(tuneHtml).update(await readFile(new URL('launcher.js', out))).update(await readFile(new URL('launcher.css', out))).digest('hex').slice(0, 16);
  const alias = tuneHtml.replace('</head>', `<meta name="suite-version" content="${version}"></head>`);
  for (const route of ['tone', 'tempo']) {
    await mkdir(new URL(route + '/', out), { recursive: true });
    await writeFile(new URL(route + '/index.html', out), alias);
  }
  if (dev) return;
  const release = JSON.parse(await readFile(new URL('../dist/release.json', import.meta.url), 'utf8'));
  const names = ['index.html', 'launcher.js', 'launcher.css', 'tone/index.html', 'tempo/index.html', ...Object.keys(release.apps.tuno.checksums).filter(name => name !== 'sw.js').map(name => 'tune/' + name)];
  const integrity = Object.fromEntries(await Promise.all(names.map(async name => [name, 'sha256-' + createHash('sha256').update(await readFile(new URL(name, out))).digest('base64')])));
  const worker = (await readFile(new URL('../src/distribution/service-worker.js', import.meta.url), 'utf8'))
    .replaceAll('__APP_ID__', 'suite').replace('__BUILD_VERSION__', version).replace('__EXCLUDED_PATHS__', JSON.stringify(['notes/', 'rhythm/', 'prototypes/'])).replace('__RESOURCE_INTEGRITY__', JSON.stringify(integrity));
  // A new root registration can replace the retirement worker before it activates.
  // Retire only the old root tUno cache after all of its existing clients close.
  const retirement = `self.addEventListener('activate', event => event.waitUntil((async () => {
    const prefix = 'tuno:' + self.registration.scope + ':';
    for (const key of await caches.keys()) if (key.startsWith(prefix)) await caches.delete(key);
  })()));`;
  await writeFile(new URL('suite-sw.js', out), worker + '\n' + retirement);
}
