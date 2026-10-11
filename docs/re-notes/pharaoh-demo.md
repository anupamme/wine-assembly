# Pharaoh demo

Impressions' 1999 city builder, built on the Caesar III engine family
([caesar3-demo.md](caesar3-demo.md)). Registered as `pharaoh_demo`.

## Payload

`test/candidate-corpus/manifest.json`, id `pharaoh-demo`:

```text
archive.org PharaohDemo/PharaohDemo.zip (SHA-1 e09b5f04...)
  -> InstallShield 5 media (data1.cab, built 1999-08-10)
  -> tools/is5-extract.js (fetcher step is5Extract) -> installed/
     PharaohDemo.exe + SMACKW32.DLL + mss32.dll + binkw32.dll + data (305 files, ~121 MB)
```

The cab's common header carries version 0x01000004, the early IS5 layout
`tools/is5-extract.js` was written for (Heretic II). It yields the same 305
files and 121 MB as `unshield -g Executable`, needs no host unshield (the ops box has none),
and checks every file against its recorded expanded size. The fetched candidate
is about 207 MB on disk (86 MB of installer media plus `installed/`); the zip
itself only lives in the fetcher's temp directory.

Licence: the Sierra demo EULA shipped in the package (EULADEMO.txt) grants a
single-user licence and forbids copying or reproduction, so the candidate is
`localOnly`.

`SMACKW32.DLL` and `mss32.dll` are listed as app DLLs; `binkw32.dll` is
loaded from the install directory by the normal import path.

## Speed

At the CLI's default block budget the title takes thousands of batches and
looks frozen (uniform frames, a few hundred API calls). Pass
`--batch-size=100000`: the title screen appears at about batch 2000.

## Route to a growing village (batch numbers at --batch-size=100000)

Each click is a mousemove, a mousedown, and a mouseup about 25 batches later.

| Batches | Action |
|---|---|
| 2050-2075 | (320,300) title "Click to Start" |
| 2450-2475 | (320,138) Play Demo |
| 2850-2875 | (320,138) Predynastic Period |
| 3500/3510 | keydown/keyup 13: accept the default name |
| 3900-3925 | (484,398) briefing "Nubt: A Village is Born", To the city |
| 4400-4440 | (499,283) Build Roads |
| 4520-4650 | drag (100,300) to (420,300): a road |
| 4800-4840 | (499,243) Build Housing |
| 4860-4960 | drag (160,318) to (340,340): housing plots beside the road |

Result: immigrants walk in along the road, and the population grows from 0 to
39 (April) and then 60 (June 3500 BC) with the huts occupied by about batch 9000.

Housing plots with no road access disappear, so build the road first.

## Sidebar buttons (640x480, construction panel)

Hover over a button and its tooltip names it:

| y \ x | 499 | 529 | 561 | 593 |
|---|---|---|---|---|
| 243 | Housing | Farming and Food | Entertainment | Health and Sanitation |
| 283 | Roads | Industrial | Religious | Municipal |
| 322 | Clear Land | Storage and Distribution | Education | Military |
| 363 | Undo | View Messages | Cycle trouble spots | (fourth button) |

Evidence: `scratch/runs/20261011T0730Z-pharaoh-w6/`.
