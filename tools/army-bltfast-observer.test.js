'use strict';
const assert=require('node:assert/strict');
const {capture,CODE,NAME}=require('./army-bltfast-observer');
function fixture() {
  // Small independent fake host; no guest, module, renderer or build is run.
  const buffer=new ArrayBuffer(32768), d=new DataView(buffer);
  const bytes=new Uint8Array(buffer), put=(p,v)=>d.setUint32(p,v,true);
  let esp=0x1000,eax=0,count=0,eip=0x7500010;
  const ex={get_api_calls:()=>count,get_esp:()=>esp,get_eax:()=>eax,
    get_eip:()=>eip,get_image_base:()=>0x400000,get_yield_reason:()=>0};
  const host={log(){return 17;},log_i32(){},log_api_exit(){return 19;}};
  const regions={BASE:{DX_OBJECTS:0x2000,DX_SURF_FMT:0x3000}};
  const g2w=g=>g>=0x4074f1&&g<0x407506?0x400+g-0x4074f1:g;
  bytes.set(Buffer.from(CODE,'hex'),0x400);
  put(0x800+4,1); const obj=0x2020;
  put(obj,2); put(obj+4,1); put(obj+12,(5<<16)|10);
  put(obj+16,(16<<16)|8); put(obj+20,0x4000);
  put(0x900,1);put(0x904,1);put(0x908,10);put(0x90c,5);
  for(let y=0;y<5;y++)for(let x=0;x<16;x++)bytes[0x4000+y*16+x]=y*20+x;
  const observer=capture({host,regions,g2w,getBuffer:()=>buffer,getExports:()=>ex,
    apis:[{name:NAME,id:1008,nargs:6,convention:'stdcall'}],context:'fixture'});
  observer.arm();
  function enter(stack=0x1000,ret=0x407506) {
    esp=stack;put(esp,ret);
    [0x800,0,0,0x800,0x900,0x10].forEach((v,i)=>put(esp+4+i*4,v));
    count++;host.log_i32(0xc0de0000|1008);
    bytes.set(Buffer.from('<ord>'),0x600);
    assert.equal(host.log(0x600,5),17);
  }
  function exit(stack=0x1000,result=0) { esp=stack+28;eax=result;assert.equal(host.log_api_exit(),19); }
  function copy() { // Immutable coordinate oracle, independent of adapter samples.
    const before=bytes.slice(0x4000,0x4050);
    for(let y=0;y<4;y++)for(let x=0;x<9;x++)bytes[0x4000+y*16+x]=before[(y+1)*16+x+1];
  }
  return {observer,enter,exit,copy,put,bytes,obj,setEip:v=>eip=v};
}
const good=fixture();good.enter();good.copy();good.exit();
let r=good.observer.close();assert(r.accepted);
assert.equal(r.records[0].copyCheck,'sampled-copy-matches');
assert.equal(r.records[0].source.pitch,16);
assert.equal(r.records[0].initialCorruption.status,'unknown');
assert.equal(r.records[0].samples[0].sourcePre,'15161718191a1b1c');
assert.equal(r.records[0].samples[0].destinationPre,'0001020304050607');
assert.equal(r.records[0].samples[0].destinationPost,'15161718191a1b1c');
const missing=fixture();missing.enter();r=missing.observer.close();
assert(!r.accepted);assert.equal(r.records[0].hresult,null);
assert.equal(r.records[0].state,'missing-return');
assert.equal(r.observer.pendingDepth,1);
for(const corrupt of [
  f=>f.put(f.obj+16,(9<<16)|8),
  f=>f.put(0x908,11),
  f=>f.put(f.obj+20,32760),
  f=>f.put(0x804,16384),
  f=>f.bytes[0x400]=0,
]) {
  const f=fixture();corrupt(f);f.enter();f.exit();r=f.observer.close();
  assert(!r.accepted);assert.equal(r.records[0].state,'rejected');
}
const bad=fixture();bad.enter();bad.exit();r=bad.observer.close();
assert(r.accepted);assert.equal(r.records[0].copyCheck,'sampled-copy-mismatch');
const hr=fixture();hr.enter();hr.exit(0x1000,0x80004001);r=hr.observer.close();
assert(r.accepted);assert.equal(r.records[0].hresult,0x80004001);
assert.equal(r.records[0].copyCheck,'not-evaluated-failed-hresult');
const nested=fixture();nested.enter();nested.enter(0x1100);
nested.exit(0x1100);nested.exit();r=nested.observer.close();
assert(!r.accepted);assert(r.records.every(c=>c.state==='rejected'&&c.interleaved));
assert.deepEqual(r.records.map(c=>c.invocation),[1,2]);
const repeated=fixture();
// Non-target calls must not consume the selected-call quota.
for(let i=0;i<30;i++){repeated.enter(0x1000,0x410000);repeated.exit();}
for(let i=0;i<9;i++){repeated.enter();repeated.copy();repeated.exit();}
r=repeated.observer.close();assert(r.accepted);assert.equal(r.records.length,8);
assert.equal(new Set(r.records.map(c=>c.invocation)).size,8);
assert(Buffer.byteLength(JSON.stringify(r))<256*1024);
const redirected=fixture();redirected.enter();redirected.setEip(1234);redirected.exit();
assert(!redirected.observer.close().accepted);
const changed=fixture();changed.enter();changed.put(changed.obj+20,0x4100);changed.exit();
assert(!changed.observer.close().accepted);
console.log('PASS complete/missing return, literal pitched pixels, invalid bounds/pitch/backing/slot/code, failed HRESULT, corruption, nested/repeated/filter/caps, redirect and metadata change');
