#!/usr/bin/env node
'use strict';

// Source-prepared recipe. Run only with the runtime owner's explicit grant.
// Visual confirmations are files supplied by the operator after viewing THIS run.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function confirmation(out, stage, startedAt) {
  const file = path.join(out, stage + '-confirmed.json');
  if (!fs.existsSync(file)) return null;
  const value = JSON.parse(fs.readFileSync(file));
  const when = Date.parse(value.reviewedAt);
  if (value.stage !== stage || !Number.isFinite(when) || when < startedAt || when > Date.now() ||
      !/^[a-z0-9-]+\.png$/.test(value.screenshot || '') ||
      !fs.existsSync(path.join(out, value.screenshot))) throw Error('Invalid visual confirmation: ' + file);
  return value;
}

async function main() {
  const root = path.resolve(process.env.WA_TEST_ROOT || path.join(__dirname, '..'));
  if (!process.env.WA_RUN_OUT) throw Error('WA_RUN_OUT must be a fresh absolute evidence directory');
  const out = path.resolve(process.env.WA_RUN_OUT);
  const git = (...args) => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8'}).trim();
  const head = git('rev-parse', 'HEAD');
  if (!/^[a-f0-9]{40}$/.test(process.env.WA_EXPECT_COMMIT || '') || head !== process.env.WA_EXPECT_COMMIT)
    throw Error('Root must pin actual tested source commit');
  if (git('status', '--porcelain', '--untracked-files=no')) throw Error('Tracked checkout must be clean');
  const moduleHash = sha(fs.readFileSync(path.join(root, 'build/wine-assembly.wasm')));
  if (moduleHash !== process.env.WA_EXPECT_WASM_SHA256) throw Error('Canonical module pin mismatch');
  const {APPS} = require(path.join(root, 'lib/apps'));
  const app = APPS.kkrieger_beta;
  if (!app?.bigMemory || !app.requiredFiles) throw Error('Original registered memory route missing');
  const fixturePins = {
    'pno0001.exe': 'ac2192b740c57125067a29d2e0ea6d95b222543398188c5f67bbf01157622685',
    'readme.txt': 'c3779b09917a72664c89c7805c45f4cf45ee89a881649a44acb3581bc8f0f269',
    'scene.org.txt': '0fd9764f56d835e0f3dd6209737bce241881902e6aa3ead91f2d02ad9d34b1c0',
  };
  const checkPins = () => {
    if (git('rev-parse', 'HEAD') !== head || git('status', '--porcelain', '--untracked-files=no') ||
        sha(fs.readFileSync(path.join(root, 'build/wine-assembly.wasm'))) !== moduleHash)
      throw Error('Source/module changed');
    for (const [file, hash] of Object.entries(fixturePins))
      if (sha(fs.readFileSync(path.join(root, path.dirname(app.exe), file))) !== hash)
        throw Error('Original fixture mismatch: ' + file);
  };
  checkPins();
  fs.mkdirSync(out, {recursive: false});
  const startedAt = Date.now(), deadline = startedAt + 900000;
  const meta = {startedAt: new Date(startedAt).toISOString(), deadline: new Date(deadline).toISOString(),
    head, moduleHash, fixturePins, app, sourceEquivalence: 'Root canonical build receipt required separately',
    scope: 'Ordinary input; no guest writes, EIP tracing or forced start', gameplayVerified: false};
  const write = (name, value) => fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(value, null, 2));
  write('meta', meta);
  const events = [];
  const event = (action, data = {}) => { events.push({at: new Date().toISOString(), action, ...data}); write('events', events); };
  const {startStaticServer, closeServer} = require(path.join(root, 'test/static-server'));
  const puppeteer = require(path.join(root, 'node_modules/puppeteer'));
  let browser, server, page;
  // Absolute owner bound includes launch, input, screenshots and shutdown.
  const watchdog = setTimeout(() => {
    try { event('hard-deadline'); } finally { browser?.process()?.kill('SIGKILL'); process.exit(124); }
  }, Math.max(1, deadline - Date.now()));
  const admit = ms => { if (Date.now() + ms > deadline - 30000) throw Error('Insufficient owner time'); };
  try {
    server = await startStaticServer({root});
    browser = await puppeteer.launch({executablePath: '/usr/bin/google-chrome', headless: true,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader'], protocolTimeout: 5000});
    meta.browser = await browser.version();
    write('browser-endpoint', {wsEndpoint: browser.wsEndpoint(), deadline: meta.deadline});
    page = await browser.newPage();
    await page.setViewport({width: 1100, height: 800});
    page.on('console', m => fs.appendFileSync(path.join(out, 'browser.log'), m.type() + ': ' + m.text() + '\n'));
    page.on('pageerror', e => fs.appendFileSync(path.join(out, 'browser.log'), 'PAGEERROR: ' + e.message + '\n'));
    const loadedModules = [];
    const moduleReads = [];
    page.on('response', response => {
      if (/wine-assembly\.wasm(?:\?|$)/.test(response.url()))
        moduleReads.push(response.buffer().then(bytes => loadedModules.push({url: response.url(), sha256: sha(bytes)}))
          .catch(error => loadedModules.push({url: response.url(), error: String(error)})));
    });
    meta.route = 'http://127.0.0.1:' + server.address().port + '/?debug&perf&app=kkrieger_beta';
    await page.goto(meta.route, {waitUntil: 'domcontentloaded', timeout: 30000});
    const shot = async label => {
      await page.screenshot({path: path.join(out, label + '.png')});
      const state = await page.evaluate(() => {
        const w = window.wineShell?.currentWine, e = w?.instance?.exports;
        const voices = w?.hostCtx?._voices;
        return {at: new Date().toISOString(), pageMs: performance.now(), running: w?.running ?? null,
          worker: !!w?.guestWorker, wasmBytes: w?.memory?.buffer?.byteLength ?? null,
          focus: e?.get_focus_hwnd?.() ?? null, mainHwnd: e?.get_main_hwnd?.() ?? null,
          active: {tag: document.activeElement?.tagName, id: document.activeElement?.id},
          viewport: {width: innerWidth, height: innerHeight}, pointerLock: !!document.pointerLockElement,
          perf: window.WinePerf?.snapshot?.() ?? null, presents: window.__kkriegerGameplayPresents ?? null,
          presentHookActive: !!w?.__kkriegerGameplayHook && w.onGuestFrame === w.__kkriegerGameplayHook,
          audio: {contextState: voices?._ac?.state ?? null, contextTime: voices?._ac?.currentTime ?? null,
            voices: Object.entries(voices?._map || {}).slice(0, 16).map(([id, v]) => ({id,
              rate: v.rate, channels: v.channels, bits: v.bits, ringPtr: v.ringPtr,
              ringLen: v.ringLen, sourcePresent: !!v.currentSrc, workletPresent: !!v.workletNode})),
            scope: 'Read-only host voice metadata; no PCM recording or audibility claim'},
          text: document.body.innerText.slice(-3000)};
      });
      write(label, state); return state;
    };
    const hold = async key => {
      event('keydown', {key}); await page.keyboard.down(key);
      try { await delay(5000); } finally { await page.keyboard.up(key); event('keyup', {key}); }
    };
    let menu = false, level = false, hasStarted = false;
    for (let n = 0; Date.now() < deadline - 30000; n++) {
      const state = await shot('scene-' + n);
      hasStarted ||= !!state.wasmBytes;
      if (hasStarted && state.running === false) { event('guest-stopped'); break; }
      if (!menu && confirmation(out, 'menu', startedAt)) {
        admit(15000); event('menu-visually-confirmed');
        await shot('menu-before-enter'); await hold('Enter'); await shot('menu-after-enter'); menu = true;
      }
      if (menu && confirmation(out, 'level', startedAt)) { level = true; break; }
      await delay(10000);
    }
    if (level) {
      admit(160000); event('level-visually-confirmed');
      // Established onGuestFrame hook from profile-web-frames.js; chain the shell.
      await page.evaluate(() => {
        const w = window.wineShell?.currentWine;
        if (!w?.running) throw Error('Guest no longer running');
        const previous = w.onGuestFrame;
        const records = window.__kkriegerGameplayPresents = {count: 0, dropped: 0, rows: []};
        w.__kkriegerGameplayHook = function (f) {
          records.count++;
          if (records.rows.length < 20000) records.rows.push([performance.now(), f?.kind ?? '?', f?.slot ?? -1]);
          else records.dropped++;
          return previous?.call(this, f);
        };
        w.onGuestFrame = w.__kkriegerGameplayHook;
      });
      // Ordinary positioning before the idle control; retain any effect in evidence.
      await page.mouse.move(550, 400); await delay(3000);
      for (const action of ['idle', 'forward', 'strafe', 'look']) {
        admit(30000); await shot(action + '-before'); event('window-start', {action});
        const t = Date.now();
        if (action === 'forward') await hold('w');
        if (action === 'strafe') await hold('a');
        if (action === 'look') {
          event('mousemove', {from: [550, 400], to: [710, 400], steps: 16});
          await page.mouse.move(710, 400, {steps: 16});
        }
        await delay(Math.max(0, 20000 - (Date.now() - t)));
        event('window-end', {action}); await shot(action + '-after');
      }
      meta.captureSequenceCompleted = true;
    } else meta.captureSequenceCompleted = false;
    await shot('final');
    await Promise.all(moduleReads);
    write('loaded-modules', loadedModules);
    if (!loadedModules.length || loadedModules.some(m => m.sha256 !== moduleHash)) throw Error('Loaded module identity unverified');
  } catch (error) { meta.error = error.stack; throw error; }
  finally {
    if (page) for (const key of ['Enter', 'w', 'a']) await page.keyboard.up(key).catch(() => {});
    if (browser) await browser.close().catch(error => { meta.closeError = String(error); browser.process()?.kill('SIGKILL'); });
    if (server) await closeServer(server);
    try { checkPins(); meta.postflightPins = 'passed'; } catch (error) { meta.postflightPins = String(error); process.exitCode = 1; }
    meta.finishedAt = new Date().toISOString(); write('meta', meta); clearTimeout(watchdog);
  }
}
module.exports = {confirmation};
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
