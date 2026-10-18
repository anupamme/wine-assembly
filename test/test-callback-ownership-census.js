#!/usr/bin/env node
'use strict';
// Source-only mutation tests. No wasm compilation, guest execution or model
// token simulation: these establish inventory enforcement, not jump safety.
const assert = require('assert');
const { scanWat, scanSources, check, checkNonlocalAPIs } = require('../tools/callback-ownership-census');
const source = `(func $entry (export "inject") (global.set $eip (local.get $callback)))`;
const sources = [{ file: 'src/fixture.wat', src: source }];
const entries = scanSources(sources);
const baseline = { version: 1, entries: entries.map(e => ({ ...e, kind: 'callback',
  reason: 'Fixture callback; retained-context ownership pending.', ownership: 'pending' })) };
assert.deepStrictEqual(check(entries, baseline), []);
assert(check(scanSources([{ file: 'src/fixture.wat', src: source.replace('$callback', '$other') }]), baseline)
  .some(e => e.includes('changed producer')), 'target replacement with unchanged count fails');
assert(check(scanSources([...sources, { file: 'src/new.wat', src: '(func $new (global.set $eip (i32.const 1)))' }]), baseline)
  .some(e => e.includes('unknown producer')));
assert(check(scanSources([...sources, { file: 'src/new.wat', src: '(func $reset (global.set $invocation_root (i64.const 0)))' }]), baseline)
  .some(e => e.includes('unknown producer')), 'bare private identity reset is inventoried');
assert(check([], baseline).some(e => e.includes('stale producer')));
assert(check(scanSources([...sources, { file: 'src/new.wat', src: '(func $reset (global.set $crt_callback_depth (i32.const 0)))' }]), baseline)
  .some(e => e.includes('unknown producer')), 'bare retained CRT frame reset is inventoried');
assert(check(scanSources([...sources, { file: 'src/new.wat', src: '(func $reset (global.set $bsearch_depth (i32.const 0)))' }]), baseline)
  .some(e => e.includes('unknown producer')), 'bare retained bsearch frame reset is inventoried');
assert(check(scanSources([...sources, { file: 'src/new.wat', src: '(func $reset (global.set $qsort_depth (i32.const 0)))' }]), baseline)
  .some(e => e.includes('unknown producer')), 'bare retained qsort frame reset is inventoried');
assert(check(entries, { version: 1, entries: [baseline.entries[0], baseline.entries[0]] })
  .some(e => e.includes('duplicate inventory')));
assert(check(entries, { version: 1, entries: [{ ...baseline.entries[0], ownership: 'covered' }] })
  .some(e => e.includes('unsupported ownership assertion')), 'a label cannot assert coverage');

// Parser-based coverage includes nested block comments and strings containing
// fake writes; macros and top-level writes cannot evade the scan.
const syntax = `;; (global.set $eip (i32.const 9))
  (; outer (; (global.set $eip (i32.const 9)) ;) ;)
  (data (i32.const 0) "(global.set $eip)")
  (defmacro (enter) (global.set $eip (i32.const 1)))
  (global.set $eip (i32.const 2))`;
assert.strictEqual(scanWat(syntax, 'src/macros.wat').reduce((n, e) => n + e.writes, 0), 2);
assert.throws(() => scanWat('(func $broken', 'src/broken.wat'));

// A wrapper needs an inventory record even when only its callee writes EIP.
const indirect = scanSources([{ file: 'src/wrapper.wat', src: `${source}
  (func $middle (call $entry))
  (func (export "outer") (return_call $middle))` }]);
assert(indirect.some(e => e.exports.includes('outer') && e.writes === 0));
for (const js of [
  'x.inject(cb)', 'x["inject"](cb)', "x['inject'](cb)",
  'const { inject: enter } = x; enter(cb)',
]) {
  assert(scanSources([...sources, { file: 'lib/callback.js', src: js }])
    .some(e => e.file === 'lib/callback.js'), `known export reference: ${js}`);
}
const host = scanSources([...sources, { file: 'lib/callback.js', src: 'x.inject(cb); restore();' }]);
const hostBaseline = { version: 1, entries: host.map(e => ({ ...e, kind: 'host-entry', reason: 'Fixture', ownership: 'pending' })) };
assert(check(scanSources([...sources, { file: 'lib/callback.js', src: 'restore(); x.inject(cb);' }]), hostBaseline)
  .some(e => e.includes('changed producer')), 'same named calls reordered still fails');

assert.deepStrictEqual(checkNonlocalAPIs([{ file: 'src/crt.wat', src: '(func $handle__setjmp3)' }]), []);
assert(checkNonlocalAPIs([{ file: 'src/crt.wat', src: '(func $handle_longjmp)' }]).length);
assert(checkNonlocalAPIs([], [{ name: '_setjmp', alias: '_setjmp3' }]).length,
  'API alias cannot bypass prerequisite review lock');
assert(checkNonlocalAPIs([], [{ name: 'longjmp' }]).length);
console.log('callback ownership census mutation tests PASS (source inventory only)');
