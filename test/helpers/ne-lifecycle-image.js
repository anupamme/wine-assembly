'use strict';
// Ordinary two-segment NE DLL: LibEntry at 0, VALUE ordinal 2 at 16, WEP
// ordinal 3 at 32. WEP returns with one Pascal WORD removed from the stack.
function neLifecycleImage({result=1, dependencies=[], trapInit=false, trapWep=false}={}) {
  const b=Buffer.alloc(0x400),n=0x80,w=(o,v)=>b.writeUInt16LE(v,o);
  b.write('MZ');b.writeUInt32LE(n,0x3c);b.write('NE',n);
  w(n+4,0x60);w(n+6,13);w(n+12,0x8001);w(n+14,2);w(n+16,16);
  w(n+0x16,1);w(n+0x1c,2);w(n+0x1e,dependencies.length);w(n+0x22,0x40);w(n+0x32,4);
  w(n+0x26,0x70);w(n+0x28,0x90);w(n+0x2a,0xb0);
  w(n+0x40,0x20);w(n+0x42,0x100);w(n+0x46,0x100);
  w(n+0x48,0x30);w(n+0x4a,0x100);w(n+0x4c,1);w(n+0x4e,0x100);
  b.set([3,1,1,0,0,1,16,0,1,32,0,0,0],n+0x60);
  b.set([3,87,69,80,3,0,5,86,65,76,85,69,2,0,0],n+0x70);
  let offset=0;
  for(let i=0;i<dependencies.length;i++) {const name=dependencies[i];w(n+0x90+2*i,offset);b[n+0xb0+offset]=name.length;b.write(name,n+0xb1+offset,'ascii');offset+=name.length+1;}
  if(n+0xb0+offset>0x200)throw new Error('Fixture dependency names too large');
  b.set(trapInit?[0x0f,0x0b]:[0xb8,result&255,result>>>8,0xcb],0x200);
  b.set([0xb8,0x34,0x12,0xcb],0x210);
  b.set(trapWep?[0x0f,0x0b]:[0xb8,1,0,0xca,2,0],0x220);
  return b;
}
module.exports={neLifecycleImage};
