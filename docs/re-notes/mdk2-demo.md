# MDK2 demo (BioWare/Interplay, 2000)

**Status: renders, not registered yet — no player route.** Projective
vertices work since 9be0a0efb, and the level draws (sniper zoom and third
person). But the level runs as an attract "Demo" playback that ignores input
(see Open). The registration (candidate `mdk2-demo`, app `mdk2_demo`) is
kept as `scratch/wip/mdk2-demo-registration-w5.patch`. Its fetch needs a real
`unshield` (IS6 cabs; `tools/is5-extract.js` refuses them).

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

## Route (CLI, `--headless-gl`, `--batch-size=200000`)

No menu before the first level: blank to ~b800, LOADING comic b900-b2500,
then the level with a "Demo" label: dark weapon-name cards (Super Chaingun,
Sniper Bullet) ~b2600-b3300, sniper zoom ~b3400-b3600, third person ~b3700,
blank ~b3760-b4100, then LOADING again (it loops).
Evidence: `scratch/runs/20261011T1615Z-mdk2_demo-projective-gl-w5`.

## Open

- **Input is ignored**: Esc/Enter/Up as WM_KEYDOWN and DirectInput state
  (`di-keydown`) and a mouse click change no frame (md5-identical A/B at
  b2550-b3780). The keyboard is a DirectInput device (`SetDataFormat`
  c_dfDIKeyboard, cooperative level 6 = nonexclusive|foreground), polled with
  `Acquire` + 256-byte `GetDeviceState` about once a batch. Check whether
  our Acquire/GetDeviceState answer for a foreground device, and why the
  game shows the attract demo instead of its menu (scripts menu.lua /
  menuinit.lua are in `scripts.zip`, which 7z/unzip cannot read: custom
  packing).
