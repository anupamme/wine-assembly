# Callback ownership prerequisite: source inventory

2026-10-18. Implementation checkpoints for the CRTDLL nonlocal-jump
prerequisite in `crt-setjmp.md`. The first adds an enforceable source inventory
and mutation tests. The second authors private token state and synchronous
hooks, described below. **Neither implements `_setjmp` or `longjmp`.** The
original Circus Linux failure is unchanged. No build, guest execution or
browser was run on this task branch.

`node tools/callback-ownership-census.js` checks the maintained inventory in
`tools/callback-ownership-census.json`. `tools/build.sh` runs the check after
fragment validation. The initial inventory contains 363 records:

- 420 actual WAT EIP writes, including each target expression, in 254 direct
  producer/boundary records. Comment and data-string matches are excluded.
- Both synchronous depth helpers, pinned independently of their callers.
- 88 exported wrappers that reach a recorded boundary through direct calls or
  tail calls, including exported tests. Recursive call graphs reach a fixed
  point. Their bodies are pinned even when they do not write EIP themselves.
- 19 production JavaScript files containing references to known exported
  boundaries. Entire file hashes make reordered calls and exception/restoration
  changes visible, even if their lexical call counts stay unchanged.

WAT records pin normalized AST bodies, including operand order, exports,
boundary calls and EIP target expressions. Macro and top-level EIP writes are
included. Changing a callback target while keeping the same depth/write count
fails. Adding, deleting, or duplicating a record fails. Changing `pending` to
`covered` also fails: no evidence of ownership coverage exists yet.

The categories are conservative triage, not per-site ownership certification.
In particular, `mixed-dispatch` includes callback entry, completion, yielding,
termination and ordinary redirects. The 64 writes in `win32_dispatch_inner`
remain one body pin with 64 separately recorded target expressions; the CACA
continuations still need individual retained-context lifetime review.

The host scan finds ordinary dot calls, bracket-property strings, destructured
aliases and direct-call exported wrappers. It **does not prove exhaustive JS
coverage**: computed property names, dynamically synthesized code, aliases
without a literal export name in the scanned file, and indirect WAT function
table edges need a separate audit. Production scanning covers root JS and
recursive `lib/`, plus `src/*.wat` and `src/*.watx`; CLI tools/test harnesses
outside those paths are not host coverage. Every unknown/new source boundary
that the scanner does detect is rejected instead of silently accepted.

The gate also holds a temporary prerequisite review lock on adding the two
nonlocal API rows/handlers. This is deliberately **not runtime safety** and
must be removed/replaced as part of the actual ownership implementation with
its conformance tests. It prevents a first-return-only stub or `_setjmp3` alias
from accidentally presenting this inventory as completed jump support.

## Maintaining the inventory

Run the gate after changing a boundary. Inspect the changed function's entire
context lifetime or the changed host file, then update only its corresponding
record. `--dump` emits entries marked `UNREVIEWED`; it is not a bless/record
command. Comments and formatting in WAT do not change its AST digest, while JS
files are deliberately conservatively pinned byte-for-byte. Changes to shared
host imports, API dispatch, or CRT callback functions may require coordination
with other task branches before updating their records.

Source-only validation performed: mutation tests, current-tree census gate,
JavaScript syntax and `git diff --check`. The tests exercise target replacement,
unknown/stale/duplicate entries, false coverage assertions, nested comments,
strings, macro/top-level writes, exported wrapper reachability, bracket and
destructured host calls, reordered host restoration, and nonlocal API aliases.
These tests validate the checker, not emulator execution or invocation safety.

## Remaining implementation acceptance

The token implementation below still requires compiled validation. Instrument
and test all remaining context producers beyond synchronous nested execution:
retained CACA contexts and chained callbacks, JS COM, cross-thread SendMessage,
timer/wave/APC entry and completion, and abort/exception/destruction paths.
Ordinary guest calls and run-budget slices must preserve identity. Returned
callbacks must restore the parent's identity; equal-depth sibling callbacks
must receive different identities. Reject stale process/thread-slot owners,
SEH and unsupported callback state before any mutation. Never recycle IDs on
exhaustion. Depth alone and guest-stack CACA scanning remain insufficient.

Only then implement the saved-buffer registry and real pair, including the
per-call dispatcher disposition that bypasses nonvolatile register restore
only after successful validation. Execute actual x86 through decoded CALL and
direct thunk dispatch, covering nonvolatile registers, exact ESP/EIP, zero to
one and negative return values, multiple buffers, threads, SEH, forged/changed
buffers and no partial mutation on rejection. The broader design remains in
`crt-setjmp.md`; this inventory does not supersede or complete it.

## Private token state and synchronous hooks (authored, not runtime validated)

The delimited `CALLBACK INVOCATION OWNERSHIP` block in `04-cache.wat` now owns
an 8,464-byte allocated private region. A shared unsigned 64-bit CAS allocator
issues nonzero identities without wrap; its all-ones value is terminal. Neither
process reset nor thread-slot reuse clears that allocator. The shared process
epoch and fresh thread root make a retired instance fail validation before its
next token operation. Each of sixteen slots (main plus fifteen workers, matching
the current scheduler) holds a root owner and a 64-entry invocation stack.

PE and standalone NE process loaders establish a new epoch/root; `init_thread`
establishes a fresh root in the existing epoch. A pristine standalone instance
can bootstrap a vacant slot for helper tests; it cannot steal an occupied slot.
The instance captures its epoch, root, and thread ID separately from
`sync_msg_depth`. A synchronous enter allocates a fresh child; leave checks the
expected top identity and restores the parent by popping. The production sync
helper supplies its current child to this pop; retained callback contexts still
need their own explicit expected-token storage in later milestones. A trap does
not silently unwind or clear tokens. Explicit process/thread replacement retires
them. Ordinary run-budget slices never change these identities.

The existing `sync_depth_enter/leave` pair calls these hooks before changing its
depth/spill bookkeeping. This covers that helper family, including its
cross-thread send bracket, but does not certify the producer's earlier argument
pushes or any uninstrumented continuation. Token stack capacity is 63 nested
children; overflow/underflow, wrong-thread access, stale process/slot owners and
token mismatches trap. Process loads and slot reuse retain the existing host
requirement that old execution is quiescent: this patch does not make a loader
or thread reinitialization transaction safe against a concurrently executing
old instance. The allocator itself uses atomic CAS for worker concurrency.

`test-callback-invocation-tokens.js` compiles the actual token block and actual
sync helpers in a tiny shared-memory module. Authored assertions cover nested
and sibling identities, expected-token mismatch, independent depth, multiple
instances, thread-ID mismatch, occupied-slot bootstrap rejection, slot and
same-memory process reuse, aborted child retirement, stack limits, allocator
exhaustion, and copied before/after state on rejection. **This compiled test has
not been run.** Existing NE helper fixtures now include the real token block;
the arena fixture uses a real paired enter instead of fabricating depth for its
final leave. Those compiled regressions also await the build/native grant.

The census now has 374 records. Its reviewed delta is only the ten private
primitive functions, two sync helpers, PE/NE loader hooks, and `init_thread`.
It also detects bare writes to private invocation globals, so a new reset site
cannot disappear from the inventory. The temporary nonlocal API review lock
remains. Deferred CACA, JS COM, timer/wave/APC and all failure paths still need
their explicit ownership implementation and actual guest conformance.

Source-only validation: fragment balance, manifest, region declarations and
owners, regenerated region-map mirror, JS syntax, census mutation tests and
current-source gate, and diff checks. A separate token fragment was avoided
because 127 existing fragments plus `main.watx` already consume the compiler's
128 source-location slots; the token block stays in the existing cache fragment.
