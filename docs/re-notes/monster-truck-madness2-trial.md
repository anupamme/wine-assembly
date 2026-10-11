# Monster Truck Madness 2 Trial (Terminal Reality / Microsoft, 1998)

Candidate `monster-truck-madness2-trial` (not yet registered: its race
draws but the truck does not respond to controls yet). `Monsterx.exe` is a statically linked MFC 4.0 MDI app
(`AfxFrameOrView40s`, `AfxMDIFrame40s` classes). Its UI frames are
`CMDIChildWnd`s whose views are `CFormView`s, created as dialogs.

## Licence

`eula.txt` in the package is the Microsoft trial EULA. It allows
non-commercial redistribution of complete copies, with the EULA attached; the
grant is the same as Midtown Madness Trial's.

## Install layout

archive.org `MonsterTruckMadness2_1020`, `MtM2trial.zip` (SHA-1 `d12c783a…`).
It holds `MtM2trial.EXE`, a self-extractor that `7z x` unpacks directly into
`Monsterx.exe`, the `.pod` archives, `Monsterx.ini`, `eula.txt`, the help
files and four renderer DLLs:

| DLL | Renderer | Imports |
|---|---|---|
| `Trid3d.dll` | Direct3D | DDRAW (static import of the exe) |
| `Triglide.dll` | 3dfx Glide | glide2x.dll |
| `Trirend.dll` | Rendition Vérité | redline.dll, verite.dll |
| `Trinec.dll` | PowerVR | sgl.dll |

`Monsterx.ini` `[Graphics]` defaults to `useDirect3D=0` and
`rendererDLLPath=C:\METAL2X\triglide.dll`, which selects the software
renderer.

## Startup sequence (headless, `--batch-size=50000`)

1. A MessageBox-style dialog says the display has "more than 256 colors". OK
   continues (`keydown:13` at batch 40); Cancel exits.
2. The frame `0x10001` and the MDI client open, then MDI child 1 `0x10003`
   with form view `0x10004`. After OK, child 2 `0x1000b` gets form view
   `0x1000c`.
3. The shell screen ("Trial Version", menus Race/View/Options/Help) appears
   by about b120. It is magenta-tinted under our 32-bit desktop (palette,
   not investigated). Left idle, it auto-starts the attract demo, "Farm Road
   29": "Loading terrain database" at about b540, frames from about b1100.
4. **Software renderer = DISPDIB mode 13h** (works since ad1b472f5). After
   "Loading additional graphics" it creates a `DisplayDibWindow` (our
   `src/09d5-dispdib.wat`), sends `WM_COPYDATA{dwData=0x400, cbData=0x428}`
   (a top-down 320x-200 8bpp BITMAPINFO plus palette; 0x5439a0, again at
   0x4200db/0x4207c2 for palette changes), then `0x403`, and tests both with
   `test eax,eax / jnz` into "Unable to start DisplayDIB Mode" (0 =
   DISPLAYDIB_NOERROR, e51182ad3). It then `SetFocus`es that window and
   writes each frame **straight to linear 0xA0000** with no API call:
   `rep movsd` of width x height from the back buffer `[0xaad3a0]` (a DIB
   section) at 0x543cba; a 320x400 mode would take the Mode X path at
   0x5a1450 (`out 0x3C4` map mask, page flip by `xor [0x657aa4], 0x8000`),
   which nothing implements. 0x543154 probes `[0xA0000]` under SEH first;
   `[0x9a2adc]` = "DISPDIB mode on", `[0x646cd8]` = the display HWND.
   `0x402` (DDM_CLOSE) is sent on exit (0x54515b).
5. **Options → Graphics…** (Alt+O, R) probes the renderer DLLs. `Trinec.dll`
   (sgl.dll) and `Trirend.dll` (redline.dll) now fail to load with
   ERROR_MOD_NOT_FOUND, as on Windows (058a8d830); `Triglide.dll` loads.

## Reaching a race (headless)

```
--input=40:keydown:13,42:keyup:13,330:mousedown:565:465,333:mouseup:565:465,
        560:mousedown:565:465,563:mouseup:565:465,850:mousedown:457:306,853:mouseup:457:306
```

OK on the 256-colour box → the shell's bottom-right start button (Driver
Check-In) → GO → OK on "Before You Begin" → the race draws from about b1700:
in-cab view, HUD, minimap. Evidence:
`scratch/runs/20261011T0535Z-monster_truck_madness2_trial-dispdib-race-claude1863`.

**Open: the truck does not drive.** With Up held from b1700 the speedometer
stays near zero and the lap timer at 00:00 through b2600. What is known:

- The race loop is PeekMessage → TranslateMessage → DispatchMessage. The
  DisplayDibWindow now passes WM_KEYDOWN to its owner, the view `0x10036`
  (an MFC `AfxFrameOrView40s`), whose message map does not handle it:
  CWnd::Default → `CallWindowProcA`. So the race does not steer from key
  messages.
- During the race (b1850-1950, all threads) the only calls are TLS/LastError,
  a mutex pair, QueryPerformanceCounter, Sleep, DirectSound position,
  timeGetTime, and once a frame `PeekMessageA`, `SetCursorPos`,
  `GetWindowRect`. No `GetKeyState`, `joyGetPosEx` or DirectInput call.
- The exe imports `DirectInputCreateA` (DINPUT), `joyGetPosEx`/`joyGetPos`/
  `joyGetNumDevs`/`joyGetDevCapsA` and `GetKeyState`. `Monsterx.ini [Control]`
  has `joystickActive=0`, and `[Keys]` maps scan codes plus VKs
  (`keyAccelerate=72` / `_VK=38`, brake 80/40, right 77/39, left 75/37).
- "Before You Begin" prints "Your controls are set to" with an **empty**
  device name: the control setup found nothing, which is probably why no
  input API is ever polled. Next: find where that name comes from (Options →
  Controls, the DirectInput keyboard enumeration) before touching the race.

## The empty view list (fixed 2026-10-11, f54d8df3d)

The crash right after the 256-colour prompt was `CObject::IsKindOf(NULL)`
(`0x5d7a12`, called from `0x545080`). `0x545080` walks the views of the
document stored at `[app+0xc0]` (app object `0x749a38`):

- the document is `0x01056314`, vtable `0x60c310`;
- `GetFirstViewPosition` is `+0x64` → `0x5e22bc`, which reads the view list
  head at `+0x2c`;
- `GetNextView` is `+0x68` → `0x5e22c0`.

The views never registered because our CreateDialog CBT path skipped
`WM_CREATE`, and `CFormView::OnCreate` is where `AddView` happens.

Other addresses:

- `CMDIChildWnd::Create` returns from `WM_MDICREATE` at `0x5f176d`.
- The view `CCreateContext` is at `0x074ffe34`: view class `0x644a78`,
  document `0x01056314`, template `0x010408cc`.
- `[app+0xc0]` is stored at `0x542713` in InitInstance, called through
  `0x42cac6`.

Breakpoints after an indirect call (for example `0x5450af`) do not fire,
because they are not block entries. Use `--count` on branch targets and
`--watch` with `--watch-start-batch`.
