# Quake III Arena demo 1.11

App id `quake3_demo` (2026-10-10, w4). OpenGL only.

## Provenance and license boundary

- Installer `Q3ADemo.exe`, "Q3Demo v1.11 Win32", 3 Dec 1999, from
  [Jason2Brownlee/Quake3OfficialArchive](https://github.com/Jason2Brownlee/Quake3OfficialArchive)
  (`bin/Q3ADemo.exe`); the same 46.6 MiB file is on
  [archive.org](https://archive.org/details/QuakeIiiArenaDemo).
- 48,907,862 bytes, SHA-1 `95fb0e8f595506dd30b57635db151f2e0762be02`,
  SHA-256 `6af96cb1b5c97535c9923d8855ca85ec21b21b65b48738b2c5e674e17c65835d`
  (candidate `quake-3-arena-demo-installer` in `test/candidate-corpus/manifest.json`).
- The installer shows id Software's "LIMITED USE SOFTWARE LICENSE AGREEMENT"
  for "this game demo program entitled QUAKE III: ARENA". Section 3
  (Permitted Distribution and Copying): so long as the agreement accompanies
  each copy, a non-exclusive, limited right to copy and distribute the
  software free of charge for non-commercial purposes (magazine cover discs
  included); CD copies labelled "SHAREWARE" or "DEMO"; no commercial
  distribution. Section 2 forbids, among others, renting/selling,
  distribution outside section 3, and (j) publicly displaying the software.
  It was initially kept in `LOCAL_CANDIDATE_APPS`. Desktop preparation was
  requested on 2026-10-14; that branch includes the complete original installed
  demo, including `extras/help/q3a eula.htm`, in the desktop asset set. This is
  a record of the requested packaging change, not a new interpretation of the
  license or a claim that this candidate has been deployed.

## Desktop preparation, 2026-10-14

The first-launch `lib/quake3-modern-controls.ini` is mounted as
`c:\\demoq3\\q3config.cfg`; saved user configuration replaces that seed on
later launches. W/S move, A/D strafe, Space or right mouse jumps, Ctrl/C
crouches, left mouse fires, wheel changes weapons, E/Enter uses the held item,
and Shift walks. `relativeMouse: true` uses the same browser capture policy
as Quake II. Mobile has a held move pad (Up/Down also navigate menus), relative look surface, and
Fire/Jump/Crouch/Item/Weapon/Esc buttons.

The browser LAN uses an automatic room on UDP 27960. Its hosting probe sends
`getinfo berrry` and reads the real server's hostname response; the room card
launches clients with `+connect {host}`. No engine patches or native UDP
Internet access are implied: the transport is the existing browser WebRTC
virtual LAN. The standalone CLI pair remains `test-quake3-vlan-gameplay.js`.

`test-quake3-desktop-web.js` exercises trusted browser keyboard/mouse input,
measures movement and turning with the game's own `viewpos`, then joins a
separate mobile browser through the normal room card and checks the server's
`ClientBegin` log, bidirectional WebRTC traffic, touch movement and look.
Reviewed acceptance: `scratch/runs/20261015-quake3-acceptance6/` (UTC date;
2026-10-14 locally). Chrome with SwiftShader, cooperative mode, desktop plus
touch-emulated mobile browser contexts:

- All WASD directions changed the guest's `viewpos`. Mouse yaw changed from
  -45 to -52 degrees and remained -52 after release/absolute motion/re-capture.
  Escape reached the game menu. CDP does not invoke Chrome's browser-level
  Escape shortcut, so the test explicitly calls `exitPointerLock` to exercise
  release/re-capture; this is not a physical-key test of that browser shortcut.
- The room card launched the member at `10.0.0.2` with `+connect 10.0.0.1`.
  Both players reached `ClientBegin` in the server's own game log. At the
  traffic checkpoint, the member had sent 51 frames and received 157 over an
  open WebRTC datagram channel. Both guest views rendered Arena Gate.
- Touch movement advanced the client from (1024,1000,50) to (1024,1212,50);
  touch look changed yaw from 90 to 63 degrees. Fire held/released the attack
  mask (1 → 0), and the capture shows ammo consumed. Landscape (844×390) and
  portrait (390×844) controls fit the viewport.
- No guest/page runtime errors were reported. Earlier harness attempts hit
  Puppeteer's default command timeout or read an unfinished `condump`; the
  final harness permits arena loading and reads completed `viewpos` lines
  from the synchronous game log instead. No guest code was patched for tests.

Canonical build, asset/manifest-size checks, FPS touch-layout and file-policy
tests pass. The deploy dry run considers 2262 files; all 303 installed manifest
entries exist, and `pak0.pk3` is emitted as five parts. No public deployment
was performed. Physical-phone/Safari behavior and WAN/NAT conditions were not
tested by this local two-browser run.

## Install

The package is Installer VISE (MindVision); neither `unzip` nor `7z` opens it,
so the original installer runs in the emulator:
`node test/run.js --exe=.../Q3ADemo.exe --vfs-include=**/* --batch-size=10000 --control-stdin --frozen`.
Welcome -> Next (452,393); Software License Agreement (scroll the text by
clicking the scrollbar track at (568,250); Page Down only moves the caret) ->
Yes (452,393); destination `c:\Q3Ademo` -> Next; Ready To Install -> Next;
copying `demoq3\pak0.pk3` (46,853,694 bytes) takes ~50k batches at
`--batch-size=10000` (about two minutes); Finished. The 304-file `c:\q3ademo`
tree was exported from `ctx.vfs` with a control `eval` (keys are lowercase)
into `test/binaries/candidates/quake-3-arena-demo-installer/installed/`, and
`node tools/gen-installed-manifest.js <installed> quake3.exe` wrote the
303-entry `.wine-assembly-browser.json`. No registry state is needed.

## Running

- Main menu (SINGLE PLAYER / MULTIPLAYER / SETUP / DEMOS / CINEMATICS / EXIT)
  draws on both GL arms. Software GL (`--gl-renderer=software`) runs at about
  13 batches/s at `--batch-size=200000`.
- Straight to a map: `--args='+map q3dm1'` (Arena Gate, free for all,
  fraglimit 20). Loading (BSP, game media, items) takes ~8000 batches at
  `--batch-size=200000`; then the player stands in the arena with the machine
  gun, 100 health / 100 ammo.
- Input: keyboard through window messages and DirectInput both work; Up moves
  forward, Left turns, Ctrl fires (holding it empties the machine gun and the
  game switches to the gauntlet, "OUT OF AMMO").
- WebGL (`--headless-gl --gl-renderer=webgl --gl-census`), 8600 batches:
  33 distinct GL entry points, 6.57M GL calls, 297k packed draws, 3160 presents.
