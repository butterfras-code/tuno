import * as esbuild from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dev = process.argv.includes('--dev');
const hosted = path.join(root, 'dist/hosted');
const portable = path.join(root, 'dist/portable');
await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(hosted, { recursive: true });
await mkdir(portable, { recursive: true });

const options = {
  absWorkingDir: root,
  entryPoints: ['src/main.ts'],
  bundle: true,
  loader: { '.svg': 'dataurl', '.ttf': 'dataurl' },
  define: { FONT_LICENSES: JSON.stringify((await Promise.all([
    readFile(path.join(root, 'src/assets/fonts/nunito-OFL.txt'), 'utf8'),
    readFile(path.join(root, 'src/assets/fonts/nunito-sans-OFL.txt'), 'utf8'),
  ])).join('\n\n')) },
  // A classic, bundled script also runs under file:// without module fetching.
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
      build.onLoad({ filter: /[/\\]src[/\\]main\.ts$/ }, async (args) => ({
        contents: await readFile(args.path, 'utf8'),
        loader: 'ts',
        watchFiles: [path.join(root, 'src/index.html')],
      }));
      build.onEnd(async (result) => {
        if (result.errors.length) return;
        for (const [name, output] of Object.entries(result.metafile.outputs)) {
          if (output.imports.some((resource) => !resource.path.startsWith('data:'))) {
            throw new Error(`Unbundled resource in ${name}`);
          }
          if (!['app.js', 'app.css'].includes(path.basename(name))) {
            throw new Error(`Portable packaging does not yet handle ${name}`);
          }
        }
        const [template, js, css] = await Promise.all([
          readFile(path.join(root, 'src/index.html'), 'utf8'),
          readFile(path.join(hosted, 'app.js'), 'utf8'),
          readFile(path.join(hosted, 'app.css'), 'utf8'),
        ]);
        const render = (styles, scripts) => template
          .replace('<!-- styles -->', () => styles)
          .replace('<!-- scripts -->', () => scripts);
        const html = render(`<style>${css}</style>`, `<script>${js}</script>`);
        // esbuild escapes script/style closing sequences for safe inline embedding.
        // Reject resource-bearing markup/CSS; runtime requests are checked in browser tests.
        if (/<[^>]+\s(?:src|srcset)\s*=/i.test(template) || /<link\b/i.test(template)
          || /@import\b/i.test(css)
          || [...css.matchAll(/url\(\s*[\"']?([^\"')]+)/gi)].some((match) => !match[1].startsWith('data:'))) {
          throw new Error('Portable HTML contains an unsupported resource reference.');
        }
        await Promise.all([
          writeFile(path.join(hosted, 'index.html'), render(
            '<link rel="stylesheet" href="./app.css">',
            '<script defer src="./app.js"></script>',
          )),
          writeFile(path.join(portable, 'tuno.html'), html),
          writeFile(path.join(root, 'dist/build-meta.json'), JSON.stringify(result.metafile, null, 2)),
        ]);
      });
    },
  }],
};

if (dev) {
  const context = await esbuild.context(options);
  await context.watch();
  const { port } = await context.serve({ servedir: hosted, host: '127.0.0.1', port: 5173 });
  console.log(`tUno: http://127.0.0.1:${port} — refresh after editing.`);
  const shutdown = async () => { await context.dispose(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} else {
  await esbuild.build(options);
  console.log('Built dist/hosted/ and dist/portable/tuno.html; resource checks passed.');
}
