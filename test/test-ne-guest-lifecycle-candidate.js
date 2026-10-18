'use strict';
// Explicit prebuilt module only. Main and nested PE callbacks execute actual
// IAT -> GetModuleHandle -> EAT -> native JMP -> NE lifecycle transactions.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createHostImports}=require('../lib/host-imports');
const {serviceLoadLibraryYieldSync,findVfsDllBytes}=require('../lib/process-boot');
const {loadDll,patchDllImports,callDllMain,finishDllInitialization}=require('../lib/dll-loader');
const {neGuestCaller}=require('./helpers/ne-guest-caller');
const {neLifecycleImage}=require('./helpers/ne-lifecycle-image');
const R=require('../lib/region-map.generated');

async function main() {
  assert(process.env.WA_TEST_WASM,'explicit prebuilt module required');
  const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});
  imports.host.memory=memory;
  const raw=(await WebAssembly.instantiate(module,imports)).exports;
  const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),wa=p=>raw.guest_to_wasm(p)>>>0;
  const read=p=>view.getUint32(wa(p),true),write=(p,v)=>view.setUint32(wa(p),v,true);
  let finished=0,events=[],vfs;
  const e={...raw,win16_bridge_module_release_finish(id){finished++;return raw.win16_bridge_module_release_finish(id);}};
  const records=()=>{
    const arena=view.getUint32(R.BASE.WIN16_PROCESS_ARENA,true);
    if(!arena)return [];
    const hidden=wa(arena)+943*65536;
    return Array.from({length:24},(_,i)=>({state:view.getUint32(hidden+0x8c00+i*32,true),refs:view.getUint32(hidden+0x8c08+i*32,true)})).filter(r=>r.state);
  };
  const service=()=>{
    const serial=e.win16_guest_request_token(),op=e.win16_guest_request_field(serial,0);
    const beforeEsp=e.get_esp()>>>0;
    assert(serviceLoadLibraryYieldSync({exports:e,memoryBuffer:memory.buffer,
      findDllSync:(file,full)=>findVfsDllBytes(vfs,file,full),neInvokeOptions:{maxBlocks:10000,sliceBlocks:256}}));
    assert.equal(e.get_esp()>>>0,beforeEsp+(op===3?12:8));
    assert.equal(e.win16_guest_request_settle(serial,99),0,'duplicate settlement rejected');
    events.push({op,records:records()});return true;
  };
  function boot(fixture,source=neLifecycleImage({moduleUsage:true})) {
    e.win16_guest_request_cancel();
    bytes.set(fixture.bytes,e.get_staging());assert.equal(e.load_pe(fixture.bytes.length)>>>0,fixture.entry);
    e.set_eip(fixture.entry);e.set_esp(0x7408000);write(0x7408000,0);
    vfs={files:new Map([['c:\\outlaws\\demo.dll',{data:source}]]),_resolvePath:p=>p.toLowerCase()};
    finished=0;events=[];
  }
  function run() {
    for(let i=0;i<1000;i++) {
      e.run(1000);
      if(e.get_yield_reason()===18)service();
      else assert.equal(e.get_yield_reason(),0,'only lifecycle host requests supported');
      if(!e.get_eip())return;
    }
    throw new Error('PE lifecycle caller exceeded bounded slices');
  }
  const fixture=neGuestCaller();boot(fixture);run();
  assert.equal(e.get_esp()>>>0,0x7408004);
  const handle=read(fixture.result);assert(handle>=32&&handle<=65535);
  assert.equal(read(fixture.result+4),handle);assert(read(fixture.result+8));
  assert.equal(read(fixture.result+8),read(fixture.result+12));assert.equal(read(fixture.result+16),0);
  assert.deepEqual(events.map(x=>x.records[0]?.refs||0),[1,2,2,2,2,1,0]);
  assert.equal(finished,1,'real WEP returned before one final unload');assert.deepEqual(records(),[]);

  // Real DLL image, mapped and imported normally. Its initializer issues the
  // same lifecycle calls while callDllMain holds the PE callback gate.
  const dll=neGuestCaller(e.get_next_dll_addr()>>>0,{dll:true});
  const mapped=loadDll(e,memory.buffer,dll.bytes,'C:\\Outlaws\\CALLER.DLL');
  assert.equal(mapped.loadAddr,dll.entry-0x2000,'fixture preferred placement');
  patchDllImports(e,memory.buffer,[{name:'CALLER.DLL',bytes:dll.bytes}],[mapped]);
  const outcome=callDllMain(e,mapped.loadAddr,mapped.dllMain,null,{requireCompletion:true,strictReturn:true,onLoadLibraryYield:service});
  assert(outcome.completed);finishDllInitialization(e,memory.buffer,mapped,outcome);
  assert.equal(read(dll.result),read(dll.result+4));assert.equal(read(dll.result+8),read(dll.result+12));
  assert.equal(finished,2);assert.deepEqual(records(),[]);

  for(const [name,source,code] of [['missing',null,2],['malformed',new Uint8Array(4),11]]) {
    const f=neGuestCaller(0x400000,{calls:[[35,[0x402840]]]});boot(f,source);
    if(!source)vfs.files.clear();run();assert.equal(read(f.result),code,name);assert.deepEqual(records(),[]);
  }
  const zero=neGuestCaller(0x400000,{calls:[[35,[0x402840]]]});boot(zero,neLifecycleImage({result:0}));
  assert.throws(run,/AX zero/);assert.equal(e.get_yield_reason(),18);assert.deepEqual(records(),[]);
  const trap=neGuestCaller(0x400000,{calls:[[35,[0x402840]]]});boot(trap,neLifecycleImage({trapInit:true}));
  assert.throws(run);assert.equal(e.get_yield_reason(),18,'trap never resumes suspended PE caller');
  assert.deepEqual(records(),[],'initializer failure rolls back');
  e.win16_guest_request_cancel();
  console.log('PASS actual PE imports/EAT lifecycle, duplicate refs, named/ordinal GPA, WEP, nested DllMain and load-failure cleanup');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
