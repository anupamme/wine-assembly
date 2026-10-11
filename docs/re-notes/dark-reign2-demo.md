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
