
## Internal alertable continuation checkpoint

The next source slice adds `$beep_begin`, `$beep_continue`, `$beep_finish` and
an explicit owning-thread `beep_cleanup`, plus private thunk marker CACA0040.
Qsort/bsearch retain their existing markers; no new public API/catalog entry
or Beep handler success is enabled. Each active call allocates a 32-byte record
containing its predecessor, original ESP/return address, output token, saved
last-error and a unique invocation token. Nested waits are stacked rather than
sharing global scalar callback state. Resume validates both invocation ownership
and the retained caller frame before observing output or changing guest state.

Queued APCs drain to the private continuation, with the original stdcall frame
still intact. Thus the existing APC machinery's WAIT_IO_COMPLETION/EAX never
becomes the caller's Beep result. The continuation rechecks output after APCs
return; if pending it parks for one millisecond with the existing alertable
sleep hook armed. The scheduler's early APC wake resumes the same continuation.
Only the real output status completes the call; repeated slices with a frozen
audio clock remain pending. Completion restores saved last-error on success,
sets the actual error on failure, leaves the invocation and releases the record.
Synchronous nested host-message contexts reject before starting output because
they cannot service parked slices. Explicit owning-thread cleanup cancels and
consumes every token and unwinds these records in LIFO order.

`test-beep-continuation.js` is authored, not run. It includes actual x86 APC
callbacks queued before and during a wait, callback EAX clobbering, frozen-clock
resumption, BOOL/ESP/error preservation, cancellation, unavailable/suspended
output, invalid frequency and explicit cleanup. For a nested *guest* Beep call
inside the APC, the test compiles one exact, asserted test-only replacement of
the still-disabled public handler with a call to the internal helper. This
exercises guest CALL/RET and nested ownership without claiming the production
export is enabled. Actual dynamic lookup of the production API remains an
explicit future requirement.

The source census adds exactly four pending-classified continuation producers
and refreshes the dispatcher fingerprint for the single CACA0040 case. No
baseline gate was opened. JS syntax, fragment balance, boolean operands,
handler ESP, silent-stub, source census and whitespace checks pass. No build or
runtime validation was performed during this slice.

Remaining blockers before public Beep: forced thread termination must cancel
host output even when its Worker instance is no longer callable; retired and
abandoned callback frames must release ownership/heap records safely; process
teardown must cover all instances. The explicit cleanup export is not yet
wired to those paths. Nonlocal-unwind support is still disabled repository-wide.
Tests must also establish production dynamic resolution, genuine scheduler
alertable wake behavior, Worker teardown, and audible browser output. The
bounded output prerequisites do not yet constitute an enabled Beep API.
