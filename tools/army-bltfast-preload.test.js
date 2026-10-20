'use strict';
// Tests JS preload wiring with a stub instantiate; never compiles/runs WASM.
const assert=require('node:assert/strict'),fs=require('node:fs'),
  os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const output=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'army-preload-fixture-')),'capture.json');
const script=`
const assert=require('node:assert/strict');
const host={memory:{buffer:new ArrayBuffer(4096)},log(){},log_i32(){},log_api_exit(){}};
const originals={...host};
const ex={get_api_calls:()=>0};
const instance={exports:ex};
let called=0;
WebAssembly.instantiate=async function(m,i) {
  assert.equal(i.host,host); assert.notEqual(host.log,originals.log);
  called++; return instance;
};
require('./tools/army-bltfast-observer');
(async()=>{
  assert.equal(await WebAssembly.instantiate({}, {host}),instance);
  assert.equal(called,1);
  await assert.rejects(WebAssembly.instantiate({}, {host}),/one owning instance/);
})().catch(e=>{console.error(e);process.exitCode=1;});
`;
cp.execFileSync(process.execPath,['-e',script],{cwd:path.resolve(__dirname,'..'),
  env:{...process.env,ARMY_BLTFAST_OUTPUT:output,WINE_REGION_MAP:''},timeout:10000});
const report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.accepted,false);assert.equal(report.observer.ownerPinned,true);
assert.deepEqual(report.observer.restored,{log:true,log_i32:true,log_api_exit:true});
// Evidence deliberately retained; no repository/binary cleanup.
console.log('PASS stub instantiate preload ownership, binding, identity, second-owner rejection, exclusive bounded output: '+output);
