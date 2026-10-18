# Synchronous window invocation retention

2026-10-18 source milestone; authored dynamic fixtures have NOT RUN.
No `_setjmp` or `longjmp` API is enabled.

Inventory selected `wnd_send_message_inner` in `09c3a-dialog-runtime.wat`:
Win32 x86 window procedures use a nested bounded run and CACA0005; native
controls and dialog/default routing can recursively reach this helper; Win16
and idle host-shadow guest procedures are queued instead. Missing windows and
native immediate completions do not allocate a guest child. The separately
exported `thread_send_begin/end` uses CACA0005 across Worker slices and is NOT
covered by this change. Generic call_func/JS COM, SEH, Win16, and the other
sync_depth users also remain outside this slice. No single function named
`call_guest` exists in the inspected WAT source.

Before this change, the helper built its guest stack before child allocation
and blindly left whichever invocation was current after the bounded run.
A nested callback still live at timeout could therefore be popped in place
of the window procedure's child. Now allocation precedes guest-frame mutation;
the WAT call retains its expected child, root and synchronous depth in locals.
Completion validates those identities and, for EIP=0, the exact stdcall return
ESP before restoring caller state or calling sync_depth_leave. The current
identity accessor validates process epoch and thread partition as well.
Nested sends each retain independent locals. Wrong identity/root/depth/ESP
traps with ownership live, requiring explicit host-quiescent recovery.

Ordinary timeout with the correct child retains the existing incomplete-send
result and abandonment behavior. It does not make asynchronous operations
resumable, and does not establish nonlocal-jump safety. A trapping guest or
host import similarly cannot be resumed by calling the abandoned WAT stack;
thread reset must retire its synchronous depth/spill state as well as its
invocation identity. CACA0005 is a shared sentinel, not authentication of
arbitrary guest branches. The entry's existing paint-scratch/native routing
side effects are not claimed to be transactionally rolled back on exhaustion.

`test/test-sync-window-ownership.js` authors real x86 wndprocs, imported
GetTickCount, ordinary RET 16 and malformed RET 12. Host callbacks observe
nested/sibling child identity and parent restoration; separately labeled
fault injections create a live extra child, same-depth replacement, root
retirement, wrong depth and a throwing import. It checks traps, missing
windows, timeout, stack restoration, capacity and ID-exhaustion failure
atomicity. Only the nested run's slice budget is reduced to 10 in this fixture
to exercise bounded multi-slice/timeout paths; production caps/logic remain.
This is not simultaneous Worker coverage or actual Circus gameplay evidence.

Source validation: complete tracked-source ownership census and nonlocal API
gate PASS; only wnd_send_message_inner's census fingerprint/calls changed,
with ownership still pending. Parser, JS syntax and diff checks PASS. Both
compiled dispatch modes, normal gated build and existing parent/child paint,
window positioning, CRT and invocation regressions await independent review
and a serial runtime grant. Remaining broader jump blockers remain documented
in crt-setjmp.md and the CRT ownership notes.
