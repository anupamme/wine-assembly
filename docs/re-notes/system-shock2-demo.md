# System Shock 2 demo: source and startup baseline

Source: https://archive.org/details/SystemShock2Demo, `SHOCK2.EXE`,
74,776,513 bytes, SHA-1 `efd1e87f5aa0fb9c810893ade9269a8dde9103ba`.
Downloaded and hash-verified on boat bx_9xcsfw7s on 2026-10-11.

`7z x SHOCK2.EXE` extracts a CAB containing the game under `shock/`.
The game `shock/shock2.exe` SHA-256 is
`029d79335d77d5d1e60cee53b27018ad8178a3e8e4de5a3c29d1b29f462b528c`.
Keep the original `CAM.CFG`, `INSTALL.CFG`, CRF resources, OSM and movies.
The included README.WRI is RTF. No redistribution grant was established;
no installer licence prompt was answered and nothing is publicly deployed.

Evidence: `scratch/runs/20261011T1423Z-new-game-refill/SystemShock2Demo/`.
The first probe failed in the harness because `test/binaries/tlbs/stdole2.tlb`
was missing. Copying the existing fixture repaired that prerequisite.
Both the retained IW diagnostic runtime and a fresh full build of main
`3cf8095385f2ecb4ceb7a8043ee0e452bd1eafa4` then reproduced a startup failure:
the game creates its window and two threads, then calls through NULL near
batch 20. Main WASM SHA-256 is
`8bbd5421028fafccf89a3fd29cd02a67d7fe116e11def181ca5f1bcc93736555`.

The logs also warn that native ole32.dll is absent; its causal role is not
established. Do not label this an emulator defect before distinguishing missing
runtime components, extraction layout and actual API behavior. No gameplay,
audio or FPS qualification. The CLI returned exit code 0 despite the failure;
the recorded log outcome takes precedence over the process status.

Reproduction uses `test/run.js --exe=<shock/shock2.exe> --vfs-include='**'
--no-build --quiet-api --batch-size=100000 --max-seconds=60
--max-batches=1000000 --png=<output.png>` on the remote build.
The next step is a bounded startup API/fixture investigation on current main.

## Bounded API/file trace (2026-10-11)

`scratch/runs/20261011T1436Z-new-game-continuation/ss2.log` reproduces the
same NULL call with API/file tracing enabled. DirectDraw creation/interface
queries and mode enumeration occur, then DirectInput and sound initialization;
there is no recorded SetDisplayMode before the stop. GetDeviceCaps(BITSPIXEL)
returns 32. The trace reports missing `D:\shock\snd.crf`, `C:\english`,
`menus.cfg` and optional `user.cfg`, but their causal relationship to the stop
is not established. Do not substitute a missing-file theory for a demonstrated
failure chain. That trace run had no working image renderer, so it is API
evidence only; the earlier NULL result was also reproduced with rendering.

The test box is now bx_drmnxa44, with the same current-main module hash.
No guest modifications, approval responses or emulator patches were made.

## Resource root isolated (2026-10-11 15:13Z)

The NULL call is downstream of resource creation, not yet evidence of a
missing COM DLL: `0x58ca50` calls helper `0x58cc40`, which asks the resource
manager for an image, returns NULL, and the caller invokes vtable slot +12
without checking. The requested strings include `iface\\` and `fontpal`;
the supplied `iface.crf` ZIP does contain `fontpal.pcx`.

A controlled layout A/B using identical game bytes and the same emulator
module isolates a usable launch configuration. The original drive-root mount
with cwd `C:\` reproduces the NULL stop. Mounting every extracted file under
`C:\shock\` and setting `--cwd=C:\shock` opens the CRF archives and reaches
the main menu. Preserve relative subdirectories, including cutscenes. No CFG
or executable changes, missing-API stubs, or extra DLLs were needed. This
does not establish whether the drive-root failure is a guest limitation or an
emulator path-semantics defect; the supported launch should use a subdirectory.

Evidence is `scratch/runs/20261011T1513Z-ss2-resource/`: `root.json` and
`subdirectory.json` contain complete commands, logs contain the A/B outcomes,
and `subdirectory.png` is a reviewed menu. Ordinary mouse hover/down/up at
`(480,50)` selects New Game; `new-game.png` shows the difficulty/Start Game
screen. These runs use the prior main base plus the Turok native paint fix,
WASM SHA-256 `f7b5a629258a4c7fadc39e1278aa18e95ba69eda4f527631f6782d4079aafac5`.
They are CLI captures, not browser/gameplay qualification. The original
missing `D:\shock\snd.crf` probe alone did not explain the NULL.

The ordinary route continues: Start Game `(375,296)` opens **Welcome to UNN**;
Continue `(490,435)` opens the key reference; Continue at the same position
then loads resources and displays **Your video hardware is not supported by
System Shock 2.** The tested schedules hover/down/up at batches 150/155/160,
250/255/260, and 330/335/340 respectively, after New Game at 100/105/110.
`start-game.png`, `continue.png`, and `continue2.png` are reviewed evidence.
The reference cards contain illustrated gameplay, but these are static game
instructions and must not be classified as a playable scene.

The graphics trace reaches IDirect3DDevice3 creation, render/texture-stage
setup and repeated ValidateDevice calls before releasing the device and
showing the error. The failure is therefore later than initial DD enumeration;
the exact failed condition is not established. Next trace the guest's video
initialization return path rather than guessing new capability flags. The
unfiltered API trace is 255,701,275 bytes and stays on the boat; the local run
retains a graphics-only excerpt, the final 60 KB, the command receipt and the
original trace SHA-256/length. No screenshot of actual gameplay, FPS result,
audio validation, browser validation or release-ready claim yet.

## Video rejection branch isolated (2026-10-11 15:34Z)

Single-address traces preserve the ordinary input route. A comma-separated
`--trace-at` list forces batch size 1 in this harness and invalidates these
input timings; the failed multi-address attempt is not guest evidence.

`outer-return.log` captures `0x5d909d` with EAX=1, confirming the renderer's
initialization helper succeeds. `video-return.log` captures `0x43bb85` returning
1 on the menu transitions and 0 at batch 1073. The decisive capture is
`surface-return.log`: `0x43b2fe` receives EAX=0 from `prev_eip=0x43b551`.
Disassembly shows that exact return follows this rejection in `0x43b470`:
the descriptor at `[ESI+0x20]` has bit 0 clear while the requested flag at
`0x662768` is nonzero. The game releases its renderer via `0x5d74b0`, returns
zero, and ultimately displays the unsupported-video message.

This narrows the failure beyond device creation/ValidateDevice: initialization
`0x5d7440` succeeds, but a requested descriptor feature does not survive it.
The feature's meaning and the code clearing bit 0 are still unproven. Next
trace the descriptor through `0x5d8880` and its renderer setup callees; identify
the actual capability/validation condition before changing emulator behavior.
Do not force the guest bit or treat all capabilities as supported.

All named logs, command receipts and disassembly excerpts are in the existing
1513Z run directory. The `mode-result` trace did not hit its requested address
and establishes no mode-enumeration failure. No new gameplay or FPS evidence.
