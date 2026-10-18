# Beep output lifetime prerequisite

The single original Mad Bomber diagnostic on canonical `a4ed9f8fa` reached
original msvcr70.dll (base 0x00761000), whose packed import lookup at
0x007b85a9 requested `Beep` in GetProcAddress API 247. It returned zero and
DLL_PROCESS_ATTACH returned FALSE. Evidence remains in
`/home/user/wine-assembly/scratch/runs/20261018-madbomber-rewind-retry/`.
No subsequent game run was performed for this work.

API catalog ID 9 already names Beep, stdcall with two arguments. Its actual
handler in `09a0b-handlers-base-late.wat` calls `crash_unimplemented`.
This is missing behavior, not a misspelled or missing catalog entry.
MessageBeep's existing fire-and-forget oscillator swallows output failures and
cannot stand in for a successful synchronous Beep.

[Microsoft's contract](https://learn.microsoft.com/en-us/windows/win32/api/utilapiset/nf-utilapiset-beep)
requires a synchronous alertable wait and a BOOL/error result. Existing
SleepEx APC completion returns WAIT_IO_COMPLETION early; directly reusing its
epilogue would lose Beep's result and finish before the tone. This checkpoint
therefore leaves Beep's handler and dynamic availability unchanged. It adds
actual bounded host output ownership as the first prerequisite, with no guest
success path until an alertable continuation can preserve completion across
APCs.

## Output contract

Three returning host imports use the existing generic synchronous broker:

- `beep_start(frequency, duration)` returns a positive monotonically increasing
  process token, or negative Win32 error. Accepted frequencies are 37..32767 Hz,
  duration 1..60000 ms; unsupported longer duration returns -50. Zero duration
  or invalid frequency returns -87. This finite-duration limit is explicit
  prerequisite scope, not the full Windows DWORD duration contract.
- `beep_status(token, release)` returns 0 pending, 1 complete or negative error.
  Release consumes only a terminal record; it cannot orphan a pending tone.
- `beep_cancel(token)` aborts a pending tone with -995. Repeated terminal
  observation is stable until released. Unknown/released tokens return -6.

Successful start creates and connects a sine oscillator through its gain and
the existing wave/master output buses, then schedules its stop on the real
AudioContext clock. The context must already be running; unavailable,
suspended or insufficient-sample-rate output returns -50, including ordinary
headless CLI. Graph/start/stop scheduling failures return -31 and disconnect
partial nodes. Recorder presence never changes output availability, return
values or scheduling. No passive recording is presented as successful sound.

The ended event and clock polling both finish the owned record. An early ended
event or a context suspended/closed before observed completion is an abort,
not success. Completion disconnects both tone nodes. Process audio teardown
aborts pending records; terminal records remain until waiters release them.
At most 64 unreleased tokens exist, with -8 on capacity/identifier exhaustion.
IDs never wrap or reuse, so delayed callbacks cannot complete a newer tone.
SharedAudio owns the map; brokered Worker calls operate on the main output.
No guest callback is invoked by these imports or onended; the existing callback
ownership census hash for host-audio was refreshed after this localized review,
without changing its pending classification or nonlocal gate.

## Authored tests and remaining work

`test-beep-output.js` exercises the real audio-host implementation against a
controlled Web Audio boundary: frequency/duration scheduling, graph connection,
clock/event completion, early end, cancellation, stale tokens, bounds/capacity,
shared ownership, teardown, partial graph failure and recorder independence.
`test-beep-output-broker.js` authors real compiled WAT import calls through a
sibling instance and the synchronous broker, with shared token observations.
Both tests passed during root integration on 18 October; the normal gated build
also passed. Syntax, import-signature generation, WAT balance, logical-operand,
silent-stub and ownership-census source checks passed.
The controlled graph is not evidence of audible browser playback or actual
OS Worker scheduling.

Next required work before enabling Beep: owned reentrant guest continuation,
alertable APC dispatch/resumption without early BOOL return, cancellation on
unwind/thread/process exit, preservation of errors and stack ABI, tests of
APCs queued before and during the wait and nested Beep, and dynamic thunk
execution. No new guest-visible Beep success, sound hardware validation,
game retry is claimed by this checkpoint.

## Integration validation

Independent review found no prerequisite blocker. Root normal build produced
`9176e8197f14f73aff9e7ef850e367ccedd51214d29887f0892df07d6340f0cc`;
the real compiled sibling-instance broker test and controlled audio-host test
passed. This proves import transport and tone lifecycle with a controlled audio
boundary, not OS Worker races, audible playback, or complete Beep semantics.
Evidence: `scratch/runs/20261018-beep-prerequisite-integration/` in the integration
worktree. Two disk-guard stops are retained; prior module stayed unchanged and
process groups were subsequently confirmed absent. After narrowing only clean,
remote-verified finished worktrees, build and broker runs completed without guards
and minimum free space was 2,811,142,144 bytes. Prior module remains preserved.
