# Sacrifice demo — original source preflight (2026-10-13)

Task: NEW-GAME-SACRIFICE-20261013. Source-only; no runtime, gameplay, screenshot, audio or FPS claim.

## Original source and exclusion

Downloaded [the archived Shiny/Interplay 2000 demo](https://archive.org/details/Sacrifice_201404)
from `https://archive.org/download/Sacrifice_201404/Sacrifice.exe`.
The 95,195,047-byte download has SHA-256
`79b8dfa18dd8663abb74dc669d9c6505d4f302603eb2bde3a8d4f11a529a13b2`.
Its MD5 `c0d9d1ef97ecff71dffb7098bb14d0b3` and size match
[ModDB's original sacdemo.exe listing](https://www.moddb.com/games/sacrifice/downloads/sacrifice-demo).
No retail payload, wrapper patch or modified guest was used.

At preparation time Sacrifice was absent from the live public
`https://wine-assembly.berrry.app/lib/apps.js` (SHA-256
`1fbeefb255b5d4d8d28d0554bbcb06000f28cd125b1c78e1912cd7a081c41611`),
main's app registry, candidate manifest, tasks and prior investigation notes.
Preparation tree: `bx_yqnspudj:/home/user/sacrifice-source-work`, base
`d31cf3b784c18dc2647b21a72c7777a800e96f9f`.

## Payload and launch prerequisites

`7z x` extracts the outer MSZip CAB at file offset 168534; `unshield x`
extracts the original InstallShield data1.cab/data2.cab payload.
The game component `Program_Executable_Files` contains 115 files,
101,431,554 bytes, including the original executable, seven DLLs, cache,
demo data and maps. No installer or game was executed.

Remote source: `/home/user/sacrifice-fixture/sacdemo.exe`.
Original installer: `/home/user/sacrifice-fixture/installer/Disk1/Setup.exe`.
Game root: `/home/user/sacrifice-fixture/payload/Program_Executable_Files`.

`Sacrifice.exe` is an 831,488-byte PE32 i386 Windows GUI program, linker 6.0,
image base 0x400000, entry RVA 0xb20cc, timestamp 2000-11-20 19:26:36 UTC.
SHA-256: `79c4754998031e2d0ee0de008c8958507d475b4debe77aa4c746bfac522f8fc8`.
Imports include share.dll, game3d.dll, DINPUT, MSVCRT and normal Win32 APIs.
Original 3d_d3d.dll imports DDRAW; game3d.dll uses SMACKW32; sound.dll uses
Mss32 and SMACKW32. The original share.dll names registry key
`Software\\Shiny Entertainment\\Sacrifice Demo`; values required for startup
are not yet established. Do not invent registry values.

Readme minimums are Windows 95/98/2000, 64 MB RAM, DirectX 7.0a and an
8 MB Direct3D adapter. Original tutorial maps tu01/tu02/tu03 exist.
Readme controls are W/S or up/down to move, A/D or left/right to turn.
Ordinary Tutorial UI is the intended first controlled gameplay route.

## Bounded next step

After the coordinator grants the runtime resource, pin the current reviewed
canonical wasm and dependencies in this isolated tree, verify their hashes,
then attempt an original startup for at most 90 seconds (external guard 120s).
The extracted-original route mounts Sacrifice.exe plus every original companion
file with `--vfs-include=**/*`; it must not replace DLLs, patch the executable,
fabricate installation state or auto-answer a license dialog. Capture and review
the first startup screen before selecting Tutorial or adding control inputs.
If extraction omitted required installer state, investigate the original installer
instead of guessing it. Any encountered acceptance prompt remains unanswered.

The bundled Readme contains a general product license and restrictive
redistribution language. No license was accepted and no public distribution
is authorized by this investigation.

Evidence on the remote tree:
`scratch/runs/20261013T2055Z-sacrifice-source/` contains
archive metadata, original public-app snapshot, extraction logs, PE headers,
all 115 file hashes, import inventory and preparation.json. No result.json is
published because the title has no corpus registration or actual runtime run yet.

## Original startup result (2026-10-13 21:07 UTC)

The original demo reaches a reviewed 640x480 main menu with Single Player,
Multiplayer, Load Game, Options and Quit. No acceptance prompt appeared.
This is startup evidence, **not gameplay qualification**.

The first bare route failed before startup because mounted companion files do
not seed app-local PE DLL loading. This was harness setup, not an established
game incompatibility. The corrected route declares each of the seven original
DLLs with repeatable `--dll-seed=ABSOLUTE_PATH`, mounts `--vfs-include=**/*`
and supplies the existing system MSVCRT dependency from the original WA demo
fixture (SHA-256 `df9f2aab7f7119f214c5d743d961fde4bf324f19011fbbb7e9cf666856fba0ba`).
No game file or registry entry was modified.

Tested source 1ab99c63 on d31cf3b78, canonical wasm
`ba6f25ea2d467b3fba00110d83575d48ac1aeb8794a474052190998067723259`,
Node v24.18.1, cooperative headless threads, default clock.
Corrected process 99702 / 99712 / 99713 ended with exit 0 at
2026-10-13T21:08:56.539Z after its 90-second guard; all were verified absent.
The earlier 98786 / 98805 setup attempt also terminated.

Evidence:
`scratch/runs/20261013T2106Z-sacrifice-original-startup/` (setup failure),
`scratch/runs/20261013T2106Z-sacrifice-original-startup-dll-seeds/`
(corrected route, screenshot, command/identity/terminal receipts and all source
file hashes). Both were retrieved to the coordinator with SHA-256 verification.
Reviewed screenshot SHA-256:
`89b12934b574e8416a821f11987812eaf15480d1a995b455e01a88d7bd61f98c`.

Next granted run should capture the current menu, click Single Player near
(320,252), review the resulting screen, then enter Tutorial through ordinary
input. The source-only command-queue driver
`scratch/sacrifice-next-control.js` in the isolated remote tree bounds that run
to 270 seconds internally / 300 externally. It is prepared but has not run.
Stop if a license prompt appears. Capture world before and after W/up movement;
menu navigation alone does not establish control.

## Tutorial selector and next causal test (2026-10-13 21:21 UTC)

Ordinary Single Player input opens the Tutorial 1/2/3 selector. A separate
ordinary mousemove visibly places the game's cursor at Tutorial 1.
Click at (240,211), a held down/up pair, and Enter leave the selector visible;
the later snapshot still reports main/focus 0x10001 with a visible 640x480
Sacrifice window. No world, acceptance prompt, error or crash appeared.
Do not infer an input or file-loading root cause from this observation.

The first continuation driver's ordinary-command whitelist omitted mousemove;
its initial Tutorial click left the game's drawn pointer at the old position.
This harness limitation was corrected in a fresh run with no guest or emulator
patch. The corrected driver sent mousemove at batch17250, click21793,
mousedown28316, mouseup30365, and Enter35733. The pointer correction alone did
not make the Tutorial start.

Both routes exited0 after ordinary control-channel quit.
107794/107804 ended21:21:24.938;110658/110668 ended21:23:30.966;
all four were verified absent21:23:40.621 before releasing the runtime.
Evidence retrieved to the coordinator:
`scratch/runs/20261013T2119Z-sacrifice-tutorial/` (13 artifacts) and
`scratch/runs/20261013T2121Z-sacrifice-tutorial-pointer/` (16 artifacts),
including reviewed menu/selector captures, exact control events, commands,
source/module identity and terminal receipts. All 29 artifact hashes verified.
These remain startup evidence; gameplay and ordinary world control are unqualified.

Static analysis now provides a narrow next diagnostic. All addresses below are
the original fixed-base Sacrifice.exe's guest VAs:

- RegisterClassA setup at0x40b296 assigns wndproc0x40af60. WM_LBUTTONDOWN
  reaches0x40b18e, tests byte[0x4cdf28]&4, and calls0x406260(this0x4cdf30,mask1).
  The corresponding up path0x40b1c6 calls0x4062a0(mask1) under the same gate.
- The original menu dispatcher recognizes fourCC tu01..tu03 at0x40e8ee
  through0x40e900 and enters0x40e93f. It calls0x4997f0 with the string Tutorial.
- That lookup clears global pointer0x4ce288 and calls0x494ab0, which selects
  the Tutorial name through0x494d50. At0x40e980 the caller skips map selection
  if the pointer is NULL; otherwise it calls0x4950c0 and then0x4978f0.
- Tutorial enumeration at0x495c10 supplies the original maps/tutorial path to
  0x494c20; its FindFirstFileA call is0x494c59 and FindNextFileA is0x494c98.

The source-only plan and disassembly are in
`scratch/runs/20261013T2124Z-sacrifice-selector-source/`.
Its syntax-checked diagnostic-driver.js prepares a160-second ordinary route
with trace-input, named file API tracing, and passive counters at0x40b18e,
0x406260,0x40e93f,0x4997f0,0x494c20,0x4950c0,0x4978f0.
Bracket the reviewed Tutorial click with hit-counts and read-only dumps of
0x4cdf28/0x4ce288. This distinguishes arrival at the original Tutorial handler
from subsequent mapset discovery. Existing sampled EIP logs cannot establish
that either branch was reached or missed. No diagnostic run, state write,
registry fabrication, or emulator repair is authorized by these static findings;
the next run requires the coordinator's runtime grant.

## Selector delivery diagnostic (2026-10-13 21:40 UTC)

The bounded original run
`scratch/runs/20261013T2140Z-sacrifice-selector-diagnostic/`
reproduces the main menu, Single Player selector and pointer hover, then sends
an ordinary held mouse press at(240,211). Trace-input targets hwnd0x10001
for both down and up, matching the visible/focused main window.
The selector still does not advance.

At before-batch16440 versus after-batch24659:

| Original address | Before | After |
| --- | ---: | ---: |
| 0x40b18e, WM_LBUTTONDOWN branch | 1 | 2 |
| 0x406260, gated window-message mouse consumer | 0 | 0 |
| 0x40e93f, probed tu01..tu03 dispatcher | 0 | 0 |
| 0x4997f0, mapset selection | 0 | 0 |
| 0x494c20, map enumeration | 0 | 0 |
| 0x4950c0, map selection | 0 | 0 |
| 0x4978f0, subsequent transition | 0 | 0 |

The held down/up arrived at batches22634/24658. Read-only dumps before and
after show byte[0x4cdf28]=0x0b, so bit0x4 is clear and the original wndproc
intentionally skips0x406260. Global0x4ce288 remainsNULL; the probed Tutorial
lookup never runs, so this is not evidence that lookup itself failed.
The file trace includes original demo/music discovery but no maps/tutorial
enumeration. The next source question is the DirectInput button consumer
and actual selector callback, ahead of the probed Tutorial dispatch.
Do not infer that the fallback-mode flag is wrong or that every alternate menu
path has been ruled out; no repair is justified yet.

The source/module/115 original fixture identities were checked before launch.
The supervisor uses its own detached child process group, TERM at185seconds,
KILL after another2seconds and a bounded5-second membership audit. Seven
pure mock tests cover normal exit, descendants, malformed commands,
spawn failure, escalation and failed cleanup. Actual counter stdin protocol
was verified in test/run.js: `{"cmd":"hit-counts:before"}` takes no batch prefix.
The guest scope remains160seconds; no new emulator build was made.

This run quit ordinarily with exit0 at21:41:39.806. Supervisor125582 and
child/group125593 were absent by21:41:46.167; the terminal receipt records
cleanupComplete=true and no surviving group members. No escalation was needed.
Four reviewed menu/selector screenshots, source snapshots, exact command and
input traces, counter/dump comparisons, hashes and terminal evidence are
preserved. This remains unqualified gameplay, with no audio/FPS claim,
guest-state writes, acceptance or deployment.

## DirectInput consumer and selector geometry audit (2026-10-13 21:49 UTC)

Source-only evidence: `scratch/runs/20261013T2144Z-sacrifice-directinput-source/`; no new runtime or emulator change. Original EXE hash remains as above. Original `demo/menus.wad` SHA-256 is `fd5dc249373f7fe607b6db6a833ebdc9db36d8a547dc0c48242333713cdc889b`.

Tutorial 1 is a type-1 button resource at file offset `0xb15`, ID `0x74753031`, local position (8,8), width 144, flags `0x2000`. Factory `0x4a27f0` dispatches type 1 through `0x4a280a` to constructor `0x4a37f0`. The constructor copies the position/width and forces height 16 (24 only with flag `0x80000`). Its vtable `0x4b5364` has hit-test slot +0x10 = `0x4a2c50`, which tests the whole rectangle at object +0x204 through `0x4b0db0`. There is no circle-only test on this path: the round endpoints around x176/304 decorate the 144-wide bar. This supports clicking the label at (240,211); the actual live object rectangle/parent transform has not yet been dumped.

The actual mouse update is `0x406320`: it calls device virtual poll with mode 1 at `0x40637a`. Mouse device routine `0x405820` uses buffered GetDeviceData in mode 1: `0x405914 -> 0x405310 -> COM +0x28`, requesting one 16-byte record. Offset 12 is consumed at `0x405958`; `0x405a40` converts high-bit button states/edges. The state and edges reach `0x406467 -> 0x4066f0 -> 0x406690 -> 0x4ae7e0`. UI hit lookup is called at `0x4ae880` through `0x4aed60`, which invokes child virtual +0x10. Button handler `0x4a38f0` receives UI press 0x11/release 0x12; release branch `0x4a3968` invokes activation slot +0x5c = `0x4a39a0`. Thus the earlier zero WM fallback count is expected for the observed mode, and does not diagnose a missing button path.

Next explicitly granted run: same original assets and canonical module, 160-second guest/185-second outer deadline with bounded TERM/KILL cleanup, no build. `scratch/sacrifice-consumer-supervisor-20261013.js` counts `0x405914,0x405958,0x405a40,0x406467,0x4ae880,0x4a38f0,0x4a3968,0x40e93f`, preserving ordinary held click and input tracing, removing broad filesystem tracing. Read-only mouse object `0x4cdf30:160` covers device pointer +0x24, cursor +0x44/+0x48 and edges/state +0x74/+0x78/+0x7c; UI manager `0x4e6050:144` covers current/capture/hover references. No flag/map/register writes. Distinguish buffered event delivery, button decoding, hit lookup, and activation before proposing an emulator fix. The provisional guess that frequent EIP `0x4b07f0` was polling was rejected by disassembly: it is graphics/FPU math. Seven pure supervisor lifecycle/validation tests pass; no game launch occurred during this audit.

## Consumer runtime result (2026-10-13 21:53–21:54 UTC)

Run `20261013T2153Z-sacrifice-consumer` used source `edd68ea0713d59eeb634f2a1439df0f57037deba`, reviewed driver SHA `da7a7b007024323dcc053e41b5708da272a179ba5153bad44d1c1f5c763aec16`, unchanged canonical wasm/115-file original fixture/CRT identities. Four screenshots reviewed; Single Player selector remained unchanged, no gameplay. Ordinary move (240,211) batch15429, down17287, up19149. Before/held/after valid left-byte consumer `0x405958` counts 2/3/4; edge converter `0x405a40` 512/1019/1320. Original mouse object +0x78 changes 0 -> 0x201 -> 0, confirming button state reached the guest. Button handler `0x4a38f0` stays165, release `0x4a3968` stays1, Tutorial branch stays0. Crucially original mouse object cursor +0x44/+0x48 stays (320,240) in all four dumps. Hover/after screenshots lack the moved hand seen in the earlier run; do not silently substitute that earlier observation.

**Probe planning correction:** `--count` is per-block (`src/01-header.wat` comment explicitly requires x86 block-entry boundaries). The planned `0x405914,0x406467,0x4ae880` are interior call instructions, so their zero counts are non-diagnostic. Preserve this harness mistake; use function/branch entries next. The positive branch/function counters plus original memory establish button delivery without relying on those zeros. No generic emulator bug is established. Next source-only question is absolute harness pointer positioning versus original relative DirectInput cursor integration, including normal `relmousemove` delivery and SetCursorPos/clamping.

Guest PID/PGID134465 exited0 at21:54:25.009, child/group absent21:54:25.011, supervisor134455 absent in ps21:54:25.068. Final release receipt21:55:06.048 confirms both PIDs and both groups absent. Eighteen artifacts hash-verified locally; evidence archive SHA `5e4a3162a2883625e948670045c707a23c3b0746d4ab8ce79c67b46734121a8f`. No further runtime grant.

### Normal relative-input continuation prepared (source only)

Pinned `lib/renderer-input.js:2718` derives absolute-move DirectInput deltas only when `_directInputMousePoints.get(inputMemory)` already exists. The first ordinary `mousemove` establishes that reference with dx=dy=0. The earlier `click` calls down/up, which set the host pointer but do not establish this motion reference. This explains the latest run's measured fixed original cursor without an emulator defect. `test/run.js:10046` supports ordinary `relmousemove:DX:DY`; `handleRelativeMouseMove` at renderer line982 passes explicit physical deltas into the same normal move/FIFO route, independent of missing previous position and cursor clipping. Guest SetCursorPos adjusts the virtual cursor without manufacturing DI motion (renderer input contract). Original game `0x4059b6/0x4059c8` multiplies axis records by default sensitivity32; `0x405a90` divides by32 and retains remainder. `0x4063c0` integrates the result into original +0x44/+0x48 and clamps to rendering dimensions. Thus the minimal next granted route is normal `relmousemove:-80:-29` from measured (320,240), inspect screenshot and original cursor, then held down/up at (240,211). This predicted coordinate must be verified, not asserted as observed.

Prepared scratch driver `sacrifice-relative-supervisor-20261013.js` retains original 160/185-second bounds and cleanup, adds bounded ordinary relative movement, and replaces three invalid interior counters with function entries: `0x405820,0x405958,0x405a40,0x4066f0,0x4ae7e0,0x4aed60,0x4a38f0,0x4a3968,0x40e93f`. No guest-state writes, build, or runtime in this preparation.

## Relative route reaches Tutorial loading; original decoder exits (2026-10-13 22:04 UTC)

Run `20261013T2204Z-sacrifice-relative` used reviewed supervisor `73e6b83f12f4748277cfe3bdc34b11cefcedcf76c6911a4518a33a6c3f64cffc`, source `d99a32b1`, unchanged module/fixture/CRT. Normal `relmousemove:-80:-29` moves original cursor (320,240) -> (240,211), verified by dump and reviewed “Play first tutorial” tooltip. Held ordinary down/up advances button release count1->2 and Tutorial branch0->1. Reviewed loading screen reads “Tutorial 1 / The Basics”; progress advances from about one-third to about two-thirds. No world or player movement reached; no gameplay qualification.

Guest141269/PGID141269 ended at22:05:35.301 with host exit0; group/child absent35.302, supervisor141186 and child absent ps22:06:02.122; final receipt22:06:34.563 confirms both PIDs/groups absent. Nineteen runtime artifacts verified; archive `scratch/sacrifice-relative-runtime-evidence.tgz` SHA `aac6473b4a1f86faec042cf3a656ee583dfda26d51e203c00752194b26c5a59e`. The fifth requested screenshot arrived after termination and did not exist; final.png is the reviewed loading checkpoint.

**Attribution correction:** initial interpretation of harness `[eip-zero] guest called through NULL` was wrong. The log first says `[Exit] code=0`. CRT load0xef9000/original0x78000000 maps previous block0xf01cad to0x78008cad. At0x78008cb8 it calls IAT0x78043284, import ExitProcess. The stack return0x9afa8c maps game3d load0x982000/original0x16000000 to0x1602da8c, immediately after explicit exit(0) branch0x1602da80 -> thunk0x16045c30 -> MSVCRT exit IAT0x160470ac. This is an intentional original loading-failure exit, not evidence of a null indirect call. This run used the older pinned harness, which emits the EIP-zero diagnostic without checking the already-stopped ExitProcess state. Main already contains the generic diagnostic correction in ef504c0f3; do not reopen that completed fix or confuse it with this original game loading exit.

Source evidence `20261013T2207Z-sacrifice-loader-exit-source`: original game3d function0x1602d9d0 reads byte[source+0x10]. It dispatches depth24 to0x1602da54, depth8 to0x1602da13, every other value to exit(0). Original strings “ChrConTGA24”, “ChrConTGA8”, “ChrConTGA512”, “ChrIncTga” identify the image decoder. Caller0x1602da90 obtains the source buffer via callback[0x1610a068] before calling the decoder. Actual source-buffer depth and asset identity were not captured; do not infer missing/corrupt files or change the guest. Next source question is this callback binding and asset provenance. No specific failing emulator API identified, so no speculative API conformance test is warranted yet.

## Exact resource observation (2026-10-13 22:13–22:14 UTC)

Run `20261013T2214Z-sacrifice-resource` (actual start22:13:06) used source1d34f58b, reviewed driverdf87f13a and unchanged canonical module/115-file original fixture/CRT. Ordinary relative movement and held click again reach Tutorial loading. Passive trace batch79597 at runtime0x9afa80/original0x1602da80 captures requested identifier `tkhsDMXS.001` at0x9dc150 and EBP=0x10. Since decoder already added16, original source buffer was NULL. EAX depth0 and the dumped VA0 bytes do not describe an actual TGA header. This corrects the provisional unsupported-image interpretation: original resource lookup returned NULL; no malformed asset or emulator API defect is established.

Four screenshots were reviewed, ending at the same loading checkpoint, final.png SHA `af5ed04034660a4ce9c4b88e170fe91bf30c6a6d05282a9a743b7b274917d6ef`. No world or movement reached. Guest147488 exited0 at22:14:14.263; group empty14.264. Receipt22:14:22.978 confirms supervisor147478, guest147488 and both groups absent. Runtime released before source audit. Host exit0 is not gameplay success. Historical post-Exit NULL diagnostic remains already fixed on main ef504c0f3.

Read-only original WAD audit inflates all36 compressed indexes successfully. Records are28bytes; named model `tkhsDMXS` appears in saxs_wiz.wad record189 (packed84858/decoded135570). No type `XTXS` bytes (little-endian SXTX) appear in these decoded indexes. This does not prove every possible resource route is absent. Original `cache/tkhsDMXS.000` is189096bytes, SHA `f98d914458cec87a6d3dc6d34b0388fd42818c4408fd7c165018e876a007150a`, firstDWORD7. No original file was changed.

Source: game3d0x160307b7 tests model flag0x200 before invoking callback[0x1610a06c], bound through IAT0x160470c8 to share CacheSignedFileExists. A true result branches0x16030c54 to cached reads; false or skipped check reaches .001 fallback. Original share0x140010b0 constructs cache path, opens, reads4bytes, compares against global0x1401aec0; mismatch calls remove then returnsfalse. Next bounded read-only observation must distinguish flag gating, cache path/open/read, and signature comparison. Do not force model flags, cache signature, resources, or guest state. Generic emulator conformance work awaits an identified API boundary.

Evidence archive `scratch/sacrifice-resource-runtime-evidence.tgz` SHA `0c4191c0279de19da15919217674c1e6f93f2f23c87d1acb0ec03d8c3c59a5ae` contains16 hashed artifacts plus manifest: runtime trace/input, four PNGs, identities/terminal/release, original WAD/cache audit, and cache disassembly. This evidence covers the completed resource lookup run only; later cache diagnostics are separate runs.
