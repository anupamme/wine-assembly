#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const {audioContext}=require('./test-beep-output');
const RPC=require('../lib/guest-rpc');
const {sigs}=require('../lib/host-import-sigs.generated.json');
(async()=>{
 const extraWat=`
 (func (export "tone_start") (param i32 i32) (result i32) (call $host_beep_start (local.get 0) (local.get 1) (i32.const 1) (i32.const 2) (i32.const 0)))
 (func (export "tone_status") (param i32 i32) (result i32) (call $host_beep_status (local.get 0) (local.get 1)))
 (func (export "tone_cancel") (param i32) (result i32) (call $host_beep_cancel (local.get 0)))`;
 const h=await bootRenderHarness({extraWat,fonts:'none'}),ac=audioContext();
 h.hostCtx._voices._ensureCtx=()=>ac;
 h.host.beep_process_begin(1,0);h.host.beep_thread_begin(1,2,0,1,0);
 const broker=RPC.createMainBroker(h.memory,h.host,sigs,{});
 const remote=RPC.createWorkerImports(h.memory,sigs,msg=>broker.serveRpc(msg.slot),{slot:3});
 const host={...h.host};for(const n of ['beep_start','beep_status','beep_cancel'])host[n]=remote.imports.host[n];
 const e=new WebAssembly.Instance(h.module,{host,gdi:h.gdi}).exports;
 const id=e.tone_start(750,100);assert(id>0);assert.equal(ac.nodes.length,1);
 assert.equal(h.exports.tone_status(id,1),0);assert.equal(e.tone_status(id,0),0);
 ac.currentTime+=0.1;assert.equal(e.tone_status(id,1),1);assert.equal(h.exports.tone_status(id,0),-6);
 const cancelled=e.tone_start(800,200);assert.equal(e.tone_cancel(cancelled),-995);
 assert.equal(h.exports.tone_status(cancelled,1),-995);
 ac.state='suspended';assert.equal(e.tone_start(800,200),-50);
 assert(remote.stats.sync>=6,'all three returning imports use synchronous broker');
 h.hostCtx.stopAudio();
 console.log('Beep real WAT imports and synchronous sibling broker: PASS (no OS Worker/audio hardware claim)');
})().catch(e=>{console.error(e);process.exitCode=1;});
