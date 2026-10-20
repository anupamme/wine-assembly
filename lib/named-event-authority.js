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
  const server = net.createServer(socket => {
    const refs = new Map();
    let authenticated = false;
    let stopped = false;
    function release(handle) {
      const event = refs.get(handle);
      if (!event) throw fault('EBADHANDLE');
      refs.delete(handle);
      if (--event.refs === 0) events.delete(event.name);
    }
    function cleanup() { for (const handle of refs.keys()) release(handle); }
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
          const { op, name, handle } = request;
          if (op === 'create' || op === 'open') {
            if (typeof name !== 'string' || !name.length || name.includes('\0') || Buffer.byteLength(name) > 1024) throw fault('EINVAL');
            if (op === 'create' && (typeof request.manualReset !== 'boolean' || typeof request.initialState !== 'boolean')) throw fault('EINVAL');
            let event = events.get(name);
            const existed = !!event;
            if (!event && op === 'open') throw fault('ENOENT');
            if (refs.size >= 4096 || (!event && events.size >= 4096)) throw fault('ENOSPC');
            if (!event) {
              event = { name, generation: randomUUID(), manual: request.manualReset, signaled: request.initialState, refs: 0 };
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
            if (op === 'set') { event.signaled = true; value = true; }
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
