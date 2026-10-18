/* Opt-in diagnostic only. No auto-install, logging, guest writes or renderer fallback. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.D3D9LayoutObserver = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const selected = /^(IDirect3DDevice9_(CreateVertexDeclaration|SetVertexDeclaration|SetFVF|BeginStateBlock|EndStateBlock|CreateStateBlock|Reset|SetVertexShader|DrawPrimitive|DrawIndexedPrimitive|DrawPrimitiveUP|DrawIndexedPrimitiveUP)|IDirect3DStateBlock9_(Capture|Apply))$/;
  function create(options) {
    const { getMemory, g2w, resolveProgram, getThread } = options;
    const capacity = options.capacity ?? 128;
    if (!Number.isInteger(capacity) || capacity < 4 || capacity > 4096) throw new RangeError('capacity 4..4096');
    for (const fn of [getMemory, g2w, resolveProgram, getThread]) if (typeof fn !== 'function') throw new TypeError('missing observer adapter');
    const ring = new Array(capacity), restores = [];
    let sequence = 0, count = 0, frozen = false, errors = 0, disposed = false;
    const safe = fn => { try { return fn(); } catch (_) { errors++; return null; } };
    const word = address => {
      if (!Number.isSafeInteger(address) || address < 256) throw new RangeError('unmapped observer address');
      return new DataView(getMemory()).getUint32(address, true);
    };
    const guest = address => word(g2w(address));
    function block(pointer) {
      if (!pointer) return null;
      return { pointer, device: guest(pointer+8), mask: guest(pointer+18936),
        declaration: guest(pointer+18940), fvf: guest(pointer+18944) };
    }
    function state(device) {
      const program = resolveProgram(device) >>> 0;
      if (!program) return { device, program };
      return { device, program, creationThread: guest(program+21780),
        vs: guest(program), declaration: guest(program+8), fvf: guest(program+12),
        recording: block(guest(program+1740)) };
    }
    function append(event) {
      if (frozen || disposed) return null;
      const seq = ++sequence;
      const record = { sequence: seq, thread: safe(getThread), ...event };
      ring[(seq-1)%capacity] = record;
      count = Math.min(count+1, capacity);
      return seq;
    }
    function apiEnter(name, args) {
      if (frozen || disposed || !selected.test(name)) return null;
      return safe(() => {
        const words = Array.from(args).slice(0, 16).map(x => x >>> 0);
        const isBlock = name.startsWith('IDirect3DStateBlock9_');
        const device = isBlock ? guest(words[0]+8) : words[0];
        const token = { name, args: words, device, object: isBlock ? words[0] : 0 };
        token.entry = append({ kind: 'api-enter', ...token, state: state(device), block: block(token.object) });
        return token;
      });
    }
    function apiExit(token, result) {
      if (!token || frozen || disposed) return;
      safe(() => append({ kind: 'api-exit', name: token.name, entry: token.entry,
        result: result >>> 0, state: state(token.device), block: block(token.object) }));
    }
    function draw(kind, address, correlation = null) {
      return safe(() => {
        const words = Array.from({length:16}, (_, i) => word(address+i*4));
        const program = words[1];
        return append({ kind, correlation, address, words,
          descriptorState: { program, declaration: guest(program+8), fvf: guest(program+12), vs: guest(program) },
          state: state(words[0]) });
      });
    }
    function wrap(object, key, before, after) {
      const original = object[key];
      if (typeof original !== 'function') throw new TypeError(`missing ${key}`);
      const own = Object.getOwnPropertyDescriptor(object, key);
      const wrapper = function(...args) {
        const token = frozen || disposed ? null : safe(() => before(args));
        let result;
        try { result = Reflect.apply(original, this, args); }
        catch (error) {
          if (token) safe(() => after(token, undefined, true));
          throw error;
        }
        if (token) safe(() => after(token, result, false));
        return result;
      };
      object[key] = wrapper;
      const restore = () => {
        if (object[key] !== wrapper) return false; // Never clobber a later owner.
        if (own) Object.defineProperty(object, key, own); else delete object[key];
        return true;
      };
      restores.push(restore);
      return restore;
    }
    function installGPU(object, key, boundary, getCorrelation = () => null) {
      if (!['draw-issue','host-entry'].includes(boundary)) throw new Error('invalid GPU boundary');
      return wrap(object, key, args => args[0] === 0x30001 ?
        { entry: draw(boundary, args[1] >>> 0, getCorrelation()), boundary } : null,
      (token, result, threw) => {
        append({ kind: `${boundary}-return`, entry: token.entry, result: typeof result === 'number' ? result : null,
          threw, asynchronous: !!result && typeof result.then === 'function' });
        // Host returns -1 for synchronous rejection. Do not classify its cause.
        if (threw || result === -1) frozen = true;
      });
    }
    function installAPI(imports, apiTable, getExports) {
      const names = new Map(apiTable.map(e => [e.name, e]));
      const stack = []; let ordinal = -1, overflow = 0;
      wrap(imports, 'log_i32', args => {
        const value = args[0] >>> 0;
        ordinal = value >>> 16 === 0xc0de ? value & 0xffff : -1;
        return null;
      }, () => {});
      wrap(imports, 'log', args => {
        const bytes = new Uint8Array(getMemory(), args[0] >>> 0, Math.min(args[1] >>> 0, 256));
        let name = ''; for (const b of bytes) { if (!b) break; name += String.fromCharCode(b); }
        if (name === '<ord>' && ordinal >= 0) name = apiTable[ordinal]?.name;
        ordinal = -1;
        const entry = names.get(name);
        if (!entry) return null;
        if (stack.length >= 64 || overflow) { overflow++; return null; }
        let token = null;
        if (selected.test(name)) {
          const esp = getExports().get_esp() >>> 0;
          token = apiEnter(name, Array.from({length: Math.min(entry.nargs ?? 1,16)}, (_, i) => guest(esp+4+i*4)));
        }
        stack.push(token);
        return null;
      }, () => {});
      wrap(imports, 'log_api_exit', () => {
        if (overflow) { overflow--; return null; }
        apiExit(stack.pop(), getExports().get_eax());
        return null;
      }, () => {});
      // Caller owns set_api_log(1) and its previous value; do not change guest state.
    }
    return { apiEnter, apiExit, installAPI, installGPU,
      // Requires explicit placement beside the actual read; entry wrapper is NOT that read.
      hostRead(values, correlation = null) {
        safe(() => append({kind:'host-read', address: values.address, program: values.program,
          declaration: values.declaration, fvf: values.fvf, correlation}));
      },
      snapshot() {
        const records = [];
        for (let n = sequence-count+1; n <= sequence; n++) records.push(ring[(n-1)%capacity]);
        return JSON.parse(JSON.stringify({ schema: 1, identity: options.identity ?? null,
          capacity, frozen, observerErrors: errors, records }));
      },
      dispose() { disposed = true; return restores.reverse().map(fn => fn()); }
    };
  }
  return { create };
});
