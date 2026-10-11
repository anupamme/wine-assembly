# Dark Reign 2 demo

Source: [Internet Archive demo](https://archive.org/details/DarkReign2Demo),
`DarkReign2.zip`, 34,477,173 bytes, SHA-1
`0e58ef5409e5ba006e072633083b2354b7e8e1a8`.
The game log identifies build 873, dated August 16, 2000.
Distinct from the registered first Dark Reign game; not yet registered here.

Static extraction uses `7z x DarkReign2.zip`, then
`unshield -d extracted x archive/data1.cab`. The InstallShield set includes
`data1.hdr` and `data2.cab`; keep them beside `data1.cab`. The game's root is
`extracted/Files`, containing `dr2.exe`, Bink/Miles DLLs, and the mission,
world, side and base `.zwp` packs. The installer is not executed.

The bundled licence grants personal use and restricts distribution and
disassembly. Keep this an ignored private compatibility fixture; do not
publish assets. This investigation uses runtime logs/API observations only.

## Initial startup gate

On main `274902b02`, boat `bx_k7xdfrq9`:

```sh
node test/run.js --exe=/home/user/dark-reign2-demo-preflight/extracted/Files/dr2.exe \
  '--vfs-include=**/*' --quiet-api --batch-size=100000 \
  --max-seconds=20 --max-batches=30 \
  --save-vfs=/home/user/dark-reign2-demo-preflight/saved --save-vfs-suffix=.log
```

The final `dr2.log` is more useful than the secondary NULL-call crash after
the error handler exits. It rejects HAL and RGB devices for lacking floating
point transformed vertices; RGB also lacks the DrawPrimitive capability.
It then raises `0xe0000002` with “Can't start hardware accelerated DirectX 7.0.”
No menu or gameplay is reached. Exporting the log at batch 7 is too early;
use the final VFS export above.

The advertised HAL mask `0x8aea0` omits `D3DDEVCAPS_FLOATTLVERTEX` (`0x1`).
HEL mask `0x2a50` also omits `D3DDEVCAPS_DRAWPRIMTLVERTEX` (`0x400`), despite
the existing float-TL DrawPrimitive implementation. The constants are in
[Wine's Direct3D caps header](https://github.com/wine-mirror/wine/blob/master/include/d3dcaps.h).
Descriptor correction adds only those supported capability bits: HAL becomes
`0x8aea1`, HEL `0x2e51`, across legacy enumeration, D3D7 enumeration and device
GetCaps. The extended enumeration regression fails old code and passes the
fix, including nested callbacks and allocation/stack lifetime checks. Full
build, real vertex-buffer rasterization (900 indexed pixels), and the twelve
DrawPrimitive handler-arity checks pass on the temporary boat.

The fixed ordinary launch passes the hardware gate, initializes digital
audio services, finds three missions and logs in the default user. It then
shows a fatal dialog because `GetProcAddress(ws2_32, "WSAConnect")` fails.
This is the next actionable API implementation; no menu/gameplay claim.
The final game log captures the primary error. A Miles worker later exits
through NULL during shutdown; do not mistake that secondary event for the
startup blocker.

Evidence: `scratch/runs/20261011T2102Z-dark-reign2-preflight/`. The title has
no manifest candidate yet, so no result is attached to another game's card.
The first fixture also lacks `test/binaries/dlls/shell32.dll` and
`test/binaries/dlls/msvcrt.dll`; dbghelp reports failed symbol initialization.
The explicit device-rejection log is the current primary lead.

## WSAConnect implemented; event notification is next

The virtual TCP provider now exposes `WSAConnect`, sharing the existing
connection implementation with `connect`. Each entrypoint supplies its own
stack-frame size, so blocking retries preserve all seven WSAConnect arguments.
Successful TCP connections report zero callee-data bytes. Unsupported connection
data and QoS requests return provider errors; reserved group QoS is rejected.
Datagram connect is not implemented by this TCP path and returns an unsupported
operation error. This is not a claim of complete Winsock 2 support.

The old tree fails the name-resolution regression; the fixed full build and
all 50 Winsock checks pass, including TCP establishment, already-connected
errors, provider errors and three consecutive blocking retry stack checks.
Existing fragmented session and async-select tests also pass.

Ordinary replay now resolves WSAConnect and stops at the next missing symbol:
`WSAEnumNetworkEvents` in `ws2_32.dll` (`win32_socket.cpp:1796`). The fatal dialog
and final game log are recorded in
`scratch/runs/20261011T2115Z-dark-reign2-wsaconnect/`. Implement event selection,
latched network-event/error reporting and event reset semantics together;
do not add a silent empty-events stub to get past the lookup. No menu or
gameplay is qualified yet.

## Notification lifetime prerequisite

The event API audit found that `closesocket` freed the socket slot but left
its process-shared WSAAsyncSelect registration behind. A new TCP socket using
that index could post FD_READ to the previous owner's window after a partial
receive. The regression exercises close, slot reuse, a new TCP connection,
send and partial receive: the control posts an unwanted message; the fix
clears the registration before publishing the slot as free. A subsequent new
registration still announces the buffered data correctly. No notification table
is allocated merely to close a socket.

The full build and all 51 Winsock checks pass on boat `bx_k7xdfrq9`.
Evidence: `scratch/runs/20261011T2124Z-winsock-notification-lifetime/`.
This is a general notification-lifetime fix, not the missing event API itself;
Dark Reign 2 remains at the previously reviewed WSAEnumNetworkEvents blocker.

The next implementation must preserve the
[WSAEnumNetworkEvents contract](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsaenumnetworkevents):
copy selected latched events and their error slots, clear the record and reset
the optional event atomically; on failure retain both the record and event.
Keep shared-thread state and notification cancellation/reuse in the tests.

## Process-wide Winsock startup prerequisite

The event-path audit found WSAStartup's reference count in a mutable WASM
global, private to each guest-thread instance. A second instance's WSACleanup
therefore returned WSANOTINITIALISED despite two successful main-thread startups.
The count now lives in a declared shared LOCK_TABLE cell. Startup increments
atomically; cleanup uses compare-and-swap to reject zero without underflow and
only the caller releasing the final reference tears down sockets. The existing
network-pump and blocking-cancel initialization checks read the same shared cell.

A two-instance/shared-memory regression fails on the old source and passes
with the fix: one cleanup preserves a socket, final cleanup closes it, excess
cleanup fails, and startup on the other instance works afterward. All52 Winsock
checks and the full build pass. Memory-map ownership aliases were added for
the new shared cell. Evidence: scratch/runs/20261011T2155Z-winsock-process-startup/.
This is an initialization prerequisite; WSAEnumNetworkEvents/WSAEventSelect and
the event-object entrypoints remain unimplemented, and gameplay is not qualified.

## WSACreateEvent prerequisite

WSACreateEvent now resolves through the append-only API table and delegates to
the common Win32 event provider: unnamed, manual-reset, initially nonsignaled.
It requires process-wide WSAStartup and reports WSANOTINITIALISED (10093) or
WSA_NOT_ENOUGH_MEMORY (8) on creation failure. This follows the
[Microsoft contract](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsacreateevent).

The regression checks real host wait/set/reset behavior, distinct handles,
manual-reset persistence, startup from a sibling instance, failure injection,
and zero-argument stdcall stack cleanup. The old-source control fails API
lookup; the implementation passes all 53 Winsock checks. Evidence:
scratch/runs/20261011T2204Z-winsock-create-event/. This does not yet implement
WSAEventSelect/WSAEnumNetworkEvents or qualify Dark Reign 2 gameplay.

## Event signaling and reset

WSASetEvent/WSAResetEvent use the same host events as WSACreateEvent, preserving
manual-reset behavior and the scheduler wakeup used by Win32 SetEvent. Both
require process startup, return FALSE with WSA_INVALID_HANDLE (6) for invalid
or stale objects, and reject the private high-bit ReleaseMutex tag. The host
fallback and ThreadManager previously returned success for invalid events;
they now reject missing and wrong-type handles. Valid mutex release behavior
through its own API is unchanged. Contracts:
[WSASetEvent](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsasetevent),
[WSAResetEvent](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsaresetevent).

Evidence: scratch/runs/20261011T2212Z-winsock-event-change/. Old controls fail
missing API lookup and invalid-event acceptance. The new Winsock test exercises
startup/error/stack cleanup, manual reset, wrong-type and stale handles; the
ThreadManager regression checks the scheduler provider directly.

Next: WSAEventSelect/WSAEnumNetworkEvents must latch requested socket events and
reset atomically with their recorded errors. Do not hold a WAT spinlock across
a host call: a worker RPC can wait for main while main spins on that lock.
The generic fs_close_handle accepts unknown non-file handles, so event close
needs the typed provider path described below. Dark Reign 2 has not been rerun or qualified from these changes.

## Typed event close

WSACloseEvent now checks process startup and calls a typed close_event host
import rather than the permissive filesystem CloseHandle fallback. Both the
headless provider and ThreadManager verify the live object is an event before
releasing it; unknown, closed, and wrong-type handles fail with
WSA_INVALID_HANDLE (6). Browser and CLI install the same provider operation;
worker import inheritance and generated RPC signatures include it.

Evidence: scratch/runs/20261011T2219Z-winsock-event-close/. Old API lookup and
missing-provider controls fail. The regression covers startup
precondition, one-argument close stack cleanup, successful release, double
close, rejected mutex close, and inability to signal the closed object.
All 55 Winsock checks and the ThreadManager/mutex checks pass. The remaining
Dark Reign 2 blocker is still WSAEnumNetworkEvents/WSAEventSelect, not this
lifecycle prerequisite; no fresh gameplay or screenshot claim.

## Shared event-record transaction prerequisite

The host now owns one socketEventRecords map per process, inherited together
with the event validator and signal/reset callbacks. socket_event operations
are: 0 select (socket index, event, mask), 1 post (index, FD bit, error),
2 enumerate (index, optional reset event, reserved, contiguous output WASM
address), 3 cancel, 4 inherit (child index, parent index), 5 selected mask.
Supported selection bits are READ/WRITE/ACCEPT/CONNECT/CLOSE (0x3b); unsupported
bits fail with WSAEINVAL. Enum validates the 44-byte span and event first, then
resets, copies only nominated error slots, and clears the record in one
synchronous host call. No guest callback or await occurs during that operation.
Errors retain the record and leave the output untouched; NULL event skips reset.

This is a host-side prerequisite, not a newly exposed Winsock API. WAT does
not yet import socket_event, and no real worker RPC or game replay is claimed.
Next wire it through the generated import signature and public EventSelect/Enum
handlers; connect socket destroy, accept inheritance and AsyncSelect cancellation
to it. Audit local TCP close/shutdown notification paths as well as wire events.
Use existing read re-enable flags, preserve nonblocking side effects, and check
actual socket readiness through API tests before an ordinary DR2 replay.

The old control fails because no broker exists. Evidence:
scratch/runs/20261011T2225Z-winsock-event-record/. All 56 Winsock checks, worker
context inheritance, ThreadManager tests and full build pass. The new test
uses two host-import contexts sharing one process record and real event objects:
selection filtering, recorded errors, untouched unreported error slots, invalid
output/event failure preservation, clear/reset, next-event signaling, optional
reset, accept inheritance, cancellation and invalid masks are covered.

## Network event APIs and next ordinary blocker

WSAEventSelect/WSAEnumNetworkEvents now resolve through the append-only API
table and call the process host broker. Selection makes the socket nonblocking,
replaces async-window notification ownership, and reports current readiness.
Enumeration copies the record and optionally resets its event; unreported error
slots remain untouched. Accept inherits selection/nonblocking mode, and close
or AsyncSelect cancels it before socket-slot reuse. READ re-enables through
recv; WRITE re-enables after a would-block send; ACCEPT re-enables on accept.
Local TCP connect/send/close/shutdown paths now report the same events as wire
paths. The host import and its generated RPC signature are included.

All 59 Winsock checks and the full build pass, including real TCP read/write/
reset events across WASM instances, partial reads, write-buffer exhaustion and
recovery, accepted-socket inheritance/initial write, cancellation, and slot reuse.
This is not a real browser-worker concurrency or multiplayer qualification.
Unsupported event masks (outside READ/WRITE/ACCEPT/CONNECT/CLOSE) fail explicitly.

An ordinary CLI replay passes the old WSAEnumNetworkEvents lookup, then stops
at missing **WSAEnumProtocols** in ws2_32.dll, win32_socket.cpp:1799. The reviewed
640x480 error screenshot agrees with dr2.log. No menu or gameplay yet. Replay
uses the version before the final accepted-socket initial-WRITE correction;
the final build and regression logs are separate from that replay build log.
The boat was missing stdole2.tlb; copied the existing local 15,088-byte fixture
to test/binaries/tlbs/stdole2.tlb before the successful replay. shell32.dll is
still absent on the boat, and the runner reports that separately.

Evidence: scratch/runs/20261011T2233Z-dark-reign2-network-events/. Next implement
truthful protocol enumeration for the virtual TCP/UDP provider, then replay;
never return an invented empty protocol list to bypass this check.
