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

## Relative mouse menu route (2026-10-11)

Recoil registration/refcount fix integrated on main ed013f819. Browser
run1927Z confirms delivered pointer358,106 and HWND10001; held click/Enter
do not advance. Main-menu polling calls DirectInput GetDeviceState16 bytes
at return0x46690c (buffer0x564230), not an absolute Win32 cursor.
Relative movement and held button work: run1931Z reaches name/difficulty.
Read-only cursor data at0x564258/0x56425c shows (357,109) before a move
and (460,479) after (82,313); game sensitivity scales motion and clamps.
Button byte0x56423c is0x80 while held. No input emulator change was needed.

Verified CLI sequence (batch-size default1000; source9c7cbf823):
120:click:168:289,130:click:323:326,160:click:25:31,170:click:38:52,
20000:relmousemove:30:-134:10,24000:relmousemove:0:36:10,
26000:di-mousedown:1,27000:di-mouseup:1,
62000:relmousemove:66:255:10,64000:di-mousedown:1,65000:di-mouseup:1.
At180000 batches reviewed run20261011T1934Z-recoil-level-route shows the
3D opening: tank on a truck beside the water. This is not yet gameplay.
Longer650000-batch run finished at19:36:14Z with no reported crash; its
450000/520000 captures and held-Up460000..510000 require separate review.
Browser ordinary gameplay, FPS, audio and mobile remain unverified.

Player control verified in CLI run20261011T1938Z-recoil-turn-check: the
450000-batch baseline exactly matches the forward-run before PNG; holding
Left460000..500000 visibly rotates tank/view left and moves the obstacle to
the right edge, with minimap orientation changing. Reviewed before/after
gameplay captures are published. Browser/mobile/FPS/audio remain unverified.

## Browser relative input (2026-10-11)

The registry opts into relativeMouse because Recoil menus and aiming consume
DirectInput relative motion. The existing browser pointer-lock path supplies
unbounded mouse deltas. No renderer or emulator core change is needed.

Reviewed run20261011T1954Z-recoil-pointer-files on Chrome152 with Threads
and cross-origin isolation reaches New Game, name/difficulty, mission screen,
then gameplay HUD. Ordinary Puppeteer mouse motion and held clicks drive
those menus; read-only guest cursor feedback guides the test. No guest state
is patched. The initial Left hold overlaps the cutscene transition, so this
run alone does not establish browser player steering.

The fork omitted prepared candidate files and native COMCTL32. Restore real
files under test/binaries/candidates/recoil-demo/game; the emulator server
rejects symlinks outside the checkout. Regenerate the browser manifest with
the existing candidate preparation tool. The earlier files-unavailable
runs1947Z/1951Z/1953Z are fixture failures, not pointer-lock regressions.

Existing touch-controls and local-proprietary-demo-dropdown tests pass.
The touch test needed its original packages/freeware/blobby-volley/settings.dat
fixture restored on the fork. Mobile behavior, FPS and audibility are unknown.

Browser player control verified in run20261011T1956Z-recoil-browser-turn.
Wait100 seconds after Start so the opening finishes, then hold ArrowLeft
for2.5 seconds: the tank/view turns left, the wreck shifts to the right edge
and the minimap rotates. Both frames show gameplay HUD and enemies.
Chrome152.0.7977.42, Threads and cross-origin isolation enabled; WASM
a2eca9be09f0f966f019e61fa02fd0aafef61008517c155a33e78de9a8495eeb.
This qualifies browser steering, not mobile controls, FPS or audibility.

## Phone route follow-up

Touch-enabled Chrome at844x390 renders the pad and Fire/Alt fire/Map/Menu
controls (reviewed run20261011T2007Z-recoil-phone-start). Switching a live
desktop session into touch emulation did not instantiate the controls;
run2004Z is a harness limitation, not evidence of a broken phone launch.

Touch-only run20261011T2009Z-recoil-phone-menu remains in the native graphics
selector: a200ms touch at307,214 selects software, but the same held tap
at421,240 on OK does not close it. Later menu taps consequently test nothing.
Capture filenames describe intended checkpoints; reviewed contents show
the selector still open. Next trace native-dialog touch/button dispatch,
including hit coordinates and down/up pairing. No root cause yet; phone
gameplay/steering/FPS/audio remain unverified. The desktop route is unaffected.
