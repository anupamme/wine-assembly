'use strict';

// Node-only synchronous event provider. State lives exclusively in the server
// worker; client workers transport requests while their callers are blocked.
const { Worker, isMainThread, workerData, parentPort } = require('node:worker_threads');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const CAPACITY = 16384;
const MAX_WAITS = 4096; // Pending AND retained terminal results, across sessions.
const SESSION_WAITS = 256;
const MAX_FINITE_MS = 0xfffffffe; // INFINITE (0xffffffff) is not supported.

function fault(code, message = code) { return Object.assign(new Error(message), { code }); }
function finish(buffer, value) {
  const bytes = Buffer.from(JSON.stringify(value));
  const words = new Int32Array(buffer, 0, 2);
  new Uint8Array(buffer, 8).set(bytes);
  Atomics.store(words, 1, bytes.length);
  Atomics.store(words, 0, 1);
  Atomics.notify(words, 0);
}
function receive(buffer, timeoutMs) {
  const words = new Int32Array(buffer, 0, 2);
  if (Atomics.wait(words, 0, 0, timeoutMs) === 'timed-out') {
    throw fault('ETIMEDOUT', 'Authority deadline exceeded; operation outcome unknown; client is unusable');
  }
  const result = JSON.parse(Buffer.from(buffer, 8, Atomics.load(words, 1)).toString());
  if (result.error) throw fault(result.error);
  return result.value;
}
function deadline(value) {
  if (!Number.isInteger(value) || value < 1 || value > 60000) throw fault('EINVAL', 'timeoutMs must be 1..60000');
  return value;
}
function frames(socket, callback) {
  let pending = '';
  socket.setEncoding('utf8');
  socket.on('data', chunk => {
    pending += chunk;
    if (Buffer.byteLength(pending) > CAPACITY) return socket.destroy();
    let end;
    while ((end = pending.indexOf('\n')) !== -1) {
      const line = pending.slice(0, end); pending = pending.slice(end + 1);
      try { callback(JSON.parse(line)); } catch { socket.destroy(); return; }
    }
  });
}

class NamedEventClient {
  constructor(endpoint, { timeoutMs = 3000 } = {}) {
    this.timeoutMs = deadline(timeoutMs);
    this.closed = false;
    this.worker = new Worker(__filename, { workerData: { role: 'client', endpoint } });
    // A dead bridge is surfaced by the bounded synchronous deadline, even if
    // this thread cannot dispatch its error event yet.
    this.worker.on('error', () => {});
    this.worker.unref();
    try { this._call({ op: 'hello' }); }
    catch (error) { this.closed = true; void this.worker.terminate(); throw error; }
  }
  _call(request) {
    if (this.closed) throw fault('ECLOSED');
    const buffer = new SharedArrayBuffer(CAPACITY + 8);
    try {
      this.worker.postMessage({ request, buffer });
      return receive(buffer, this.timeoutMs);
    } catch (error) {
      if (['ETIMEDOUT', 'ECONNECTION'].includes(error.code) || !error.code) {
        this.closed = true;
        void this.worker.terminate();
      }
      throw error;
    }
  }
  create(name, manualReset = false, initialState = false) {
    return this._call({ op: 'create', name, manualReset, initialState });
  }
  open(name) { return this._call({ op: 'open', name }); }
  set(handle) { return this._call({ op: 'set', handle }); }
  reset(handle) { return this._call({ op: 'reset', handle }); }
  acquire(handle) { return this._call({ op: 'acquire', handle }); }
  // Only the authority interprets this clock stamp. Do not substitute a local
  // performance.now()/hrtime epoch. Timeout starts at the stamped observation,
  // so transit after that observation counts, including registration transit.
  waitClock() { return this._call({ op: 'waitClock' }); }
  registerWait(handle, timeoutMs, clock) {
    return this._call({ op: 'registerWait', handle, timeoutMs, clock });
  }
  waitStatus(waitId) { return this._call({ op: 'waitStatus', waitId }); }
  cancelWait(waitId) { return this._call({ op: 'cancelWait', waitId }); }
  forgetWait(waitId) { return this._call({ op: 'forgetWait', waitId }); }
  close(handle) { return this._call({ op: 'close', handle }); }
  shutdown() {
    if (this.closed) return;
    try { this._call({ op: 'shutdown' }); }
    finally { this.closed = true; void this.worker.terminate(); }
  }
}

class NamedEventAuthority {
  constructor({ timeoutMs = 3000 } = {}) {
    deadline(timeoutMs);
    this.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-event-'));
    fs.chmodSync(this.directory, 0o700);
    this.endpoint = Object.freeze({ path: path.join(this.directory, 'socket'), token: randomUUID() });
    const buffer = new SharedArrayBuffer(CAPACITY + 8);
    this.worker = new Worker(__filename, { workerData: { role: 'authority', endpoint: this.endpoint, buffer } });
    this.worker.on('error', () => {});
    this.worker.unref();
    try { receive(buffer, timeoutMs); }
    catch (error) { void this.close(); throw error; }
  }
  // Await before removing an owner's namespace or starting a replacement.
  close() {
    if (!this.closing) this.closing = this.worker.terminate().then(() => {
      fs.rmSync(this.directory, { recursive: true, force: true });
    });
    return this.closing;
  }
}

function serve({ endpoint, buffer }) {
  const events = new Map();
  const epoch = randomUUID();
  const origin = process.hrtime.bigint();
  const now = () => process.hrtime.bigint() - origin;
  const waits = new Set();
  // Terminal results hold no event/reference. Reset never visits these records.
  function settle(wait, state) {
    if (wait.state !== 'pending') return;
    wait.event.waits.delete(wait);
    wait.event = null;
    wait.state = state;
  }
  function expire(tick) {
    for (const wait of waits) {
      if (wait.state === 'pending' && tick >= wait.expires) settle(wait, 'timed-out');
    }
  }
  // Timer latency cannot authorize a late acquisition: every request also
  // expires records at its own serialization point before changing signals.
  setInterval(() => expire(now()), 100).unref();
  const server = net.createServer(socket => {
    const refs = new Map();
    const results = new Map();
    let authenticated = false;
    let stopped = false;
    function release(handle) {
      const event = refs.get(handle);
      if (!event) throw fault('EBADHANDLE');
      for (const wait of results.values()) {
        if (wait.handle === handle) settle(wait, 'cancelled');
      }
      refs.delete(handle);
      if (--event.refs === 0) events.delete(event.name);
    }
    function cleanup() {
      for (const handle of refs.keys()) release(handle);
      for (const wait of results.values()) waits.delete(wait);
      results.clear();
    }
    socket.on('error', () => {});
    socket.on('close', cleanup);
    frames(socket, request => {
      let value;
      try {
        if (!request || typeof request !== 'object') throw fault('EINVAL');
        if (!authenticated) {
          if (request.token !== endpoint.token || request.op !== 'hello') throw fault('EAUTH');
          authenticated = true; value = true;
        } else {
          if (stopped) throw fault('ECLOSED');
          const tick = now();
          expire(tick);
          const { op, name, handle } = request;
          if (op === 'waitClock') {
            value = { epoch, tick: tick.toString() };
          } else if (op === 'waitStatus' || op === 'cancelWait' || op === 'forgetWait') {
            const wait = results.get(request.waitId);
            if (!wait) throw fault('EBADWAIT');
            if (op === 'cancelWait') settle(wait, 'cancelled');
            if (op === 'forgetWait') {
              if (wait.state === 'pending') throw fault('EBUSY');
              results.delete(request.waitId); waits.delete(wait); value = true;
            } else value = { state: wait.state };
          } else if (op === 'create' || op === 'open') {
            if (typeof name !== 'string' || !name.length || name.includes('\0') || Buffer.byteLength(name) > 1024) throw fault('EINVAL');
            if (op === 'create' && (typeof request.manualReset !== 'boolean' || typeof request.initialState !== 'boolean')) throw fault('EINVAL');
            let event = events.get(name);
            const existed = !!event;
            if (!event && op === 'open') throw fault('ENOENT');
            if (refs.size >= 4096 || (!event && events.size >= 4096)) throw fault('ENOSPC');
            if (!event) {
              event = { name, generation: randomUUID(), manual: request.manualReset, signaled: request.initialState, refs: 0, waits: new Set() };
              events.set(name, event);
            }
            const id = randomUUID();
            refs.set(id, event); event.refs++;
            value = { handle: id, generation: event.generation, existed };
          } else if (op === 'shutdown') {
            cleanup(); stopped = true; value = true;
          } else {
            const event = refs.get(handle);
            if (!event) throw fault('EBADHANDLE');
            if (op === 'registerWait') {
              const { timeoutMs, clock } = request;
              if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_FINITE_MS ||
                  !clock || clock.epoch !== epoch || typeof clock.tick !== 'string' ||
                  !/^[0-9]{1,24}$/.test(clock.tick) || BigInt(clock.tick) > tick) throw fault('EINVAL');
              if (results.size >= SESSION_WAITS || waits.size >= MAX_WAITS) throw fault('ENOSPC');
              const waitId = randomUUID();
              const wait = { handle, event, state: 'pending', expires: BigInt(clock.tick) + BigInt(timeoutMs) * 1000000n };
              results.set(waitId, wait); waits.add(wait); event.waits.add(wait);
              if (tick >= wait.expires) settle(wait, 'timed-out');
              else if (event.signaled) {
                if (!event.manual) event.signaled = false;
                settle(wait, 'signaled');
              }
              value = { waitId, generation: event.generation, state: wait.state };
            } else if (op === 'set') {
              event.signaled = true;
              for (const wait of event.waits) {
                settle(wait, 'signaled');
                if (!event.manual) { event.signaled = false; break; }
              }
              value = true;
            }
            else if (op === 'reset') { event.signaled = false; value = true; }
            else if (op === 'acquire') {
              value = event.signaled;
              if (value && !event.manual) event.signaled = false;
            } else if (op === 'close') { release(handle); value = true; }
            else throw fault('EINVAL');
          }
        }
        socket.write(JSON.stringify({ value }) + '\n');
      } catch (error) { socket.write(JSON.stringify({ error: error.code || 'EINVAL' }) + '\n'); }
    });
  });
  server.maxConnections = 128;
  server.once('error', () => finish(buffer, { error: 'ECONNECTION' }));
  server.listen(endpoint.path, () => finish(buffer, { value: true }));
}

function bridge({ endpoint }) {
  let pending;
  let broken = false;
  const socket = net.createConnection(endpoint.path);
  function fail() {
    broken = true;
    if (pending) { finish(pending, { error: 'ECONNECTION' }); pending = null; }
  }
  socket.on('error', fail); socket.on('close', fail);
  frames(socket, response => {
    if (!pending) { socket.destroy(); return; }
    finish(pending, response); pending = null;
  });
  parentPort.on('message', ({ request, buffer }) => {
    if (broken) { finish(buffer, { error: 'ECONNECTION' }); return; }
    if (pending) { finish(buffer, { error: 'EBUSY' }); return; }
    pending = buffer;
    const payload = JSON.stringify({ ...request, token: endpoint.token });
    if (Buffer.byteLength(payload) > CAPACITY - 1) {
      finish(buffer, { error: 'EINVAL' }); pending = null; return;
    }
    socket.write(payload + '\n');
  });
}

if (!isMainThread && workerData?.role === 'authority') serve(workerData);
else if (!isMainThread && workerData?.role === 'client') bridge(workerData);

module.exports = { NamedEventAuthority, NamedEventClient };
