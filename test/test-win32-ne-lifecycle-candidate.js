'use strict';
// Explicit prebuilt full-module lifecycle proof. Runs actual NE guest bytes;
// this internal coordinator still exposes no Win32 guest bridge/QT exports.
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const R = require('../lib/region-map.generated');
const { createNeLifecycle } = require('../lib/ne-lifecycle');
const { inspectNeDll } = require('../lib/ne-image');
const { neLifecycleImage } = require('./helpers/ne-lifecycle-image');
const SIZE = 944 * 65536, BASE = 0x400000;
function fixture() {
  const b = Buffer.alloc(0x400), p = 0x80, o = p + 24, s = o + 0xe0;
  b.write('MZ'); b.writeUInt32LE(p, 0x3c); b.writeUInt32LE(0x4550, p);
  b.writeUInt16LE(0x14c, p + 4); b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(0x10e, p + 22); b.writeUInt16LE(0x10b, o); b.writeUInt32LE(0x1000, o + 16);
  b.writeUInt32LE(BASE, o + 28); b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x2000, o + 56); b.writeUInt32LE(0x200, o + 60); b.writeUInt16LE(3, o + 68);
  b.writeUInt32LE(0x100000, o + 72); b.writeUInt32LE(0x1000, o + 76); b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x1000, s + 8); b.writeUInt32LE(0x1000, s + 12);
  b.writeUInt32LE(0x200, s + 16); b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  b[0x200] = 0xc3; return b;
}
async function boot(module, memory, init) {
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  imports.host.memory = memory;
  for (const item of WebAssembly.Module.imports(module)) {
    assert.equal(item.module, 'host');
    if (item.kind === 'function' && !imports.host[item.name])
      imports.host[item.name] = () => { throw Error('Unexpected host import ' + item.name); };
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  if (init) e.init_thread(...init);
  return e;
}
async function main() {
  assert(process.env.WA_TEST_WASM,'explicit prebuilt module required');
  const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),raw=await boot(module,memory),pe=fixture();
  bytes.set(pe,raw.get_staging());assert.equal(raw.load_pe(pe.length),BASE+0x1000);
  raw.set_eip(BASE+0x1000);raw.set_esp(0x7408000);
  const snapshot=()=>({registers:Buffer.from(bytes.slice(R.BASE.REGFILE,R.BASE.REGFILE+32)),
    eip:raw.get_eip(),fs:raw.get_fs_base(),ss:raw.get_sreg_ss(),ds:raw.get_sreg_ds(),cs:raw.get_sreg_cs(),depth:raw.get_sync_msg_depth()});
  const caller=snapshot();let invocations=0,whileRunning;
  const e={...raw,win16_bridge_invoke_begin(...args){invocations++;return raw.win16_bridge_invoke_begin(...args);},
    run(blocks){whileRunning?.();return raw.run(blocks);}};
  const images=new Map([
    ['HELPER',neLifecycleImage()],['PARENT',neLifecycleImage({dependencies:['HELPER']})],
    ['ZERO',neLifecycleImage({result:0,dependencies:['HELPER']})],
    ['TRAP',neLifecycleImage({trapInit:true,dependencies:['HELPER']})],
    ['BADWEP',neLifecycleImage({trapWep:true,dependencies:['HELPER']})],
    ['MISSING',neLifecycleImage({dependencies:['ABSENT']})],
    ['CYCLE',neLifecycleImage({dependencies:['CYCLE']})],
  ]);
  let original;
  if(process.env.WA_NE_ORIGINAL) {
    original=fs.readFileSync(process.env.WA_NE_ORIGINAL);
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'),'7e2b17e61e7e4808a50478ddcac06f65fcf9f3ffd741d747c8cb75e20cb05db9');
    images.set('PMPRO62',original);
  }
  const lifecycle=createNeLifecycle(e,memory,images,{maxBlocks:10000,sliceBlocks:256});
  assert.throws(()=>lifecycle.load('MISSING'),/Missing NE image/);
  assert.throws(()=>lifecycle.load('CYCLE'),/recursive NE dependency/);
  const id=lifecycle.load('parent.dll');assert.equal(invocations,2);
  const arena=view.getUint32(R.BASE.WIN16_PROCESS_ARENA,true),wa=e.guest_to_wasm(arena)>>>0,shared=wa+943*65536+0xf000;
  const clean=()=>{assert.deepEqual(snapshot(),caller);for(const off of [36,40,44])assert.equal(view.getUint32(shared+off,true),0,'frame/depth/lease released');};
  const foreign=await boot(module,memory,[1,e.get_image_base(),e.get_code_start(),e.get_code_end(),e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),0]);
  const foreignLifecycle=createNeLifecycle(foreign,memory,images,{maxBlocks:10000,sliceBlocks:256});
  assert.equal(foreignLifecycle.load('PARENT'),id,'shared ready acquisition');foreignLifecycle.release(id);
  clean();assert.equal(lifecycle.load('PARENT'),id);assert.equal(invocations,2);
  assert(lifecycle.lookup(id,'VALUE'));assert.equal(lifecycle.lookup(id,'WEP'),lifecycle.lookup(id,3));
  assert.equal(lifecycle.lookup(id,'ABSENT'),0);assert.equal(lifecycle.lookup(id,4),0);
  whileRunning=()=>{whileRunning=undefined;assert.throws(()=>foreignLifecycle.load('PARENT'),/lifecycle frame/);lifecycle.release(id);assert.throws(()=>lifecycle.release(id),/release rejected/);};
  assert.equal(lifecycle.call(id,'VALUE'),0x1234,'actual named guest export');clean();
  assert.equal(lifecycle.load('PARENT'),id);const beforeFree=invocations;
  lifecycle.release(id);assert.equal(invocations,beforeFree);
  lifecycle.release(id);assert.equal(invocations,beforeFree+2,'actual parent/dependency WEP');clean();
  assert.equal(lifecycle.lookup(id,2),0);
  for(const name of ['ZERO','TRAP']) {
    let failure;try{lifecycle.load(name);}catch(error){failure=error;}
    assert(failure,'real failed initialization must throw');if(name==='ZERO')assert.match(failure.message,/AX zero/);
    console.log(JSON.stringify({case:name,failure:failure.message}));clean();
    const frame=e.win16_bridge_frame_begin();assert(frame);
    for(let n=13;n<37;n++)assert.equal(view.getUint32(wa+943*65536+0x8c00+(n-13)*32,true),0,'rollback clears all module records');
    assert.equal(e.win16_bridge_frame_end(frame),1);clean();
  }
  const bad=lifecycle.load('BADWEP');let failure;try{lifecycle.release(bad);}catch(error){failure=error;}
  assert(failure);console.log(JSON.stringify({case:'failed-WEP',failure:failure.message}));
  assert.deepEqual(snapshot(),caller);assert.equal(view.getUint32(shared+36,true),0);assert.equal(view.getUint32(shared+44,true),1);
  assert.equal(lifecycle.lookup(bad,'WEP'),0);assert.throws(()=>lifecycle.load('BADWEP'),/busy/);
  // Controlled repair is only for the retry conformance arm, after proving
  // original trap/retained ownership. No production or original image is patched.
  const repair=e.win16_bridge_frame_begin();assert(repair);
  const target=e.win16_bridge_module_termination(bad,0),base=e.win16_seg_base(target>>>19);
  bytes.set([0xb8,1,0,0xca,2,0],e.guest_to_wasm(base+(target&65535))>>>0);
  e.invalidate_code_range(base+(target&65535),6);
  assert.equal(e.win16_bridge_frame_end(repair),1);lifecycle.retryTermination(bad);clean();
  let originalResult=null;
  if(original) {
    const inspected=inspectNeDll(original),moduleId=lifecycle.load('PMPRO62');clean();
    let lookedUp=0;
    for(const [name,ordinal] of inspected.names) {
      const ptr=lifecycle.lookup(moduleId,name);assert(ptr,name);assert.equal(ptr,lifecycle.lookup(moduleId,ordinal),name);lookedUp++;
    }
    assert.equal(lifecycle.load('PMPRO62'),moduleId);lifecycle.release(moduleId);lifecycle.release(moduleId);clean();
    originalResult={sha256:crypto.createHash('sha256').update(original).digest('hex'),lookedUp,loadInitLookupUnload:true};
  }
  assert.equal(e.is_win16(),0);assert.equal(e.get_image_base(),BASE);assert.equal(e.win16_process_arena_release(),1);
  console.log(JSON.stringify({passed:true,actualGuestExecution:true,moduleLifecycle:true,qtThunk:false,original:originalResult}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
