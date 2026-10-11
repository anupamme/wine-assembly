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
