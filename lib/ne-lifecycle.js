'use strict';
const {inspectNeDll} = require('./ne-image');
const {invokeNeEntrySync} = require('./ne-invoke');

// Internal synchronous coordinator. Every source byte must already be present;
// fetching, asynchronous guest waits and guest LoadLibrary16/QT are not exposed.
// A failed WEP retains the module, dependencies and termination lease. The owner
// may diagnose it and explicitly retry; ordinary release does not hide failure.
function createNeLifecycle(e, memory, sources, options = {}) {
  const canonical = name => {
    if (typeof name !== 'string') throw new TypeError('NE module name required');
    const value = name.replace(/\.dll$/i, '').toUpperCase();
    if (!/^[A-Z0-9_$-]{1,15}$/.test(value)) throw new Error('Invalid NE module name');
    return value;
  };
  const images = new Map();
  for (const [name, bytes] of sources) {
    const key = canonical(name); if (images.has(key)) throw new Error('Duplicate NE source ' + key);
    images.set(key, inspectNeDll(bytes));
  }
  const packed = name => {const b = new Uint8Array(16),v=new DataView(b.buffer); b[0]=name.length; for(let i=0;i<name.length;i++)b[i+1]=name.charCodeAt(i); return [v.getBigUint64(0,true),v.getBigUint64(8,true)];};
  const checked = (ok, message) => {if (!ok) throw new Error(message);};
  const scope = action => {
    const token = e.win16_bridge_frame_begin(); checked(token, 'Cannot acquire NE lifecycle frame');
    let failure;
    try {checked(e.win16_bridge_scope_begin(token), 'NE lifecycle owner busy'); return action(token);}
    catch (error) {failure = error; throw error;}
    finally {
      try {checked(e.win16_bridge_frame_end(token), 'NE lifecycle frame teardown rejected');}
      catch (error) {if (failure) throw new AggregateError([failure,error], 'NE lifecycle and cleanup failed'); throw error;}
    }
  };
  const preflight = (name, chain = new Set()) => {
    if (chain.has(name)) throw new Error('Unsupported recursive NE dependency ' + name);
    const image = images.get(name); checked(image, 'Missing NE image ' + name);
    chain.add(name);
    for (const dependency of image.dependencies) {
      const dep = canonical(dependency);
      if (dep !== 'KERNEL') preflight(dep, chain);
    }
    chain.delete(name);
    checked(image.bytes.length <= e.win16_app_dll_staging_size(), 'NE image exceeds staging capacity');
    return image;
  };
  const dependencies = mask => {
    checked(mask >= 0, 'Cannot inspect owned NE dependencies');
    return Array.from({length:24},(_,i)=>i+13).filter(id=>mask & (1 << (id-13)));
  };
  const releaseOwned = (id, retry = false) => {
    const result = retry ? (e.win16_bridge_module_release_retry(id) ? 1 : -1) : e.win16_bridge_module_release_begin(id);
    checked(result >= 0, 'NE release rejected for ' + id);
    if (!result) return;
    const deps = dependencies(e.win16_bridge_module_dependencies(id));
    const target = e.win16_bridge_module_termination(id,0), ds = e.win16_bridge_module_termination(id,1);
    // WEP_FREE_DLL is one Pascal WORD, 0. WEP's return value is not a veto.
    // See Wine krnl386.exe16/ne_module.c MODULE_CallWEP and include/winbase.h.
    if (target) invokeNeEntrySync(e,{target,ds,instance:ds||id,heap:0,module:id},{...options,stackWords:[0]});
    // Deliberately not finally: a trapped/cancelled WEP keeps ownership intact.
    checked(e.win16_bridge_module_release_finish(id), 'NE final unload rejected');
    const failures=[];
    for (const dep of deps) {try {releaseOwned(dep);} catch(error) {failures.push(error);}}
    if (failures.length) throw new AggregateError(failures,'NE dependency termination failed');
  };
  const loadOwned = name => {
    const claimed = e.win16_bridge_module_claim(...packed(name)); checked(claimed, 'NE module busy or unavailable: ' + name);
    if (claimed < 0) return -claimed;
    const id = claimed, image = images.get(name), acquired = [];
    try {
      for (const dependency of image.dependencies) {
        const depName = canonical(dependency); if (depName === 'KERNEL') continue;
        const dep = loadOwned(depName); acquired.push(dep);
        checked(e.win16_bridge_module_link(id,dep), 'NE dependency transfer rejected');
      }
      checked(e.win16_bridge_module_stage_begin(id), 'NE staging lease rejected');
      const staging = e.win16_dll_staging(id) >>> 0;
      new Uint8Array(memory.buffer,staging,image.bytes.length).set(image.bytes);
      checked(e.load_ne_dll_sized(id,image.bytes.length), 'NE image staging failed');
      checked(e.win16_bridge_module_stage_end(id), 'NE staging completion rejected');
      const target=e.win16_bridge_module_init(id,0), ds=e.win16_bridge_module_init(id,1), heap=e.win16_bridge_module_init(id,2);
      const result = target ? invokeNeEntrySync(e,{target,ds,instance:ds||id,heap:ds?heap:0,module:id},options) : 1;
      checked(!image.hasInitializer || target, 'NE initializer unavailable');
      checked(result & 0xffff, 'NE initializer returned AX zero');
      checked(e.win16_bridge_module_publish(id,result), 'NE publication rejected');
      return id;
    } catch (error) {
      const failures=[error];
      // Snapshot before rollback destroys the ownership record. The acquired
      // list also includes a ref whose link may have been rejected.
      try {dependencies(e.win16_bridge_module_dependencies(id)); checked(e.win16_bridge_module_rollback(id),'NE rollback rejected');}
      catch(cleanup) {throw new AggregateError([...failures,cleanup], 'NE rollback failed; dependencies retained');}
      for (const dep of acquired.reverse()) {try {releaseOwned(dep);} catch(cleanup) {failures.push(cleanup);}}
      if (failures.length > 1) throw new AggregateError(failures,'NE initialization and dependency cleanup failed');
      throw error;
    }
  };
  const lookupOwned=(id,symbol,token)=>{
      let ordinal=symbol;
      if (typeof symbol === 'string') {
        if (!symbol.length || symbol.length>255 || /[^\x20-\x7e]/.test(symbol)) throw new Error('Invalid NE export name');
        const ptr=Number(token & 0xffffffffn)+1024;
        const name=new Uint8Array(memory.buffer,ptr,symbol.length+1);name[0]=symbol.length;
        for(let i=0;i<symbol.length;i++)name[i+1]=symbol.charCodeAt(i);
        ordinal=e.win16_bridge_module_ordinal(id,ptr);
      }
      if (!Number.isInteger(ordinal) || ordinal<1 || ordinal>65535) return 0;
      return e.win16_bridge_module_entry(id,ordinal)>>>0;
  };
  return {
    load(name) {name=canonical(name);preflight(name);return scope(()=>loadOwned(name));},
    // lookup alone grants no execution lifetime; call resolves and pins the
    // module under one uninterrupted lifecycle scope.
    lookup(id, symbol) {return scope(token=>lookupOwned(id,symbol,token));},
    call(id, symbol, stackWords=[]) {return scope(token=>{
      const target=lookupOwned(id,symbol,token);checked(target,'NE export unavailable');
      const ds=e.win16_bridge_module_data(id);
      return invokeNeEntrySync(e,{target,ds,instance:ds||id,heap:0,module:id},{...options,stackWords});
    });},
    release(id) {return scope(()=>releaseOwned(id));},
    retryTermination(id) {return scope(()=>releaseOwned(id,true));},
  };
}
module.exports = {createNeLifecycle};
