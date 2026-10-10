import * as esbuild from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
/** Review-only page; no app navigation, service worker, manifest or portable release. */
export async function buildCountWriting(dev = false) {
  const out = path.join(root, 'dist/hosted/prototypes/count-writing');
  await mkdir(out, { recursive: true });
  const options = {
    absWorkingDir: root, entryPoints: ['src/apps/count-writing/main.ts'], bundle: true,
    loader: { '.svg': 'dataurl', '.ttf': 'dataurl' }, format: 'iife', target: 'es2022',
    outfile: path.join(out, 'app.js'), minify: !dev,
    plugins: [{ name: 'prototype-html', setup(build) {
      build.onEnd(async result => {
        if (result.errors.length) return;
        const html = (await readFile(path.join(root, 'src/apps/count-writing/index.html'), 'utf8'))
          .replace('<!-- styles -->', '<link rel="stylesheet" href="./app.css">')
          .replace('<!-- scripts -->', '<script defer src="./app.js"></script>');
        await writeFile(path.join(out, 'index.html'), html);
      });
    } }],
  };
  if (!dev) { await esbuild.build(options); return; }
  const context = await esbuild.context(options);
  await context.watch();
  const { port } = await context.serve({ servedir: path.join(root, 'dist/hosted'), host: '0.0.0.0', port: 5173 });
  console.log(`Count Writing review: http://127.0.0.1:${port}/prototypes/count-writing/`);
  process.on('SIGINT', async () => { await context.dispose(); process.exit(0); });
  process.on('SIGTERM', async () => { await context.dispose(); process.exit(0); });
}
