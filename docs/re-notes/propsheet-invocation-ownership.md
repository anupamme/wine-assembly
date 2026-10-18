# Property-page callback invocation ownership

2026-10-18. Source prerequisite for the Circus Linux CRTDLL jump pair; no
jump API is enabled. `propsheet_page_callback` is an explicit example in the
setjmp audit because it restores an interrupted guest context after nested
execution. Its PSPCB_CREATE and PSPCB_RELEASE callers share this runner.

The runner now allocates its child before writing the guest frame and retains
the expected child, root and synchronous depth in invocation-local WAT locals.
Before popping or restoring any caller register it checks those values. A
completed three-argument stdcall must also restore the exact entry ESP. Missing
callbacks still return one without allocating a child. The existing bounded
incomplete-call behavior remains zero with ordinary caller restoration when
the original owner remains current; that behavior is not nonlocal-jump proof.

`test/test-propsheet-invocation-ownership.js` authors real x86 callbacks using
an imported GetTickCount and RET 12. It exercises nested and sibling callbacks,
multiple run slices, missing flag/function, malformed RET, bounded timeout,
guest trap, host exception, leaked child, equal-depth sibling substitution,
changed synchronous depth and process retirement. Capacity and ID exhaustion
assert unchanged registers, stack bytes and private ownership state. The test
exposes the actual internal runner, reduces only its run budget, and supports
both normal and `--no-tail-calls` compilation. It does not exercise the entire
property-sheet UI or actual OS Worker scheduling.

Source validation: changed fragment parser, census (396 records, one reviewed
record changed), census mutation tests, JS syntax and diff whitespace checks
passed. **The new guest test has not run and no build was performed.** Run both
dispatch variants under the root's exclusive runtime grant, followed by normal
build and existing property-sheet, synchronous-window, token and lifecycle
regressions before integration. Sparse dependencies must be restored by exact
closure with the usual 2 GiB floor; no binaries are part of this commit.

Traps retain the child until explicit host-quiescent reset. Concurrent process
or slot replacement is not made safe. Other synchronous runners, retained
CACA families, cross-thread send, JS COM, timer/wave/APC paths, SEH, saved-buffer
validation and the dispatcher nonlocal restore exception remain separate
prerequisites. The inventory continues to mark all ownership pending.
