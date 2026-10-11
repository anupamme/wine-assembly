# Giants: Citizen Kabuto demo

Planet Moon's 2001 action game (Interplay), the "Reaper" demo. Direct3D 7.
Registered as `giants_demo`.

## Payload and licence

`test/candidate-corpus/manifest.json`, id `giants-demo`: archive.org
`giantsreaperdemoinstall/giantsreaperdemoinstall.exe` (105.8 MB, SHA-1
`9647ca57...`). The outer exe is a CAB 7z opens (`Disk1\`); inside is an
**InstallShield 6** set (`data1.hdr`, `data1.cab`, `data2.cab`, `ikernel.ex_`).
IS6 setups need their out-of-process engine, so the installer is not run;
the fetcher unpacks it with `unshield`, one file group at a time, into the
layout the game expects:

| File group | Installed to |
|---|---|
| Main Files (exe, gg_dx7r.dll, gs_ds.dll, Eaxman.dll, license, readme) | `\` |
| Game Files Bin, WAbx, GData, GZP (`.gzp` archives, `GameObj.bin`) | `Bin\` |
| Stream Files, Music Files | `Stream\` |

257 files, 123 MB. The game probes `Bin\Override\*.*`, `Bin\*.gzp`, `Bin\*.*`,
`StreamEnglish\*.*` and `Stream\*.*` at start; with everything in one flat
directory (what `tools/is-cab.js --extract` writes) it stops with
"Failed to open GameObj.bin".

Licence: `license.txt` -- personal noncommercial home use; no decompiling,
reverse engineering or disassembly; no copying or distribution. `localOnly`;
API traces only.

## DXErr 887600FF (fixed)

The first run ended at the game's own "Game Error Screen" with
`DXErr 887600FF` (DDERR_NOTFOUND). The game creates its Z-buffer
(`DDSCAPS_ZBUFFER`), attaches it to the back buffer with `AddAttachedSurface`,
and later asks the render target (`IDirect3DDevice7::GetRenderTarget`) for
`GetAttachedSurface(DDSCAPS_ZBUFFER)`. Our `GetAttachedSurface` only looked at
the flip-chain link (`misc0`), while `AddAttachedSurface` records the
relationship on the child (`DX_SURF_META +4`). It now also scans the explicit
children by caps (`$dx_surface_explicit_child`);
`test/test-directdraw-get-attached-explicit.js`. Found with
`--trace-api-mem=IDirectDraw_CreateSurface:1:124,IDirectDrawSurface_GetAttachedSurface:1:16`.

## Route (CLI, `--batch-size=100000`, `--headless-gl`)

Mount the tree at `C:\` (`--exe-guest-path=C:\GiantsReaperDemo.exe --cwd=C:\`).

| Batch | Action | Screen |
|---|---|---|
| ~500 | | "Select Player ID", 3D island and logo |
| 1000 | click (320,437) "Enter New ID" | "Enter New Player ID" |
| 1100 | `keypress` W, 6 (WM_CHAR; `keydown` letters are ignored) | name "W6" |
| 1140 | Enter | main menu (Start New Single Player Game ...) |
| 1300 | mousedown/up IN PLACE (no move) | loading "Delphi's Story 1: Yan, the Samurai Smartie" |
| ~2400 | | intro cutscene with subtitles |
| ~2900 | | Mission Objectives over the HUD |

**The menu cursor is the game's own, driven by DirectInput deltas.** It moves
1:1 with the deltas (`GetDeviceState`, a 20-byte mouse state, every frame),
but the game puts it on "Start New Single Player Game" by itself when the menu
opens, while the host pointer is still where the last click was (320,437).
So any absolute move aimed at the item's screen position is applied as a
delta from the wrong origin and pins the cursor at the edge; clicking without
moving selects the highlighted item. Not an emulator bug -- a real mouse
user only ever moves relative to the cursor they see. On a phone this is
why the layout uses trackpad (relative) touch.

Open: the terrain renders mostly untextured (flat green) in the CLI's
headless GL path; not investigated.

Evidence: `scratch/runs/20261011T1840Z-giants-demo-w6`,
`scratch/runs/20261011T1950Z-giants-di-cursor-w6` (m1-p0..p3 measure the
cursor; m2/m3 the route into the mission).
