import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { chromium } from 'playwright';
import { zipSync, strToU8 } from 'fflate';
import { hostBuild } from './test-host.mjs';
import { captureOptions, captureProfiles } from './screenshot-options.mjs';
import { screenshotScenarios } from './screenshot-scenarios.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const help = `Capture a reusable tUno screenshot set into a ZIP.

  npm run screenshots -- [options]
  --replace             Atomically replace screenshots/latest.zip after success
  --new                 Create a timestamped ZIP; keep previous archives
  --only <id,group,...>  Select scenarios or groups: notes, uno234, fingering, configurator
  --profiles <id,...>   Select viewport IDs, primary, or all (default: all)
  --jobs <1..8>         Concurrent captures (default: 2)
  --output <directory>  Archive directory (default: screenshots/)
  --no-build            Capture the existing dist/ build
  --list                List scenarios, profiles, and selected capture count
  --help                Show this help

Without --replace/--new, ask in an interactive terminal; otherwise create a new ZIP.
Fingering examples use portrait touch profiles for violin and phone-landscape for trumpet.`;

function gallery(report) {
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>tUno screenshots</title>
<style>body{font:16px system-ui;margin:2rem;background:#f7f6f2;color:#222}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:1rem}figure{margin:0;padding:1rem;background:white;border-radius:12px}img{width:100%;height:260px;object-fit:contain}figcaption{margin-top:1rem}a{color:#075c65}</style>
<h1>tUno screenshots</h1><p>${escape(report.revision)} · ${escape(report.browser)} · ${report.captures.length} captures. Sizes are CSS viewport pixels, captured at 1×.</p>
<p>Fold8 sizes are provisional. See <a href="manifest.json">manifest.json</a> for build details and capture states.</p><main>${report.captures.map(c => `<figure><a href="${escape(c.file)}"><img loading="lazy" src="${escape(c.file)}" alt="${escape(c.title)}"></a><figcaption>${escape(c.title)}<br>${escape(c.profile)} · ${c.viewport.width} × ${c.viewport.height}</figcaption></figure>`).join('\n')}</main></html>`;
}

async function run() {
  if (process.argv.includes('--help')) { console.log(help); return; }
  const options = captureOptions(process.argv.slice(2), screenshotScenarios);
  if (options.list) {
    console.log(screenshotScenarios.map(s => `${s.id}: ${s.title}`).join('\n'));
    console.log('\nProfiles:\n' + captureProfiles.map(p => `${p.id}: ${p.viewport.width}×${p.viewport.height}${p.provisional ? ' (provisional)' : ''}`).join('\n'));
    console.log(`\nSelected: ${options.captures.length} captures.`); return;
  }
  let replace = options.replace;
  if (!replace && !options.new && process.stdin.isTTY && process.stdout.isTTY) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = (await prompt.question('Replace latest.zip or create a new ZIP? [r/N] ')).trim().toLowerCase();
      if (!['', 'n', 'new', 'r', 'replace'].includes(answer)) throw new Error('Expected r/replace or n/new.');
      replace = ['r', 'replace'].includes(answer);
    } finally { prompt.close(); }
  }
  const output = resolve(options.output);
  const fromDist = relative(join(root, 'dist'), output);
  if (fromDist !== '..' && !fromDist.startsWith(`..${sep}`) && !isAbsolute(fromDist)) throw new Error('--output must be outside dist/, which builds replace.');
  await mkdir(output, { recursive: true });
  const lockPath = join(output, '.capture.lock');
  const lock = await open(lockPath, 'wx').catch(error => {
    if (error.code === 'EEXIST') throw new Error(`Another capture may be running: ${lockPath}. If it was interrupted, remove this lock before retrying.`);
    throw error;
  });
  let temporary, host, browser;
  try {
    await lock.writeFile(`${process.pid}\n`);
    temporary = await mkdtemp(join(output, '.capture-'));
    if (!options['no-build']) {
      const build = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });
      if (build.error) throw build.error;
      if (build.status !== 0) throw new Error(`Build failed (${build.status}).`);
    }
    const release = JSON.parse(await readFile('dist/release.json', 'utf8'));
    host = await hostBuild();
    browser = await chromium.launch();
    const report = {
      version: 1, capturedAt: new Date().toISOString(), revision: release.revision,
      build: release.build, dirty: release.dirty, browser: `Chromium ${browser.version()}`,
      seed: 234, deviceScaleFactor: 1, reducedMotion: 'reduce',
      notes: ['CSS viewport sizes, not hardware emulation.', 'Fold8 profiles are provisional.', 'Tuner uses synthetic 440 Hz input; no real microphone is accessed. No audio is sent to speakers.', 'Multiplayer is frozen after its countdown. Perform shows the ready-to-play panel with written counts enabled.', 'Each capture starts with fresh browser storage.'],
      captures: [],
    };
    let next = 0, failed = false;
    async function worker() {
      while (!failed && next < options.captures.length) {
        const index = next++;
        const { profile, scenario } = options.captures[index];
        const file = `${profile.id}/${scenario.id}.png`;
        const context = await browser.newContext({ viewport: profile.viewport, hasTouch: profile.hasTouch, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        try {
          await context.addInitScript(() => {
            let seed = 234;
            Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
          });
          const page = await context.newPage();
          page.setDefaultTimeout(12000);
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          const response = await page.goto(new URL(scenario.route, host.url).href);
          if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
          await page.locator('h1').waitFor();
          await page.waitForFunction(() => document.querySelector('#offline-status')?.textContent === 'Offline ready', null, { timeout: 12000 });
          await page.evaluate(() => document.fonts.ready);
          await scenario.setup(page);
          await page.evaluate(() => document.fonts.ready);
          // Clear transient hover/focus rings and capture the viewport, never fullPage.
          await page.mouse.move(0, 0);
          await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
          await mkdir(join(temporary, profile.id), { recursive: true });
          const path = join(temporary, file);
          await page.screenshot({ path, animations: 'disabled', caret: 'hide' });
          if (errors.length) throw new Error(errors.join('; '));
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          if (overflow) throw new Error('Page has horizontal overflow.');
          const warnings = await page.locator('.multiplayer-fit-warning:visible').allTextContents();
          report.captures[index] = { file, title: scenario.title, scenario: scenario.id, route: scenario.route, profile: profile.id, viewport: profile.viewport, provisional: Boolean(profile.provisional), warnings };
          console.log(`[${index + 1}/${options.captures.length}] ${file}`);
        } catch (error) {
          failed = true;
          throw new Error(`${profile.id} / ${scenario.id}: ${error.message}`, { cause: error });
        } finally { await context.close(); }
      }
    }
    const workers = await Promise.allSettled(Array.from({ length: Math.min(options.jobs, options.captures.length) }, worker));
    const failures = workers.filter(result => result.status === 'rejected');
    if (failures.length) throw new Error(failures.map(result => result.reason.message).join('\n'));
    const entries = Object.fromEntries(await Promise.all(report.captures.map(async capture => [capture.file, [new Uint8Array(await readFile(join(temporary, capture.file))), { level: 0 }]])));
    entries['manifest.json'] = strToU8(JSON.stringify(report, null, 2) + '\n');
    entries['index.html'] = strToU8(gallery(report));
    const stamp = report.capturedAt.replaceAll(/[:.]/g, '-');
    const filename = replace ? 'latest.zip' : `tuno-${stamp}-${randomUUID().slice(0, 8)}.zip`;
    const staged = join(temporary, 'complete.zip');
    await writeFile(staged, zipSync(entries));
    await rename(staged, join(output, filename));
    console.log(`\nSaved ${report.captures.length} screenshots: ${join(output, filename)}`);
  } finally {
    const cleanup = await Promise.allSettled([
      browser?.close(), host?.close(),
      temporary ? rm(temporary, { recursive: true, force: true }) : undefined,
      lock.close(),
    ]);
    await rm(lockPath, { force: true });
    for (const result of cleanup) if (result.status === 'rejected') console.error(`Cleanup: ${result.reason.message}`);
  }
}

run().catch(error => { console.error(error.message); process.exitCode = 1; });
