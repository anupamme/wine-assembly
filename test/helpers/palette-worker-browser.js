'use strict';
globalThis.runPaletteWorker=async function(){
  const evidence=globalThis.paletteWorkerEvidence={observations:[],barriers:[],logs:[]};
  const check=(v,s)=>{if(!v)throw Error(s);};
  const eq=(a,b,s)=>check(JSON.stringify(a)===JSON.stringify(b),`${s}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  const until=async(predicate,label)=>{
    const end=performance.now()+10000;
    while(!predicate()){if(performance.now()>end)throw Error('timeout '+label);await new Promise(r=>setTimeout(r,5));}
  };
  check(crossOriginIsolated,'isolated shared memory');
  const module=await WebAssembly.compile(await (await fetch('/palette-worker.wasm')).arrayBuffer());
  const sigs=(await (await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const host={};for(const name of Object.keys(sigs))host[name]=()=>{throw Error('unexpected broker import '+name);};
  for(const name of ['log','log_i32','log_block','log_eip','log_api_exit','dx_trace'])
    host[name]=(...args)=>evidence.logs.push({name,args});
  const broker=GuestRpc.createMainBroker(memory,host,sigs,{onError:(name,error)=>evidence.logs.push({name,error:String(error)})});
  broker.publish({tickMs:0});
  let manager,port,lastStats,holding=false;
  const held=[];
  const link=new GuestWorkerLink({slot:0,module,memory,sigs,broker,workerUrl:'/lib/guest-worker.js',
    sharedRenderWorker:true,d3dimGpu:true,d3dimLazySync:false,log:s=>evidence.logs.push(s),
    createRenderEndpoint:async options=>{
      eq(options,{api:'legacy',backend:'webgl'},'production requested WebGL endpoint');
      manager=new RenderWorker.Manager({module,memory,sigs,imageBase:0x400000,
        workerUrl:'/lib/d3d-render-worker.js',sourceVersion:'palette-worker-fixture'});
      await manager.ready;port=manager.createEndpoint(options);await port.ready;
      port.addEventListener('message',event=>{if(event.data.t==='stats')lastStats=event.data;});
      const post=port.postMessage.bind(port);
      port.postMessage=message=>{
        // Deliberate delay only. Messages, native exports, Encoder shared
        // control, dispatcher and GPU executor are otherwise unmodified.
        if(holding && (message.t==='batch'||held.length))held.push(()=>post(message));
        else post(message);
        if(holding)evidence.barriers.at(-1).messages.push(message.t);
      };
      return port;
    }});
  const raw=(name,...args)=>link.callExport(name,...args);
  let stack;
  const call=async(name,...args)=>{await raw('pa_stack',stack);return (await raw(name,...args))>>>0;};
  const alloc=async n=>{const p=(await raw('pa_alloc',n))>>>0;check(p,'allocation');return p;};
  const write=(p,v)=>raw('guest_write32',p,v);
  const read=async p=>(await raw('guest_read32',p))>>>0;
  try{
    await link.start();await raw('pw_init');stack=await alloc(4096)+2048;
    await raw('pa_seed',await alloc(1024));
    const dd=await raw('pa_ddraw'),desc=await alloc(128),out=await alloc(16),entries=await alloc(1024);
    const surface=async(bpp,caps)=>{
      for(let i=0;i<128;i+=4)await write(desc+i,0);
      for(const [o,v] of [[0,108],[4,0x1007],[8,4],[12,4],[72,32],[76,bpp===8?0x60:0x40],[84,bpp],[104,caps]])await write(desc+o,v);
      if(bpp===32)for(const [o,v] of [[88,0xff0000],[92,0xff00],[96,0xff]])await write(desc+o,v);
      eq(await call('pa_surface',dd,desc,out),0,'CreateSurface');return read(out);
    };
    const texture=await surface(8,0x1000),rt=await surface(32,0x2040);
    eq(await call('pa_device',rt,out),0,'CreateDevice');const device=await read(out);
    const rgb=[64,128,192],packed=a=>rgb[0]|rgb[1]<<8|rgb[2]<<16|a<<24;
    for(let i=0;i<256;i++)await write(entries+4*i,packed(255));
    const palette=async caps=>{eq(await call('pa_palette',dd,caps,entries,out),0,'CreatePalette');return read(out);};
    const alpha=await palette(0x404),alphaSlot=(await raw('pa_entry',alpha))>>>0;
    const palData=(await raw('pa_palette_data',alpha))>>>0;
    await raw('pa_bind',device,0,texture);eq(await call('pa_attach',texture,alpha),0,'attach alpha');
    const texDib=await raw('pw_dib',texture),rtDib=await raw('pw_dib',rt),rtEntry=await raw('pa_entry',rt);
    const texGuest=await raw('pa_w2g',texDib);
    for(let i=0;i<16;i++)await raw('guest_write8',texGuest+i,7);
    const vertices=await alloc(192),fv=new DataView(new ArrayBuffer(4));
    const float=async(p,v)=>{fv.setFloat32(0,v,true);await write(p,fv.getUint32(0,true));};
    for(const [i,[x,y,u,v]] of [[-.5,-.5,0,0],[3.5,-.5,1,0],[-.5,3.5,0,1],[3.5,-.5,1,0],[3.5,3.5,1,1],[-.5,3.5,0,1]].entries()){
      const p=vertices+i*32;for(const [j,n] of [x,y,.5,1].entries())await float(p+j*4,n);
      await write(p+16,0xffffffff);await write(p+20,0);await float(p+24,u);await float(p+28,v);
    }
    for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,1],[19,5],[20,6],[28,0],[41,0]])await raw('pa_rs',device,id,v);
    for(const [id,v] of [[1,2],[2,2],[4,2],[5,2],[13,3],[14,3],[16,1],[17,1]])await raw('pa_tss',device,0,id,v);
    await raw('pa_tss',device,1,1,1);await raw('set_page_watch_audit',0);
    const clear=async()=>eq(await raw('pa_clear',rtEntry,1,0xff000000,1,0,0,4,4,0),1,'real clear');
    const draw=()=>raw('pa_draw',device,4,3,vertices,6);
    const pixel=()=>{const b=new Uint8Array(memory.buffer,rtDib+20,4);return [b[2],b[1],b[0]];};
    const observe=(label,expected)=>{const actual=pixel();eq(actual,expected,label);evidence.observations.push({label,actual});};
    // The production GPU deliberately declines clears until it has drawn on
    // the target. Establish that ownership with a real queued draw and fence.
    await draw();await raw('pw_fence');observe('initial GPU ownership',rgb);
    const barrier=async(label,mutation,expected)=>{
      await clear();const before=new Uint8Array(memory.buffer,palData,1024).slice();
      const ownership=new Uint8Array(memory.buffer,alphaSlot,32).slice();
      const record={label,messages:[]};evidence.barriers.push(record);holding=true;
      await draw();await until(()=>held.length>0,'held draw');
      let settled=false;const result=mutation().then(v=>{settled=true;return v;});
      await until(()=>record.messages.includes('legacy-fence'),'actual producer fence');
      check(!settled,'mutation cannot return before drain');
      eq(Array.from(new Uint8Array(memory.buffer,palData,1024)),Array.from(before),'palette unchanged before drain');
      eq(Array.from(new Uint8Array(memory.buffer,alphaSlot,32)),Array.from(ownership),'ownership unchanged before drain');
      record.blockedBeforeDrain=true;holding=false;for(const send of held.splice(0))send();
      const value=await result;record.value=value;observe(label+' old generation',expected);return value;
    };
    eq(await barrier('caller Release',()=>call('pw_release',alpha),rgb),1,'surface retains reference');
    eq(await raw('pw_refs',alpha),1,'attachment survives Release');
    await write(entries,packed(128));
    eq(await barrier('SetEntries',()=>call('pa_entries',alpha,7,1,entries),rgb),0,'entry update');
    await clear();await draw();await raw('pw_fence');observe('new alpha generation blends',[32,64,96]);
    check(await raw('pw_exhaust')>0,'fill unused slots through actual allocator');
    eq(await barrier('final detach',()=>call('pa_attach',texture,0),[32,64,96]),0,'detach');
    eq(await raw('pw_type',alpha),0,'attachment final release retires palette');
    await clear();await draw();await raw('pw_fence');observe('detached grayscale',[7,7,7]);
    await write(entries+7*4,packed(128));
    const replacement=await palette(4);
    eq((await raw('pa_entry',replacement))>>>0,alphaSlot,'natural retired slot reuse');
    eq(await raw('pw_refs',replacement),1,'new slot ownership');
    eq(await call('pa_attach',texture,replacement),0,'ordinary replacement');
    await clear();await draw();await raw('pw_fence');observe('reused ordinary palette ignores peFlags',rgb);
    eq(await call('pw_release',replacement),1,'replacement attachment ownership');
    eq(await call('pa_attach',texture,0),0,'replacement final detach');
    eq(await raw('pw_type',replacement),0,'replacement retired');
    await until(()=>lastStats?.stats.drawCalls>=7,'all GPU draw stats');evidence.stats=lastStats;
    check(lastStats.stats.drawCalls>=7,'actual GPU draws');
    eq(lastStats.stats.fallbacks,0,'no renderer fallback');
    eq(lastStats.stats.errors,0,'no GPU errors');
    eq(lastStats.stats.dirtyAuditMisses,0,'no watch misses');
    eq(lastStats.stats.textureByteChecks,0,'actual page leases, no byte shadow');
    check(lastStats.stats.pageChecks>0,'watched textures');
    return evidence;
  }finally{holding=false;for(const send of held.splice(0))send();await link.stop();if(manager)await manager.stop();}
};
