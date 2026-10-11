# Hellbender Trial (Terminal Reality / Microsoft, 1996)

App `hellbender_trial` (candidate `hellbender-trial`, localOnly), trial
version 1.02. Registered 0b50d6ea1. `HELLBNDX.EXE` is an MFC app that statically
imports `SMACKW32.DLL` and COMCTL32 and also references DDRAW, `DISPDIB.DLL`
and WinG.

**The licence forbids reverse engineering or disassembly**, so everything
here comes from API traces and runtime behaviour. Keep it that way.

## Licence

README.DOC section A: "Reproduction and/or redistribution of this trial
version is permitted for non-commercial, personal, and testing purposes
only." (Plus the no-reverse-engineering clause.)

## Install layout

archive.org `Hellbender_1020`, `heltrial.zip` (SHA-1 `175117d9…`), holding
`heltrial.exe`, an IExpress package that `7z x` opens. `HELLINST.INF` copies
`HELLBNDX.EXE`, `.HLP`, `SMACKW32.DLL` and `README.DOC` to the install dir and
the PODs, `HELLBNDX.INI`/`.INF` and the three DirectPlay DLLs to
**`<install dir>\System`**. The game reads `.\system\hellbndx.ini` and opens
`system\startupx.pod` / `system\gamex.pod`; in a flat tree it shows
"Insert Hellbender CD into the installation CD-ROM drive." The manifest's
`copyFile` steps rebuild that layout.

`HELLBNDX.INI` ships `useDirect3D=0`, so the registered route is the software
renderer. `[Control]` keys are scan codes (up 72, down 80, left 75, right 77,
fire 57 = space, weapon 33).

## Route (headless, `--batch-size=50000`)

1. Quick Configuration dialog by b100. Click **New Game** (368,302) at b200.
2. A ship-schematic loading screen; its bar is full by about b600, then it
   waits.
3. A key or click (space at 700, click at 800, Enter at 900) starts the first
   mission: a cockpit view down a canyon, with radar and HUD. Holding Left
   (b1100-1250) banks the craft.

Evidence: `scratch/runs/20261011T0715Z-hellbender_trial-gameplay-claude1863`.

## Open

- **Quick Configuration artwork.** The six buttons are 132x40 slices of
  132x160 8-bit DIB sections built from the PODs, then `BitBlt`'d `SRCCOPY`
  into each button's DC. Their corners show the magenta key colour. The
  dialog's 560x420 8-bit background DIB (created at the same time) is never
  drawn, so the top half of the dialog is blank grey. The game calls
  `GetSysColor(COLOR_BTNFACE)` and `SetDIBColorTable(…, 0, 256, buf)` for
  each DIB, so the key colour is probably meant to be replaced in the colour
  table. Not confirmed: the tables are built in stack buffers that one
  debugger command per run could not capture.
- **Idle repaint flood.** The dialog `InvalidateRect`s hwnd 0x10016 and loops
  on PeekMessage: about 37M API calls over 1500 idle batches.
- Not looked at: the Direct3D renderer (`useDirect3D=1`), DISPDIB / WinG
  use, sound, the browser.
