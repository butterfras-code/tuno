import * as esbuild from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
/** Independent rhythm application; retain prototype entry points for existing links. */
export async function buildRhythmWalk(dev = false) {
  const out = path.join(root, 'dist/hosted/rhythm');
  await mkdir(out, { recursive: true });
  const options = {
    absWorkingDir: root, entryPoints: ['src/apps/rhythm-walk/main.ts'], bundle: true,
    define: { HOSTED_OFFLINE_ENABLED: String(!dev) },
    loader: { '.svg': 'dataurl', '.ttf': 'dataurl' }, format: 'iife', target: 'es2022',
    outfile: path.join(out, 'app.js'), minify: !dev,
    plugins: [{ name: 'prototype-html', setup(build) {
      build.onEnd(async result => {
        if (result.errors.length) return;
        const html = (await readFile(path.join(root, 'src/apps/rhythm-walk/index.html'), 'utf8'))
          .replace('<!-- styles -->', '<link rel="stylesheet" href="./app.css">')
          .replace('<!-- scripts -->', '<script defer src="./app.js"></script>');
        await writeFile(path.join(out, 'index.html'), html);
        const previous = path.join(root, 'dist/hosted/prototypes/rhythm-walk');
        await mkdir(previous, { recursive: true });
        await writeFile(path.join(previous, 'index.html'), html.replaceAll('./app.', '/rhythm/app.'));
        const legacy = path.join(root, 'dist/hosted/prototypes/count-writing');
        await mkdir(legacy, { recursive: true });
        await writeFile(path.join(legacy, 'index.html'), html.replaceAll('./app.', '/rhythm/app.'));
      });
    } }],
  };
  if (!dev) { await esbuild.build(options); return; }
  const context = await esbuild.context(options);
  await context.rebuild();
  await context.watch();
  process.on('SIGINT', async () => { await context.dispose(); process.exit(0); });
  process.on('SIGTERM', async () => { await context.dispose(); process.exit(0); });
}
