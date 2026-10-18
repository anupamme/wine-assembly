# Retained qsort comparator ownership

2026-10-18 source milestone, based on integrated main c8399aa73. This
instruments qsort only; it does not enable `_setjmp` or `longjmp`.

Each nonempty qsort keeps a private 64-byte frame in the calling thread's
partition of QSORT_CONTEXTS. The frame retains the root, parent invocation,
expected comparator child, expected cdecl return ESP, and algorithm state.
Nested qsort calls use separate frames. Each comparator receives a new child
identity; budget yields preserve that identity until the real CACA002D
continuation validates and removes it. Empty qsort calls create no identity.
The existing invocation stack capacity (63 children) remains the tighter bound.

Continuation validation checks live process/thread/root, retained frame root,
expected ESP, and expected child before popping ownership or modifying guest
arguments/data. Normal completion restores the parent. Comparator traps or
abandoned runs deliberately retain their frame and child: recovery requires
the existing explicit, host-quiescent process/thread lifetime reset. This is
not SEH unwinding. Reset invalidates old frames without clearing their bytes
or immediately zeroing the instance's cached qsort depth; the next nonempty
qsort lazily starts a fresh frame stack under the new root.

This is an emulator lifetime check, not authentication of arbitrary guest
control flow: a guest can deliberately branch to the active continuation
with the matching stack. The retained token prevents completing a different
live invocation or a retired root, not every forged guest RET.

`test/test-qsort-invocation-ownership.js` is authored for the real full-source
WAT compiler and x86 imported-qsort/comparator-RET/CACA002D path. It covers
nested sorts, no-op sort inside a comparator, distinct sequential identities,
budget yields, final array/ESP/root restoration, wrong ESP and stale expected
child rejection with unchanged state, thread/process reset at nonzero frame
depth, and guest comparator trap retention followed by explicit reset.
At this checkpoint it has only passed JavaScript syntax review; it has not
been compiled or run. Controlled direct-continuation probes supplement the
guest path and are not claimed as guest execution themselves.

The census delta is limited to eight reviewed definitions: invocation_ensure,
invocation_sync_enter, handle_qsort, qsort_frame_at, qsort_frame, qsort_probe,
qsort_continue and qsort_finish. The scanner also inventories bare qsort
owner/depth mutations. Every ownership label stays pending. The census is a
conservative source review baseline, not a proof of exhaustive producer coverage.
Deferred bsearch/initterm/atexit, window/media/APC callbacks, JS restoration,
thread concurrency and SEH remain outstanding, as does actual x86 testing of
both eventual nonlocal-jump dispatch modes. The nonlocal API review lock stays.
