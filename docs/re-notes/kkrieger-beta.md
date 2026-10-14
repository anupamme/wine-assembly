# .kkrieger Chapter I beta

Original .theprodukkt Windows game, Breakpoint 2004. User TG73/74 identified the title.

## Recoverable package

Source: https://files.scene.org/view/parties/2004/breakpoint04/96kgame/kkrieger-beta.zip

Download: https://files.scene.org/get:fi-https/parties/2004/breakpoint04/96kgame/kkrieger-beta.zip

Archive: 102042 bytes; SHA-1 f46b0fd0e777c33c79e16cb5453db8b0b4bfb91b; SHA-256 0de0b9abafd78cf7f57fb264c7136ace52b2653f5c675574d0f10eda0a654c9f.

Recover with `node tools/fetch-candidate-corpus.js --id=kkrieger-beta`. Extraction preserves all three archive members under game/. Preserve the original archive separately for redistribution; Git does not retain ignored binaries.

| Member | Bytes | SHA-256 |
|---|---:|---|
| pno0001.exe | 97280 | ac2192b740c57125067a29d2e0ea6d95b222543398188c5f67bbf01157622685 |
| readme.txt | 5504 | c3779b09917a72664c89c7805c45f4cf45ee89a881649a44acb3581bc8f0f269 |
| scene.org.txt | 2714 | 0fd9764f56d835e0f3dd6209737bce241881902e6aa3ead91f2d02ad9d34b1c0 |

The archive readme permits spreading the original unmodified archive without charging for the game and requires credit to .theprodukkt for public presentation/publication. This record is not permission to repackage stripped files. The scene.org archive includes its archive notice; it is preserved unchanged.

## Compatibility scope and evidence

2026-10-14: fresh pinned download and extraction succeeded on baseline 38ed9da0b plus recovery fix14cc377a7; generated browser companion manifest and executable presence verified. No guest execution or gameplay acceptance yet; no desktop promotion or deployment.

Readme requirements: DirectX9.0b, pixel shaders1.3,512MB RAM. Packed procedural-generation startup may be substantial; no timing measured. Controls: WASD movement,Space jump,left mouse fire,1–5 weapons.

Corpus CLI dry-run currently fails before selection on an unrelated existing Baldur's Gate interactive-demo source assertion (test expects bg-demo/BG Demo.iso, manifest uses Silver Edition ZIP). Neither entry changed here. Resolve separately before using that broad harness.

## Separate-box startup check (2026-10-14)

Clean main `9ab60e86c2108a841b437e3aa3bd1b2b4ae031d3` built successfully on temporary Boat `bx_tgbme2h7` through the documented exec API. Module SHA256: `e6ac188dd8c7b16d04eaa4b74446ab2c4ab211422738709e33cffda5db444e7e`. Fresh original package acquisition passed. SSH was not used.

The direct CLI smoke lacked a GPU window and repeatedly reported `D3D9 requires a GPU window`; it was stopped rather than treated as a game failure. A separate headless Chrome run used the normal browser backend and a temporary in-page app entry pointing at the original executable and its companion files. No guest patch or capability override was applied. The page reported non-isolated threading; SwiftShader was allowed by Chrome's launch flags.

The browser created the `kk` window, then the guest exited before a visible menu. At the 30-second capture the desktop was blank and the runtime log showed a guest exit at `0x00801924`, preceded by `0x0080191f`. Exit reason remains undiagnosed; a zero harness exit is not game success. No player input, gameplay, audio or FPS acceptance.

Evidence: `scratch/runs/20261014-kkrieger-browser/` contains the probe, build/browser logs, three screenshots, state captures and dashboard result. Existing corpus browser/CLI configuration already supplies a launch route; no duplicate registry entry or desktop promotion was added. Next: a bounded original-browser startup run with named Direct3D9/API failure tracing to identify the early-exit condition.
