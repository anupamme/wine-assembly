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
