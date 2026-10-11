# MDK2 demo (BioWare/Interplay, 2000)

**Status: registered (`mdk2_demo`), playable in the browser.** Projective
vertices work since 9be0a0efb. Menu, New Game, the intro and the tutorial
level all render and take input (Chromium, real WebGL), but the world is
often black from a guest NaN (see Black world). The "attract demo ignores
input" puzzle was only the menu's idle timer (see Menu). The fetch
needs a real `unshield` (IS6 cabs; `tools/is5-extract.js` refuses them).

## Source

archive.org `Mdk2Demo`: `MDK2Demo.exe`, 86,442,069 bytes, SHA-1
`981cd1f0774c6dae690cdf97bf08d975a43f8e81`. No licence or redistribution
grant (readmeEN.txt names BioWare Corp. and Interplay registration only), so
local-only.

It is an InstallShield 6 self-extractor: 7z unpacks `data1.cab`/`data2.cab`;
**unshield** reads them (`tools/is5-extract.js` refuses: cab version
0x100600c). The game is file group `Minimum` (MDK2.exe launcher,
mdk2Main.exe, `data\base.zip`/`scripts.zip`/`sounds.zip`, Music\*.acm) plus
group `english` (`data\local.zip`, the string tables). Installed to
`c:\mdk2demo`.

## Startup

- **`MDK2.exe` is only the hardware launcher** (a comctl32 property sheet;
  needs the real comctl32/oleaut32 in `test/binaries/dlls`). *Play MDK2*
  writes `save\config.lua` and spawns `mdk2main.exe`. Without that file
  mdk2Main.exe stops with "ERROR: Missing file. Please make sure the game is
  being run from the install directory." (it loads `config`, then
  `defaultconfig`, as Lua from `save\ scripts\ override\ override\english\
  data\` and the zips; `0x41fbc0`, error helper `0x4522e0`).
- The launcher's defaults (Default OpenGL Driver, 640x480x16, bilinear,
  mipmap, full screen) write exactly these 88 bytes, captured from a CLI run:
  `chSetVideoMode(640, 480, 16, 16, 60, 1, 1, 0.8, 0, 1, 0, 0)\r\n`
  `chSndForceSoftwareMode(1)\r\n` (note `1`, not `0`).
- Through the launcher the spawned child sits in the same wait as below; run
  mdk2Main.exe directly with that config installed (as shogo_demo does).

## OpenGL init (what was fixed)

`0x4526e0` suspends the worker thread (`SuspendThread([0x4b8810])`, the
`_beginthread(0x451f30)` file-request worker), sets the video mode and
resumes it at `0x4534a3`. If GL init fails, the error path loads strings
through that **suspended** worker and both threads idle in `SleepEx` forever
(main polls `[0x4b87d0]` at `0x4522b0`/`0x4522d0`) — no window, no message.
GL init failed for two reasons, both fixed:

1. `ReBaseImage` (imagehlp) had no api_table row: it rebases the GL driver
   file below 0x64500000 before LoadLibrary and ignores the result. A missing
   image is now FALSE/ERROR_FILE_NOT_FOUND (`test-rebaseimage.js`).
2. Its GL loader resolves every name with GetProcAddress and gives up on a
   NULL: `wglDescribeLayerPlane`, `wgl{Get,Set}LayerPaletteEntries`,
   `wglRealizeLayerPalette` (now answered from the pixel format: no layer
   planes) and `wglUseFont{Bitmaps,Outlines}A` (fail-fast rows)
   (`test-wgl-layer-planes.js`).

It then creates its context (ChangeDisplaySettingsA, wglCreateContext,
wglMakeCurrent) and draws. `glVertex4f`/`glVertex4fv` with w = 1.0 are now
exactly glVertex3f/3fv (11,890 calls in one run).

Projective vertices (fixed 9be0a0efb): the level draws through ~3.5M
glVertex4f and ~380K glVertex4fv per run, many with w ≠ 1 (call site
`0x464ffb`). The packed vertex now carries w and both rasterizers divide
by clip w.


## Input

- Keyboard is a DirectInput device (c_dfDIKeyboard, cooperative level 6,
  `Acquire` + 256-byte `GetDeviceState` every frame); the mouse is a
  DirectInput relative device (16-byte state). The CLI needs both the WM and
  the DI form of every action (`keydown`+`di-keydown`,
  `mousedown`+`di-mousedown:1`); the browser feeds both by itself.
- A key must be held across a poll: Playwright `keyboard.press` (down+up in
  one turn) is sometimes dropped at the difficulty prompt; hold 200-400 ms.
- Menu cursor: DI relative motion, ~0.47-0.61 guest px per host px. The
  Options dialogs follow the mouse, not the arrow keys; in the CLI use
  `relmousemove:DX:DY:4` (negative deltas work).
- **Default bindings**, read from the game's own Options (tower icon) ->
  Controls -> Customize screen (CLI frame:
  `scratch/runs/20261011T1745Z-mdk2_demo-controls-screen-w5/customize-bindings.png`):

  | Action | Key |
  |---|---|
  | move forward / backward | Num 8 / Num 2 (arrow keys also work in play) |
  | turn left / right | Z / X |
  | strafe left / right | Num 4 / Num 6 (Left/Right arrows strafe too) |
  | look up / down | Num 7 / Num 1 |
  | jump | Mouse B2 (right button) |
  | shoot / combine | Mouse B1 (left button) |
  | quick save / load | F6 / F7 |

  Further pages: Kurt / Max / Dr. Hawkins Controls, Default Keys 1/2. Space
  toggles Kurt's sniper mode (seen in play). The touch layout maps the arrow
  pad, Fire = MOUSE1, Jump = MOUSE2, Sniper = Space, Enter, Esc.

## Menu and the "attract demo"

Startup runs the Lua scripts `mdk2` and `menu` (`0x41fbc0`;
`0x4426a0(name)` calls a Lua function). The copyright/logo screen *is* the
menu's entry: with no input, the idle timer `[0x4b657c]` runs "playdemo"
(`0x402378`; `-test` on the command line does too), the "Demo"-labelled
level that looped in every early run. Click the logo screen before it fires
(~25 s in the browser) and the main menu appears. Icons: gamepad = New Game,
tower = Options (Video/Audio/Controls/Game), monitor, floppy, red X = quit.

## Route (browser, Chromium, desktop 1280x900, Threads on)

t~12 s click the logo -> menu; Enter -> Select Difficulty (Medium
highlighted; one Up = Easy); Enter -> LOADING comic (~t24-160 if not
skipped). Esc every 10 s from t40 to t110 skips the comic, the title card
"The Jim Dandy, Earth Orbit 8:59AM" and the in-engine cutscenes; one more Esc
pauses (Enter on Paused = Continue). Timing drifts run to run: a lost
difficulty Enter leaves the Esc presses backing out to the quit prompt. When
the route reaches play lit (2 of ~6 runs), Kurt stands on the tutorial pad by
t~114: "Use your directional keys..." -> "Use the mouse to look..." -> "stand
by the arrow... face the exit". Unskipped, the Jim Dandy cutscene is still
running at t260. Evidence:
`scratch/runs/20261011T1715Z-mdk2_demo-browser-gameplay-w5`.

## Black world (NaN camera)

The world sometimes renders black with the HUD and Doc's prompts drawn: in
the CLI tutorial, in the browser after most Esc-skip routes (always when the
skips run into the "Aboard the Alien Minecrawler" card), and in WebKit
software GL. It is **a guest NaN, not a renderer fault**: `--trace-gl` on a
black frame shows the 3D pass's sprite quads arriving with `xyz=NaN` and no
level geometry submitted at all (a NaN camera fails every visibility test),
while the ortho HUD is finite; identical under WebGL and the WAT rasterizer.

Where the NaN comes from (CLI route, boat bx_td2jejvz, 2026-10-11; evidence
`scratch/runs/20261011T2000Z-mdk2_demo-nan-source-w5`):

- It is **file data**: the ARGB colour **0xffc9a893** at offset 0x154 of
  `data\base.zip:Ricochet.mod` (the bullet-ricochet particle model; the
  record named `RICOCHET_EMIT` starts at 0xe0). The worker thread T1 (the
  `_beginthread(0x451f30)` file worker) copies the decompressed bytes into a
  heap buffer with `rep movsd` at `0x457765`.
- The archives are PKWARE DCL "implode" (zip method 10, flags 0), which the
  game explodes itself. A JS port of zlib's `contrib/blast`
  (`scratch/wip/mdk2-dcl-explode-zipblast-w5.js`) explodes all 856 entries
  of base/local/scripts.zip with 0 failures, and `Ricochet.mod` holds the
  same bytes the emulator produced: **the guest's decompression is correct.**
- The colour becomes a float in the node-array init at
  `0x45eefe..0x45ef74`: for `count = word header[+8]` (7 here) channels it
  copies `src[edi+8]` raw into each 40-byte node's weight `+0x14`
  (`src = [ebp+8]`, 32-byte records; `+0x10` -> node `+8`, `+0xc` ->
  node `+0x1c`). For Ricochet.mod `src` is file offset **0x14c**, equal to
  header word `+0xe`, so record 0's weight is the colour. The bytes at 0x14c
  do not look like channel records; the dword offset table at file `+0x20`
  (0xe0, 0x180, 0x280, 0xbe0, ...) looks like where records really start.
- The first NaN x87 load is on the main thread (tid 1), `fld [ecx+0x14]`
  of such a node (run head `0x45f97a`). From there it reaches the camera.
- Ruled out: plain FADD/FSUB/FMUL/FDIV making it (trace-only "NaN made"
  check, `scratch/wip/fpu-nan-made-trace-w5.patch`, 0 hits); the uop tier
  and x87 island predecode (both off: still NaN); SSE/3DNow (CPUID exposes no
  extended leaves, SSE off) and MMX (0 retired); a corrupted constant
  (`[0x48c228]` stays 0.0).
- Still open: is 0x14c really the channel-array offset the game intends?
  Find the instruction that writes `[ebp+8]` and check its arithmetic
  against the header (16-bit offset field, sign/zero extension, base). If our
  execution matches Windows, the NaN is the game's own and the difference is
  elsewhere (what Windows does with a NaN weight).
- The frame meter at `0x401f28` divides 1000 by an unset frame delta once at
  startup (ZE, inf in a 32-slot ring). Real hardware does the same.
- Tooling gotchas: `--trace-at` halts each batch at its first hit, so those
  runs fall behind and never reach the NaN frame. Plain `--watch` (chaining
  off) shifts allocation addresses, and neither watch mode sees a value that
  is written and read inside one fall-through chain (no desk trip): log the
  load's address instead (boat-only `ldtrace.js`/`ldtid.js` in the
  evidence folder) and scan memory for the bits (`scanhook.js`).
  `$current_thread_id` is 1 on the main thread.

## Open

- Find the writer of the channel-array pointer `[ebp+8]` used by the node
  init at `0x45eefe` and check whether 0x14c (Ricochet.mod) is the offset the
  game means (see Black world).
- Jump: the binding is the game's own (Mouse B2) and the button is mapped;
  not yet seen in lit play, because the reliable route now lands in the black
  world.
- Playwright WebKit on Linux has no WebGL on a Worker's OffscreenCanvas
  (control: `getContext` returns null there, a main-thread canvas works), so
  the GL render worker cannot create a context and the game area stays gray.
  Real iOS Safari 17+ has worker WebGL; the WebKit touch pass used
  `?gl-renderer=software`.
