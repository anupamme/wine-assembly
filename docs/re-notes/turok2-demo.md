# Turok 2 demo: source and launch layout

Source: https://archive.org/details/turok2demo, `turok2demo.exe`,
23,873,852 bytes, SHA-1 `d985ae568ad2f5dfc50f7592681ba10201278020`.
Downloaded and hash-verified on boat bx_9xcsfw7s on 2026-10-11.

The outer executable is a ZIP self-extractor. Extract it with 7z, then use
current-main `tools/is-cab.js <extracted-directory> --extract=<game-directory>`
on its InstallShield 5 cabinet/header pair. This extracted 21 files without
errors. The game `Turok2Demo.exe` SHA-256 is
`478e2cf70395a54422bbb4dafd5229905e2777b37b32677b2cd6884b9f500a2c`.
The README describes the demo and retail options, but no redistribution grant
was established. No installer approval was answered or public deployment made.

The raw cabinet extractor places the resources beside the executable. A launch
then displays `Can't find level set file "data/Turok2Demo.lss"`.
Copying the unchanged `.lss`, `.lsm`, `.spc`, `.bpc`, `.bmf`, `.dat`, `.dft`,
`.mnu`, `.11k` and `.11c` resources into `data/` clears that message and reaches
the main menu. This is a measured provisional layout, not a reconstruction of
every installer action. Preserve the original extracted tree.

Evidence: `scratch/runs/20261011T1423Z-new-game-refill/turok2demo/`.
After restoring missing `stdole2.tlb`, the retained IW diagnostic runtime and
a fresh full build of main `3cf8095385f2ecb4ceb7a8043ee0e452bd1eafa4` both
reach the menu. Their menu PNGs are byte-identical. Main WASM SHA-256 is
`8bbd5421028fafccf89a3fd29cd02a67d7fe116e11def181ca5f1bcc93736555`.

Ordinary mouse input at `(320,216)` selects Single Player and displays
`Building Texture File...`. The 400-batch capture is loading, not gameplay.
Use `--stuck-after=0` for an input replay: the default stuck detector exits an
idle menu before later scheduled input. The tested schedule is mousemove at
batch 30, mousedown at 35 and mouseup at 40, with 100,000-block batches.
No gameplay, FPS or audio qualification yet. Native comctl32.dll/ole32.dll
absence is logged; neither has been established as causal.

The extended current-main run clears texture preparation and selects the
Glide3 renderer (`T2-Glide3 v1.0`), then traps on `_grEnable@4` with argument 2.
`src/09a8h-glide.wat` intentionally fails unsupported Glide3 enables; do not
turn this into a silent-success stub. This is the first demonstrated loading
blocker, not missing level data. The next actionable checks are the game's
ordinary Video settings for its bundled Direct3D renderer, and the precise
semantics of the requested Glide3 feature if that route is retained.
`loading.log` and `loading-receipt.json` preserve the failure; no final PNG was
written after the trap. No approval input was sent.

## Ordinary Video settings route (2026-10-11)

On current main, click Options at `(320,328)`, then Video at `(320,254)`.
The Options screen renders correctly, but Video opens a blank white dialog;
no renderer selector is visible. Restoring the original shared comctl32.dll
(SHA-256 `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`)
does not change that visible result. Do not report Direct3D selected or guess
coordinates for invisible controls. The next step is the Video dialog's
initialization/painting, or genuine Glide3 enable support.

Reviewed images and receipts are in
`scratch/runs/20261011T1436Z-new-game-continuation/`:
`turok2-options.png`, `turok2-video.png`, and
`turok2-video-common-controls.png`. Runs are CLI-only, not browser validation.
The fork omitted the build, stdole2.tlb and some Node dependencies; the final
image runs follow a full build, restored TLB, and a clean dependency install.
Earlier no-image attempts are retained as harness failures, not game evidence.
