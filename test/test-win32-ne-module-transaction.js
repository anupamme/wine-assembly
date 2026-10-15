'use strict';
// Compile actual invocation/selector/arena/Win16-call32 helpers, never the full
// emulator. Process backing and code-cache invalidation are controlled inputs.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { compileClosure } = require('../tools/watx-closure');
const dir = path.join(__dirname, '../src');
const all = fs.readdirSync(dir).filter(n => n.endsWith('.wat')).map(n => fs.readFileSync(path.join(dir,n),'utf8')).join('\n');
function form(name) {
  const start = all.search(new RegExp('\\(func \\$'+name+'(?=\\s)')); assert(start >= 0, name);
  let depth=0, quoted=false, comment=false;
  for(let i=start;i<all.length;i++) {
    const c=all[i]; if(comment){if(c==='\n')comment=false;continue;}
    if(quoted){if(c==='\\')i++;else if(c==='"')quoted=false;continue;}
    if(c===';'&&all[i+1]===';'){comment=true;continue;} if(c==='"'){quoted=true;continue;}
    if(c==='(')depth++; if(c===')'&&!--depth)return all.slice(start,i+1);
  } throw Error(name);
}
const api = fs.readFileSync(path.join(dir,'09e-win16-api.wat'),'utf8');
const block = api.slice(api.indexOf(';; BEGIN WIN32 NE INVOCATION CONTEXT'),api.indexOf(';; END WIN32 NE INVOCATION CONTEXT'));
const loader = fs.readFileSync(path.join(dir,'08c-ne-loader.wat'),'utf8');
const transactions = loader.slice(loader.indexOf(';; BEGIN WIN32 NE MODULE TRANSACTIONS'),loader.indexOf(';; END WIN32 NE MODULE TRANSACTIONS'));
const helpers = ['win16_dll_path_id_valid','win16_handle_table','win16_dynamic_module_slot','win16_dynamic_module_release',
 'load_ne_dll_sized','win16_dll_staging','win16_dll_rec','win16_dll_loaded','win16_dll_unload','win16_dll_run_ptr','win16_dll_refs_ptr','win16_dll_image_size_ptr','win16_arena_base','win16_task_shared','win16_next_seg_get','win16_next_seg_set',
  'win16_arena_take','win16_arena_give','win16_arena_free_head','win16_alloc_segment','win16_arena_slot_base',
  'win16_gseg_field','win16_gseg_store','win16_gseg_count','win16_seg_set','win16_seg_base','win16_seg_limit',
  'win16_sel_to_index','win16_index_to_sel','win16_seg_is_big','win16_set_sreg','esp_arch',
  'win16_call32_begin','win16_call32_arg','win16_call32_end','win16_call32_waited',
  'lock_owner_id','lock_acquire','lock_release','zero_memory','win16_process_arena_release',
  'sync_depth_enter','sync_depth_leave','thread_spill_can_recycle','win16_push16','th_retf16'];
let code=block+'\n'+transactions+'\n'+helpers.map(form).join('\n');
// The rejection control executes the real loader entry. Every unrelated
// parser/relocator dependency traps if reached, proving rejection precedes it.
for(const n of ['win16_apply_relocs','win16_patch_dll_prologues','memcpy']) {
 const f=form(n);
 const params=[...f.matchAll(/\(param [^)]*\)/g)].map(m=>m[0]).join(' ');
 const result=f.match(/\(result [^)]*\)/)?.[0]||'';
 code+=`\n(func $${n} ${params} ${result} (unreachable))`;
}

code=code.replaceAll('(region.addr $WIN16_PROCESS_ARENA 0)','(i32.const 4096)')
 .replaceAll('(region.addr $WIN16_PROCESS_ARENA 4)','(i32.const 4100)');
const fixture={WIN16_SEG_TABLE:0x20000,WIN16_SEG_TABLE_SIZE:0x20000,WIN16_THUNK_TABLE:0x50000,
 reg_base:0x60000,fpu_base:0x61000,mmx_base:0x62000,xmm_base:0x63000,GUEST_STACK:0x80000,GUEST_STACK_SIZE:65536,
 DLL_LOAD_LOCK:0x1100,current_thread_id:1};
const globalNames=[...new Set([...code.matchAll(/\(global\.(?:get|set) \$([^\s)]+)/g)].map(m=>m[1]))];
const declared=new Set([...code.matchAll(/\(global \$([^\s)]+)/g)].map(m=>m[1]));
const mutable=[];
const globals=globalNames.filter(n=>!declared.has(n)).map(n=>{
 const def=all.match(new RegExp('\\(global \\$'+n+'\\s+(?:\\(mut (i32|i64)\\)|(i32|i64))\\s+\\(([^\\n]+)'));assert(def,n);
 const type=def[1]||def[2],mut=!!def[1];if(mut)mutable.push(n);
 const constant=def[3].match(/^(?:i32|i64)\.const\s+(0x[0-9a-f]+|-?\d+)/i);
 const value=fixture[n]??(constant?Number(constant[1]):0);
 return `(global $${n} ${mut?'(mut '+type+')':type} (${type}.const ${value}))`;
}).join('\n');
const saved=[...block.matchAll(/\(i32.store offset=\d+ \(local.get \$frame\) \(global.get \$([^\s)]+)\)\)/g)].map(m=>m[1]).filter(n=>n!=='sync_msg_depth');
for(const n of 'resume_ip eip_redirected current_thunk_eip d_seg d_addr16 ea_temp eip ip steps code16 cs_big sreg_es sreg_cs sreg_ss sreg_ds sreg_fs16 sreg_gs seg_base_es seg_base_cs seg_base_ss seg_base_ds fs_base gs_base df flag_op flag_a flag_b flag_res saved_cf flag_sign_shift eflags_extra yield_flag yield_reason last_error win16_in_call32 win16_esp_save win16_eip_save fpu_top fpu_cw fpu_sw fpu_tag fpu_raw_tag'.split(' '))assert(saved.includes(n),n);
const probes=mutable.map(n=>`(func (export "set_${n}") (param $v i32) (global.set $${n} (local.get $v)))
(func (export "get_${n}") (result i32) (global.get $${n}))`).join('\n');
const exportedHelpers=helpers.filter(n=>!form(n).includes('(export ')).map(n=>`(export "${n}" (func $${n}))`).join('\n');
const source=`
(import "host" "memory" (memory 1024 1024 shared))
(import "host" "ensure" (func $win16_process_arena_ensure (result i32)))
(import "host" "release" (func $virtual_map_release (param i32) (result i32)))
(import "host" "g2w" (func $g2w (param i32) (result i32)))
(import "host" "write" (func $gs32 (param i32 i32)))
(func $host_log_i32 (param i32) (nop))
(func $dbg_recompute (nop))
(func $win16_dll_path_forget (param i32) (nop))
(export "win16_bridge_module_provisional" (func $win16_bridge_module_provisional))
(export "win16_bridge_module_record" (func $win16_bridge_module_record))
(export "win16_bridge_module_load_allowed" (func $win16_bridge_module_load_allowed))
(func $cs_pop (nop))
(func $gs16 (param $p i32) (param $v i32) (i32.store16 (call $g2w (local.get $p)) (local.get $v)))
(func $gl16 (param $p i32) (result i32) (i32.load16_u (call $g2w (local.get $p))))
(func $win16_dispatch (param $off i32) (param $ret i32)
  (if (i32.ne (local.get $off) (global.get $WIN16_BRIDGE_RETURN)) (then (unreachable)))
  (call $win16_bridge_invoke_return (local.get $ret)))
(func $page_watch_write (param i32 i32) (nop))
(func $process_code_cache_invalidate (param i32 i32) (nop))
${globals}\n${code}\n${probes}\n${exportedHelpers}`;
const compiled=compileClosure({source,vfs:new Map()},{tailCalls:true});assert(compiled.success,compiled.error);
const moduleUnderTest=new WebAssembly.Module(compiled.wasmBinary),memory=new WebAssembly.Memory({initial:1024,maximum:1024,shared:true});
const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer);
const BASE=0x30000000,BACKING=0x100000,shared=BACKING+943*65536+0xf000;
let initialized=false,ensureCalls=0,failEnsure=false,releaseBetween=false;
const translate=guest=>{if(guest>=BASE){assert(initialized,'access to released arena');return BACKING+guest-BASE;}return guest;};
function instance(id) {
 const e=new WebAssembly.Instance(moduleUnderTest,{host:{memory,
 ensure(){ensureCalls++;if(failEnsure)return 0;if(!initialized){bytes.fill(0,BACKING,BACKING+944*65536);view.setUint32(4096,BASE,true);initialized=true;}if(releaseBetween){releaseBetween=false;assert.equal(second.win16_process_arena_release(),1);}return BASE;},
 release(){initialized=false;return 1;},g2w:translate,
 write(guest,value){view.setUint32(translate(guest),value,true);},
 }}).exports;
 e.set_current_thread_id(id);const delta=(id-1)*0x100;
 for(const n of ['reg_base','fpu_base','mmx_base','xmm_base'])e['set_'+n](fixture[n]+delta);
 return e;
}
const first=instance(1),second=instance(2);
const cpu=(e)=>({globals:Object.fromEntries(saved.map(n=>[n,e['get_'+n]()])),files:Object.fromEntries(['reg','fpu','mmx','xmm'].map(n=>{const p=e['get_'+n+'_base']();return[n,Buffer.from(bytes.slice(p,p+(n==='reg'?32:128)))];}))});
function seed(e,value){
 for(let i=0;i<saved.length;i++)e['set_'+saved[i]]((value+i*0x10203)|0);
 e.set_code16(0);e.set_is_win16(0);
 for(const n of ['reg','fpu','mmx','xmm']){const p=e['get_'+n+'_base']();bytes.fill(value&255,p,p+(n==='reg'?32:128));}
 view.setUint32(e.get_reg_base()+16,0x7ff00,true);
}
function name(value) {const b=Buffer.alloc(16);b[0]=value.length;b.write(value,1,'ascii');return[b.readBigUInt64LE(0),b.readBigUInt64LE(8)];}
const one=first.win16_bridge_frame_begin(),two=second.win16_bridge_frame_begin();assert(one&&two);
const claim=(e,n)=>e.win16_bridge_module_claim(...name(n));
assert.equal(first.win16_bridge_module_claim(0n,0n),0);
const id=claim(first,'PMPRO62');assert(id>=13);const rec=first.win16_bridge_module_record(id);
assert.equal(view.getUint32(rec,true),1);assert.equal(view.getUint32(rec+8,true),1);
assert.equal(claim(second,'PMPRO62'),0,'uninitialized module never published to another owner');
assert.equal(second.win16_bridge_module_rollback(id),0,'wrong-owner rollback rejected');
assert.equal(first.win16_bridge_module_load_allowed(id),0,'cannot load without staging lease');
assert.equal(first.win16_bridge_module_stage_begin(id),1);
assert.equal(first.win16_bridge_module_load_allowed(id),1);assert.equal(second.win16_bridge_module_load_allowed(id),0,'reject foreign load before allocation');
const noFrame=instance(3),beforeLoader=Buffer.from(bytes);
assert.equal(noFrame.load_ne_dll_sized(id,1024),0,'actual loader rejects foreign no-frame owner id');
assert.equal(noFrame.load_ne_dll_sized(id+1,1024),0,'actual loader rejects foreign no-frame other id');
assert.equal(second.load_ne_dll_sized(id,1024),0,'actual loader rejects foreign framed instance');
assert.deepEqual(Buffer.from(bytes),beforeLoader,'rejection performs no allocation or memory writes');
noFrame.set_is_win16(1);assert.equal(noFrame.win16_bridge_module_load_allowed(id),1,'pure NE path preserved');
assert.equal(view.getUint32(fixture.DLL_LOAD_LOCK,true),0,'trap-capable staging owns no mutex');
assert.equal(claim(second,'OTHER'),0,'staging lease excludes another owner');assert.equal(second.win16_bridge_frame_begin(),0n);
const allocation=first.win16_arena_take(3);assert(allocation);
first.win16_bridge_module_provisional(id,allocation,3);
assert.equal(view.getUint32(rec+16,true),allocation);assert.equal(view.getUint32(rec+20,true),3);
// Relocation failure before legacy loader publication: reclaim the actual run.
assert.equal(first.win16_bridge_module_rollback(id),1);assert(bytes.subarray(rec,rec+32).every(v=>v===0));
assert.equal(view.getUint32(shared+40,true),0);assert.equal(view.getUint32(shared+44,true),0);
const reused=first.win16_arena_take(3);assert.equal(reused,allocation);first.win16_arena_give(reused,3);
function staged(moduleName) {
 const id=claim(first,moduleName);assert(id>0);assert.equal(first.win16_bridge_module_stage_begin(id),1);
 const start=first.win16_arena_take(3);first.win16_bridge_module_provisional(id,start,3);
 const r=first.win16_dll_rec(id);view.setUint32(r+4,start-1,true);view.setUint32(r+12,2,true);
 view.setUint32(first.win16_dll_run_ptr(id),3,true);assert.equal(first.win16_bridge_module_stage_end(id),1);
 return{id,start,record:first.win16_bridge_module_record(id)};
}
const failed=staged('REJECT');assert.equal(first.win16_bridge_module_publish(failed.id,0),0,'AX zero cannot publish');
assert.equal(claim(second,'REJECT'),0);assert.equal(first.win16_bridge_module_rollback(failed.id),1);
assert.equal(first.win16_dll_loaded(failed.id),0);const recovered=first.win16_arena_take(3);assert.equal(recovered,failed.start);first.win16_arena_give(recovered,3);
const accepted=staged('GOOD');assert.equal(second.win16_bridge_module_publish(accepted.id,1),0);
assert.equal(first.win16_bridge_module_publish(accepted.id,1),1);assert.equal(view.getUint32(accepted.record,true),3);assert.equal(first.win16_bridge_module_load_allowed(accepted.id),0,'cannot replace a ready module');
assert.equal(claim(second,'GOOD'),-accepted.id,'ready lookup acquires reference without another init');
assert.equal(view.getUint32(accepted.record+8,true),2);assert.equal(first.win16_bridge_module_rollback(accepted.id),0,'ready reference cannot be rolled back');
assert.equal(first.win16_bridge_frame_end(one),1);assert.equal(second.win16_bridge_frame_end(two),1);
assert.equal(first.win16_process_arena_release(),1);
console.log('PASS actual NE module transactions: unpublished ownership, mutex-free staging lease, provisional allocation rollback, AX-zero cleanup and ready reference acquisition');
