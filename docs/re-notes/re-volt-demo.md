# Re-Volt demo (Acclaim / Iguana London, 1999)

App id `re_volt_demo`; candidate `re-volt-demo` in
`test/candidate-corpus/manifest.json`. Direct3D 6 (`IDirect3DDevice3`) R/C
racer, PC Gamer cover-disc build (`cars/pcgamer`), one track.

## Licence

**Not redistributable.** The game's own startup legal screen says the demo "is
intended for personal use only and may not be lent, copied, sold, published,
duplicated onto CD, etc, without prior written approval from Acclaim". Neither
the archive.org item nor `readme.txt` says otherwise. It is registered strictly
as a `localOnly` fixture: fetched by `tools/fetch-candidate-corpus.js
--id=re-volt-demo`, never shipped or deployed.

## Install layout

`Re-voltDemo.zip` (archive.org `Re-Volt`, SHA-1 in the manifest) holds an
InstallShield 5 setup. `data1.cab` is unpacked with `unshield` per file group
(`game`, `cars`, `gfx`, `levels`, `models`, `wavs`), and the groups are copied
into `installed/` with `game` at the root. That gives 443 files: `revolt.exe` at
the root and `Mss32.dll` beside it, loaded as a real PE. Fetching on a fresh
boat needs `unshield` from apt.

## Startup sequence (headless, `--batch-size=50000 --tick-ms-per-batch=1000`)

1. `IDirectPlayLobby3_RegisterApplication`. It writes
   `HKLM\Software\Microsoft\DirectPlay\Applications\Revolt`
   (Guid `{6BB78285-71DF-11D2-B46C-0C780CC10840}`, File `revolt.exe`,
   Path/CurrentDirectory `C:\`). Before 2026-10-11 this returned E_NOTIMPL, and
   the game stopped with the MessageBox "DDERR_UNSUPPORTED: Can't register for
   lobby support".
2. It reads settings from `HKLM\software\Acclaim\Re-Volt Demo\1.0` (all values
   are absent on a fresh run, so the game uses its defaults).
3. **CRC32 integrity pass**, about 150 batches of 50000 blocks with a black
   screen. This is the bitwise CRC loop at `0x444581`–`0x44459e` (polynomial
   `0x04C11DB7`), called from `0x444562`. The cost is real interpreter work and
   it is not a hang.
4. The **legal screen**, then the Acclaim logo, both drawn every frame by
   `IDirectDrawSurface_GetDC` + `StretchBlt` of a 640×480 bitmap followed by
   `Flip`. One 50000-block batch runs hundreds of these frames, and the screen
   is timed on guest time. Headless, this is the slowest wall-clock phase
   (~12 s per batch); a larger `--tick-ms-per-batch` gets through it sooner.
5. The "RE-VOLT loading" screen, captioned with the file being loaded
   (`levels\frontend\frontend.inf`, then `C:\WINDOWS\TEMP\revolt.log`). During
   it the game bubble-sorts model polygons at `0x44bc2a`–`0x44bc56`. That is
   finite but O(n²), and it holds one unchanged frame from batch ~196 to
   ~300.
6. The 3D **main menu** (shop-counter scene; Start Race / Best Times /
   Options / Quit; `V0.01pcgamer` in the corner) by batch ~312, about 7 minutes
   of wall time on a 4-vCPU boat. Pressing Enter at batches 170 and 175
   (`keydown:13`/`keyup:13`) skips the legal screen.

## Route to a race (reviewed 2026-10-11)

Run `scratch/runs/20261011T0038Z-re_volt_demo-race-claude1863` (`route.sh`
there). From the menu, Enter every 15 batches from 330 to 510 takes these
defaults: Start Race → Single Race (b345) → car select → "Toys in the Hood
1" (b400) → loading `levels\NHood1` (b445). The track load is slow; while it
runs the game places 64 objects by rejection sampling at `0x45a7c0` (CRT
`rand` at `0x482c69`, outer `cmp esi, 0x40` at `0x45aa65`). The race starts
around b674. Holding Up (VK 38) from b670 drives the buggy. The run reaches
b810 in about 16 minutes.

## Texture loading and the colour fix (2026-10-11)

Texture pages are 256×256 **A1R5G5B5**: the DDSD pixel format is flags 0x41
with masks 0x7C00/0x03E0/0x001F/0x8000, copied from the format the game picked
at `0x726c78`. The creation loop near `0x46cea0` makes a system-memory page and
the video-memory pages, then `Texture2::Load`s each one. A BMP (24-bit,
`levels\nhood1\nhood1a.bmp`...) gets into a page through `LoadImageA` and
`CreateCompatibleDC`, then `GetDC` on the system-memory page, `StretchBlt`,
`Lock` and `Load` (GetDC returns at `0x46d67f`, Lock at `0x46d71d`). The only
GDI imports are LoadImageA, CreateCompatibleDC, SelectObject and StretchBlt.

Until 2026-10-11, GDI on a 16bpp DirectDraw surface always wrote RGB565
(`$gdi_dx_dc_bind` and `$gdi_raster_channel_mask`). Both D3DIM arms then read
those texels as 1555. The result was a grey road drawn purple, the wooden fence
green, the grey manhole yellow-green, and rainbow speckle wherever green's low
bits vary. This was not mip aliasing and not a sampler bug: the software and
WebGL frames matched. GDI now uses each surface's own layout. Before/after on
both arms, plus the source BMPs: run
`scratch/runs/20261011T0150Z-re_volt_demo-edge-speckle-claude1863`.

## API profile (legal screen, 60 s)

`IDirect3DDevice3_SetRenderState` 22.5k, `IDirectInputDevice_Acquire` +
`GetDeviceState` 7.6k each, `SetTextureStageState` 5.4k,
`IDirect3DViewport3_SetViewport2` 5.4k, and Flip/BeginScene/EndScene 3.9k each.
Every frame also does the GDI sequence `GetDC`, `CreateCompatibleDC`,
`SelectObject`, `StretchBlt`, `DeleteDC` and `ReleaseDC`. Input is DirectInput
keyboard polling (`GetDeviceState`), so `--input=B:keydown:VK` reaches it.
Command: `--trace-api-counts`.

## Browser loading-stall report (2026-10-13)

User report `TG60-REVOLT-LOADING-20261013` shows loading
`models\\sphere.ncp`, EIP near `0x45a8xx` / `0x482c69`, and repeated ESI
`0x3f`. Original EXE SHA-256
`58ba4835e6607eae62be4e023ef989172cb519c78f34811acba547e9e0e3581a`
confirms the placement routine above: rejected separation branches at
`0x45aa17`; acceptance increments ESI at `0x45aa5a` and compares with 64
at `0x45aa65`. ESI 63 is consistent with the last object. Changing EIP or
random state alone does **not** prove that object will ever be accepted.
CRT `rand` at `0x482c69` updates its original state at guest `0x49bb88`.

Run `scratch/runs/20261013T2305Z-revolt-original-browser` used exact clean
source `a116a574c7411671b1042013b641ac0765471ef5`, an independent canonical
build (WASM SHA-256
`46c1e23aabca26de5e459f21463d3e1167f3a71d95e573ffedecefe7b31765f7`),
and all 443 original installed files plus the browser manifest verified by
hash. Registered browser route was
`index.html?app=re_volt_demo&debug&no-threads&d3d-renderer=webgl` on
`bx_yqnspudj`. Live controls confirmed WebGL, RLE/x87/uop enabled, Lazy Sync
enabled, and Threads unchecked, matching the report. Five-second samples
read registers and the random state; they did not write guest memory, change
the clock, restore a snapshot, or change random state/configuration.

Launch was 23:04:49 UTC; reviewed main menu was 23:06:18 (89 seconds).
Ordinary Enter selected Start Race, Single Race, default player name,
RC Bandit, Toys in the Hood 1, then the summary at 23:08:17. The log sampled
placement at 23:09:03, EIP `0x45aa1d`, ESI 62. It then passed that routine
and reached the reviewed starting grid at 23:09:24, about 67 seconds after
the summary confirmation and 276 seconds after launch. No sustained ESI 63
was observed in this run. `loading-003.png` is the starting grid;
`race-001.png` and `race-002.png` show later race timers 21.799 and 39.762
seconds after ordinary Up input, with the latter showing 8 mph. Up without
steering took the car off the intended route into a dark tunnel/wall area;
this is limited evidence of movement and input response, not a completed
lap or a separate physics/rendering diagnosis. Browser closed normally at
23:10:19; supervisor/driver/Chrome PIDs and groups were absent at 23:10:50.

The reported prolonged stall was **not reproduced**, and no emulator fix is
claimed. The user's exact loaded module, elapsed stall duration and random
state are unknown; a successful independent run does not establish that all
placements terminate. If it recurs, preserve the exact module and elapsed
ESI/random-state series before changing any optimization settings.
