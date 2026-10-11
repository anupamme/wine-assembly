# Recoil demo

Source: <https://archive.org/details/RecoilDemo>, original `RECOIL.zip`.
Archive metadata declares 30,351,332 bytes and SHA-1
`ac0f23a00dc9e132d7abd21ab07934b0ef0adbc4`.
No title was present in apps, the candidate manifest, tasks or the board
when the source lane was claimed on 2026-10-11.

The ZIP central directory contains the HTML instruction manual in `DOCS/`
and `recoil.exe` (29,250,305 uncompressed bytes). The extraction below is verified; gameplay is not. Keep the title local-only
unless its distribution terms are established. Do not answer installation
approval dialogs automatically.

## Controls from the included manual

- Arrows: move forward/back and turn left/right.
- Mouse movement: aim; left button fires the pulse gun, right fires the
  selected advanced weapon.
- C: center turret; Backspace: center chassis; B: lock/unlock turret.
- V: first/third-person view; G: overhead view; M: map; Esc: menu.
- R/O: mission review/objective; F1–F4: vehicle mode when available.

These are documented bindings, not observed emulator input responses.
Any eventual touch layout should use the actual bindings and be tested
against player-controlled gameplay.

## Preflight

Remote box `bx_y3exnm39`, source `aa7838d8c`, full build passed. The archive
download endpoint returned HTTP 500; direct mirror whole-file and 4-MiB
range downloads timed out. Resumable 256-KiB ranges completed and the full
archive matches the declared SHA-1. The WinZip wrapper contains an
InstallShield5 cabinet; `tools/is5-extract.js` extracts 107 files, 76,007,851
bytes, including `RecoilDemo.exe`, native MFC/CRT DLLs and `zbd/` data.
Local `test/binaries/candidates/recoil-demo` is absent by design because
the persistent box has less than 2 GiB free. Native fallback files
`test/binaries/dlls/ole32.dll`, `test/binaries/dlls/shell32.dll`, and
`test/binaries/tlbs/stdole2.tlb` are absent on the tested remote box.

## Current startup result

The original executable SHA-256 is
`82632b1b46153014af0caf1e0c9dfdebbb0d8482ba65b2735064f10972afa076`.
Tested WASM SHA-256 is
`7c5968c791e2310e16fd14bf1b4eca43e4ff758b35c55ad354b0f895666a3361`.

CLI startup renders the splash and a graphics selector. Ordinary clicks
at (168,289) select software, then (323,326) accepts that graphics setting.
Game at (25,31), Start at (38,52) reaches "Failed to initalize video device".
The accelerated choice reaches the same message. Neither is gameplay.
Runs: `20261011T1853Z-recoil-startup`, `1854Z-recoil-software`,
`1855Z-recoil-menu`, `1856Z-recoil-start-game`, `1859Z-recoil-hardware`.
Short run names retain the same date prefix.

The API trace narrows the software route: DirectDraw2 SetDisplayMode requests
640x480x16; primary CreateSurface succeeds (EAX=0 at return0x49be20,
output0x08140048). Surface3 QueryInterface succeeds with output0x08219020.
The original surface is released; the game then tears down the new interface
and restores the display, without another traced surface setup call. Do not
mislabel this as CreateSurface failure or change its successful return.
Next identify the post-QueryInterface/Release failure condition using the
existing API/return tracing. No renderer fix or root cause is established.

Candidate preparation and the existing touch-controls and proprietary
dropdown tests pass. The touch layout is based on the manual, not a tested
mobile play session. Registration remains local-only; FPS/audio unverified.

## Browser launch comparison

Run `20261011T1903Z-recoil-browser-dlls` uses Chrome 152.0.7977.42,
Threads and the lazy candidate manifest. Explicit preload of the bundled
MFC42/MSVCRT/MSVCP50/MSVCIRT fixes the earlier generic-CRT lookup traps
(run `20261011T1901Z-recoil-browser`). The reviewed screenshot still shows
"This program requires the file COMCTL32.DLL, which was not found on this system."
This is earlier than the CLI graphics selector/video error; subsequent scripted
clicks did not reach a menu and do not qualify as input or gameplay evidence.

Source inspection explains the lookup difference: browser-shell.js advertises
all dll-registry.js DLL_PATHS as available, including COMCTL32, without testing
file presence. host-imports.js has_dll_file therefore returns true; the worker
LoadLibrary path fetches the missing native image and returns zero. The CLI
instead reaches the existing static-system COMCTL32 handle 0x5d110002.
The tested boat lacks `test/binaries/dlls/comctl32.dll`; the bundled Recoil
archive does not supply it. Next distinguish incomplete fixture provisioning
from desired fallback semantics with a matched browser/CLI fixture. Do not
add a silent success stub or claim the CLI video error is fixed.

Final registration checks: remote test-touch-controls.js and
test-local-proprietary-demo-dropdown.js both pass at 19:08:49Z.

## Video-init cause and surface-interface fix

The COMCTL32 browser failure was test-box provisioning: restoring the native
DLL alone still404s without the normal binaries -> test/binaries symlink.
With both restored, reviewed run20261011T1914Z-recoil-native-alias reaches the
same video error as CLI. COMCTL32 is no longer missing on bx_y3exnm39.

The guest helper at0x49be10 creates a surface, queries Surface3, then releases
the original interface without resetting EAX. Its caller0x49c0ee treats any
nonzero result as failure. The breakpoint at0x49be45 proves EAX=1, not a
CreateSurface or QueryInterface failure (run20261011T1916Z-recoil-release-return).

Surface3 now uses the existing DX auxiliary-interface reference accounting.
AddRef/Release return that interface's count, while the total still controls
teardown, implicit attachments, fences, clipper references and pixel storage.
The original interface can reach zero while Surface3 retains the live surface.
This follows the separate ref1/ref3 behavior in Wine's reference implementation:
https://github.com/wine-mirror/wine/blob/master/dlls/ddraw/surface.c
(see ddraw_surface1_Release and ddraw_surface3_Release).

Extended complex-surface regression tests the QI/AddRef/Release sequence and
final storage refund. Old code fails (3 instead of2); fixed passes. Final
scoped patch full build and complex-release, Surface3 descriptor, clipper, and
surface-fence regressions pass on the boat. An initial broader prototype
reaches the rendered New Game menu (run20261011T1918Z-recoil-surface-fixed);
that capture is not gameplay and predates the final Surface3-only scope.
Final-patch New Game validation continues separately.

Final patch validation: run20261011T1920Z-recoil-newgame (CLI) and
run20261011T1921Z-recoil-browser-fixed (Chrome152, Threads) both render
the main menu without Video Error. Run20261011T1922Z-recoil-browser-newgame
holds a click at the visible New Game center (page380,340) for150ms;
WM_LBUTTONDOWN/UP reach HWND10001 but the menu does not advance.
Next inspect fullscreen client-coordinate conversion and the game polling
path. No gameplay/FPS/audio/mobile qualification.
