'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { canonicalNeName, prepareNeSources } = require('../lib/ne-sources');
const { NeLoadError } = require('../lib/ne-load-error');
const { neLifecycleImage } = require('./helpers/ne-lifecycle-image');

for (const name of ['demo', 'DEMO.DLL', 'C:\\Outlaws\\Demo.dll', 'c:/outlaws/demo.DLL'])
  assert.equal(canonicalNeName(name), 'DEMO');
for (const name of ['', 'a\0.dll', 'x.exe', '../', 'abcdefghijklmnop.dll'])
  assert.throws(() => canonicalNeName(name));

const root = neLifecycleImage({importEntry: {module: 'HELPER', symbol: 'VALUE'}});
const helper = neLifecycleImage({dependencies: ['KERNEL']});
const files = new Map([['demo.dll', root], ['helper.dll', helper]]), requests = [];
const prepared = prepareNeSources('C:\\Outlaws\\Demo.dll', (file, full) => {
  requests.push([file, full]); return files.get(file);
});
assert.equal(prepared.name, 'DEMO');
assert.deepEqual([...prepared.sources.keys()], ['DEMO', 'HELPER']);
assert.deepEqual(requests, [['demo.dll', 'C:\\Outlaws\\Demo.dll'], ['helper.dll', 'C:\\Outlaws\\helper.dll']]);
root.fill(0); helper.fill(0);
assert.equal(prepared.sources.get('DEMO')[0], 0x4d, 'source snapshot survives VFS mutation');
assert.equal(prepared.sources.get('HELPER')[0], 0x4d);

assert.throws(() => prepareNeSources('missing', () => null), e => e instanceof NeLoadError && e.guestCode === 2);
assert.throws(() => prepareNeSources('bad', () => new Uint8Array(2)), e => e instanceof NeLoadError && e.guestCode === 11);
assert.throws(() => prepareNeSources('async', () => Promise.resolve(null)), /owned settlement/);
const ioFailure = Error('VFS unavailable');
assert.throws(() => prepareNeSources('io', () => { throw ioFailure; }), e => e === ioFailure);
const missingImport = neLifecycleImage({importEntry: {module: 'HELPER', symbol: 'ABSENT'}});
assert.throws(() => prepareNeSources('demo', file => file === 'demo.dll' ? missingImport : neLifecycleImage()),
  e => e instanceof NeLoadError && e.guestCode === null);
assert.throws(() => prepareNeSources('demo', () => neLifecycleImage({dependencies: ['DEMO']})), /recursive/);
const unsupported = neLifecycleImage(); unsupported.writeUInt16LE(0x400, 0x80 + 0x3e);
assert.throws(() => prepareNeSources('demo', () => unsupported), e => !(e instanceof NeLoadError) && /not implemented/.test(e.message));

// Classic-script consumers share a lexical global scope: loading each file
// separately also catches accidental duplicate top-level declarations.
const browser = vm.createContext({Uint8Array, DataView, Map, Set});
for (const file of ['ne-load-error', 'ne-image', 'ne-invoke', 'ne-lifecycle', 'ne-sources'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../lib', file + '.js'), 'utf8'), browser, {filename: file});
assert.equal(browser.NeSources.canonicalNeName('C:\\DEMO.DLL'), 'DEMO');
assert.equal(typeof browser.NeLifecycle.createNeLifecycle, 'function');
assert.equal(browser.NeSources.prepareNeSources('demo', () => neLifecycleImage()).sources.size, 1);
console.log('PASS NE source closure: VFS paths, immutable copies, typed failures, cycles, unsupported waits and classic scripts');
