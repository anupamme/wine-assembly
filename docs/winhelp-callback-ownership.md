# WinHelp macro callback ownership

`help_macro_call_routine` now acquires its synchronous invocation before the
first guest stack/register/EIP write and retains its child token, root token,
and depth in locals. Both ordinary completion and the existing 64-slice
timeout validate all three before retiring the child or restoring the caller.
A mismatch traps without popping another invocation or restoring stale context;
process reset owns recovery.

Reverse argument pushes, the return thunk, million-step slices, register
restoration, argument cleanup, and the existing accepted timeout behavior are
unchanged. No CRT jump enablement or invocation-core changes are included.

Run `node test/test-winhelp-callback-ownership.js`. It parses the actual source
with the repository parser and executes the complete successful guest-call
block with modeled sync/run boundaries. Cases cover capacity before writes,
entry failure, last available slot, zero/one/sixteen arguments, slices and
siblings, valid nesting and nested timeout, child/root/depth/high-bit mismatch,
run traps, and the 64-round timeout. Four mutation controls remove individual
guards or move acquisition late; each must fail a behavioral assertion.
The fetched pre-fix source must fail the capacity-before-write assertion.

This is source-only conformance, not a compiled-module, real x86 ABI, guest,
browser, or fullVM qualification. Parsing/heap preparation, invocation-core
implementation, thread epochs, spill/SEH behavior, and trap recovery remain
outside the modeled boundaries.

Base: `7b15136870328d66a8517b9673efad3fd0941294`. RichEdit `3c01665c`
and main's dialog fix `a5a0267d6` were reconciled as analogues, not modified.
Self-contained snapshot, baseline, logs and replay recipe:
`scratch/runs/20261020-winhelp-callback-ownership/`.
