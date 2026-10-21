#!/usr/bin/env node
'use strict';

// Exercise the real shell through its PE-loading boundary, with host/DOM
// stand-ins. A declined PE deliberately stops before DLL/guest execution.
const assert = require('assert');
const { createBrowserShell } = require('../lib/browser-shell');
const { applyStartupShow } = require('../lib/process-boot');

async function check(label, args, expectedShowCmd) {
  const calls = [], booting = [], startup = [];
  const elements = {
    'app-select': { value: 'fixture' }, screen: { focus() {} }, log: { textContent: '' },
    status: { textContent: '' },
  };
  global.document = {
    getElementById: id => elements[id] || null,
    querySelector: () => null,
  };
  global.window = { browserInput: { wireCanvasInput() {} } };
  global.location = { search: '?debug', href: 'http://localhost/?debug' };
  global.Win98Renderer = class { repaint() {} };
  global.WineAssembly = class {
    hasGuestExport() { return false; }
    primeAudio() {}
    async init() { calls.push('init'); }
    async loadExe(exe, options) {
      calls.push({ exe, options });
      // The same helper host.js calls: omission does not force ShowWindow.
      applyStartupShow({ set_startup_show: cmd => startup.push(cmd) }, options.showCmd);
      return false;
    }
    stop() {}
  };
  const app = { exe: 'fixture.exe', args: '/original',
    win16Modules: ['original.dll'], launchPrefs: { original: true },
    exeGuestPath: 'c:\\fixture.exe' };
  const shell = createBrowserShell({ apps: { fixture: app }, debugMode: true,
    screenCanvasSize: () => ({ w: 640, h: 480 }),
    onAppBootingChange: value => booting.push(value) });
  await shell.launchApp(...args);
  assert.strictEqual(calls.length, 2, `${label}: init then loadExe; ${elements.status.textContent}`);
  assert.strictEqual(calls[0], 'init');
  assert.deepStrictEqual(calls[1], { exe: app.exe, options: {
    showCmd: expectedShowCmd, win16Modules: app.win16Modules,
    launchPrefs: app.launchPrefs, args: '/original', bytes: null,
    guestPath: app.exeGuestPath,
  } }, `${label}: preserve startup arguments and explicit show command`);
  assert.deepStrictEqual(booting, [true, false], `${label}: release boot ticket`);
  assert.deepStrictEqual(startup,
    expectedShowCmd == null || expectedShowCmd === -1 ? [] : [expectedShowCmd],
    `${label}: unchanged startup override semantics`);
  assert.strictEqual(shell.bootsInFlight, 0);
  assert.strictEqual(elements.status.textContent, 'Failed to load',
    `${label}: a declined PE is still a failure`);
  console.log(`PASS ${label}`);
}

(async () => {
  try {
    await check('toolbar with no arguments', [], undefined);
    await check('app key with omitted options', ['fixture'], undefined);
    await check('explicit undefined', ['fixture', undefined], undefined);
    await check('explicit null', ['fixture', null], undefined);
    await check('empty catalog/debug options', ['fixture', {}], undefined);
    for (const showCmd of [null, -1, 0, 1, 3, 5, 7, 11]) {
      const options = Object.freeze({ showCmd, hidden: true });
      await check(`explicit showCmd ${showCmd}`, ['fixture', options], showCmd);
    }
    for (const invalid of [-2, 10, 12, 0.5, NaN]) {
      assert.throws(() => applyStartupShow({ set_startup_show() {
        assert.fail('invalid show command must never reach the guest');
      } }, invalid), RangeError);
    }
    console.log('PASS invalid startup commands still rejected');
  } finally {
    for (const key of ['document', 'window', 'location', 'Win98Renderer', 'WineAssembly']) delete global[key];
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
