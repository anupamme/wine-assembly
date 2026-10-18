# D3D9 draw-layout provenance observer

Source-only diagnostic for BW2-DRAW-LAYOUT-PROVENANCE-20261018. It does not
repair a layout, select a producer, or classify the missing October 9 evidence.
No guest/browser run or module/source placement validation has been performed.

`node --test tools/d3d9-layout-observer.test.js` runs only synthetic JS tests.
The production-hook test executes the exact read/validation prefix extracted
from `lib/d3d9-host.js`; it is not a compiled WAT or browser integration test.

## Opt-in placement contract

Load `tools/d3d9-layout-observer.js` explicitly (CommonJS or browser global
`D3D9LayoutObserver`). Nothing imports or installs it by default. Construct one
recorder **per guest Worker**, plus a host recorder. Supply:

- `getMemory(): ArrayBuffer | SharedArrayBuffer`, current linear memory buffer.
- `g2w(guest): number`, the current instance's real sparse-aware translator.
  Do not substitute direct-window arithmetic or return the NULL sentinel as a
  valid mapping. Invalid/unmapped reads must throw; errors are counted.
- `resolveProgram(device): number`, the current guest program pointer. Resolve
  device+4 to its DX slot, validate it against the current DX region size, then
  require `DxObject.type == 20` and read `DxObject.misc1` at relative offset 20.
  DX entries have stride 32. Obtain the region base from the matching generated
  region map, not a copied allocation address. Return 0 for an invalid device.
- `getThread(): {slot, id}`, the actual Worker slot and instance's
  `get_current_thread_id()` value. Host code must obtain the originating thread
  from the active broker request; use null if unavailable, never main-thread ID.
- `identity`: caller-owned source commit, module SHA256, run ID and placement.
  Missing identity stays null; synthetic tests use `synthetic-only`.
- `capacity`: 4..4096 records, default 128.

After all other import overrides, before instantiation, call
`observer.installAPI(imports, apiTable, getExports)` and
`observer.installGPU(imports, 'gpu_gl_call', 'draw-issue', getCorrelation)`.
The API adapter extends the existing `log_i32` COM ordinal marker, `log`, and
`log_api_exit` tracing boundaries, resolving full method names via api_table.
The caller must enable and later restore API logging on **each instance**;
`--quiet-api` may otherwise remove the events. The observer deliberately does
not call `set_api_log` or change guest state. Import wrappers installed after
WASM instantiation cannot retroactively replace its captured functions.

On the consuming host instance, explicitly set the D3D9Host option
`onLayoutRead: values => hostObserver.hostRead(values, getCorrelation())` and
call `hostObserver.installGPU(d3d9Host, 'call', 'host-entry', getCorrelation)`.
Preserve/restore an existing option callback if installing into a live host;
prefer construction-time options and disposing the host with the run. The
hook runs immediately after the two real layout loads and passes their actual
values, program WA and descriptor WA without rereading layout. Its optional
callback is protected separately from production validation. Disabled cost is
one option branch; no object, log or memory snapshot is allocated when absent.

`getCorrelation()` must return a bounded caller-provided broker request ID
shared by issue and host scopes; default null explicitly means **uncorrelated**.
No new RPC field or synchronization is introduced here. A usable live packet
requires the harness to wire that ID and originating-thread context, pin the
module/source, and validate placement under a separate runtime grant. Separate
recorders' sequence numbers are local orders, not a global cross-thread order.

## Retention and interpretation

`observer.snapshot()` returns detached JSON-safe records. API entry/exit pairs
use entry sequence IDs. Captures/Apply resolve the device from block+8; Reset
resolves the program again on exit. Live VS/declaration/FVF and active recording
block mask/declaration/FVF are distinct fields. Descriptor snapshots retain all
16 words at draw issue and host entry. The exact host-read event contains the
values read by validation; its program is a **WASM address**, whereas
`state.program` and `descriptorState.program` are **guest pointers**.

The ring retains only the most recent capacity records, freezing at the first
synchronous draw rejection (-1) or thrown draw exception. A freeze does not
cancel a draw, pause the guest, or modify the exception. It may omit enclosing
API/issue exits after the host rejection. It does not infer that every rejected
draw failed layout validation. An async Promise is returned unchanged and
labelled asynchronous, not interpreted as success or rejection. Layout rejection
in the inspected host occurs synchronously before enqueueing.

Except for the exact consumer values, memory snapshots are non-atomic samples;
a racing guest thread can mutate between individual reads. No snapshot proves
thread exclusion. `host-entry` must never be relabelled `host-read`. The observer
never derives a current observation from old pointer values or missing files.

Selected API argument retention is capped at 16 words. The import adapter's
nesting stack is capped at 64 frames; deeper calls are omitted until unwound.
Aborted/unbalanced API logging invalidates later entry/exit pairing; end that
run and reinstall for a fresh run, rather than treating partial pairs as proof.
Unmapped reads or adapter exceptions increment `observerErrors` and cannot
replace original function results or exceptions. No source logs are emitted.

Always call `observer.dispose()` in harness cleanup. It restores own property
descriptors (or removes inherited-method shadows), unless another owner has
subsequently replaced a wrapper; the returned false then reports the conflict.
Remove/restore the host option callback separately. Save snapshots before
publishing any evidence metadata. This checkpoint has no current B&W2 producer
samples and licenses no renderer fallback or visual-causality claim.
