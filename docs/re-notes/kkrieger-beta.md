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

The subsequent named-API run (`scratch/runs/20261014-kkrieger-browser-api/`, 21:27 UTC) reached Direct3DCreate9, GetDeviceCaps, CreateDevice, and repeated vertex/pixel shader creation before the same exit. These are call-entry traces, not returned HRESULTs; they do not establish shader support or the exit cause. The first trace attempt used an empty Set with an overridden `has`, which the host's `size` guard correctly disabled; the recorded follow-up uses a nonempty Set. Next capture API return/failure results using supported tracing before proposing an emulator change.

## Returned texture failure (2026-10-14, 21:50 UTC)

On source `43f04c7c4ac8914c385c37a7be96c7e1b9f61623` with the same canonical
module hash above, the supported EIP-return hook records `S_OK` from caps,
device creation, and the sampled first twelve vertex/pixel shader creations.
This narrows the failure; it does not qualify all shader execution.

The last-API ring then records three `CreateTexture` calls for 512×512,
Levels=0, Usage=0, Format=63, Pool=1, output `0x7ed20460`. A separate 90-second
return trace confirms `EAX=0x8876086c` (`D3DERR_INVALIDCALL`) at all three
return sites `0x80454d`, `0x804573`, and `0x804595`, before the same stop at
`0x801924`. Earlier calls at these sites returned zero; the failure is not
universal texture creation. The original 30-second trace ended during asset
generation, before the failing calls, and is retained as a timeout rather
than success. No guest memory or capability override was used.

The resource gate in `src/09ae-d3d9-resources.wat` rejects format63. The host
snapshot gate, GPU upload paths, and software snapshot gate likewise lack it.
Next implement the actual format storage and sampling contract, with creation,
lock/pitch, signed-channel, GPU and software conformance tests, then repeat the
original-game run. Simply admitting the enum would expose unsupported sampling.
The return trace establishes a concrete API failure before the stop; it does
not yet prove that fixing it alone reaches gameplay or why the runtime labels
the later stop as a normal exit.

Evidence folders under `scratch/runs/`: `20261014-kkrieger-browser-returns`,
`20261014-kkrieger-browser-exit`, `20261014-kkrieger-browser-texture-returns`,
and `20261014-kkrieger-browser-texture-returns-long`. The last includes the
reviewed blank end screenshot, complete log, probe and exact process receipt.

## Signed texture implementation and original-browser retest (2026-10-14)

Implementation `c79b943bbd8e02e5ee62c9bf00f48bb8c5897952`, based on main
`c851fff9c16096e6be6f480ebd40d8eb168c2e64`, supports format63 in texture
creation/capability checks, four-byte storage and mip locks, raw surface copies,
host snapshots, float GPU uploads (plain and mip atlas), and scalar/SIMD software
sampling. Little-endian U,V,W,Q map to RGBA with `max(signedByte/127,-1)` before
filtering. GPU cache identities distinguish format62 and63. WebGL1 synthetic
mip tails also decode signed bytes before averaging. This follows the signed
layout in [Microsoft's D3DFORMAT documentation](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dformat);
exact legacy-driver conversion rounding remains a native-reference gate.

Full build and conformance passed on isolated Boat `bx_tgbme2h7`: texture
creation/512-square ten-level locks, surface/cube updates, 331-case shader VM,
software backend and keyed residency, WebGL1/2 uploads and cache identity,
signed mip filtering, and the complete WAT→host→GPU pipeline. After reconciling
current main, the full build, WebGL versions test (including partial signed
mip tails), and complete pipeline passed again. Final tested module SHA256:
`2158338e146bb30e5f3fc628b64462935cfdc066ee149dfba7fce29bfefbe29f`.

The same original-executable 90-second browser probe now records twelve
`S_OK` returns each at `0x80454d` and `0x804595`; the error retry site
`0x804573` is not visited. The former early exit at `0x801924` is absent.
At 90 seconds the guest is still running procedural generation, displaying
a black loading screen with a partially filled progress bar. No menu, player
input, audio or gameplay acceptance. The next investigation is a longer
bounded startup capture, with loading progress and any subsequent failure
recorded explicitly.

Evidence: `scratch/runs/20261014-kkrieger-q8w8v8u8/` contains reviewed captures,
logs, the probe, full source patch against the remote checkout's base
`43f04c7c4ac8914c385c37a7be96c7e1b9f61623`, implementation patch and process
receipt. Chrome151.0.7922.108, Node24.18.1, WebGL with SwiftShader permitted,
cooperative/non-isolated browser route, original EXE hash unchanged. A first
fixture-only attempt hit the static server's external-symlink HTTP403 rule;
copying the three original fixture files into the isolated checkout resolved
that harness setup failure before the recorded runtime retest.

### Three-minute untraced follow-up

The same tested module and source were run for180 seconds without API/EIP
return tracing, retaining ordinary runtime diagnostics. The bar progresses
from a small filled section at60 seconds to visually full at180 seconds.
The process remains running without the former early exit, but there is still
no menu or gameplay. Final seven sampled lines repeat EIP `0x0081053e`,
ECX `0x6d84fb2c`, ESI `0x1b05`, yield0. This is an investigation lead, not
proof of a permanent hang or its cause. Next inspect that loop and its
termination condition before extending the same run again. No input was sent.

Root-reviewed evidence: `scratch/runs/20261014-kkrieger-q8-long/`, with three
screenshots, state samples, log, probe, source patch and process receipt
(2026-10-14T22:06:42.445Z–22:09:44.501Z). Harness exit0 only confirms orderly
capture shutdown; the startup route remains unqualified.

### Loading loop: non-closing mesh edge cycle (2026-10-14)

Read-only live memory inspection of the same original browser/module establishes
the immediate nontermination condition. Unpacked runtime code at `0x81050f`
iterates selected faces, starting with the edge index at face-record offset8.
Its inner loop at `0x810538–0x81054c` marks a vertex through helper `0x80e966`,
then calls `0x80e9c3` for the next edge, and repeats until ESI equals EDI (the
starting edge). The helper reads:

```
edgeBase = u32(mesh + 0x1c)
next(e) = u32(edgeBase + (e >> 1) * 48 + (e & 1) * 4 + 4)
```

Captured mesh ECX=`0x6d84fb2c` has4052 edge records at `0x6a3c3154` and2026
face records at `0x6a3b735c`. Face1722 (EBX=`0xa170`, 24-byte records) starts
at edge6904 (`0x1af8`). Its actual stored chain is:

```
6904 -> 8068 -> 6888 -> 6917 -> 6921 -> 6912 -> 6888 -> ...
```

The four-edge cycle excludes6904, so this traversal cannot terminate with the
captured topology. All those indices are in the allocated edge range. A bounded
30-hit supported EIP trace at the loop's call/return blocks confirms the live
interpreter returns precisely these next indices and repeats the cycle. The
prior repeated ESI=`0x1b05` is one of its members (6917), rather than a timer
or progress counter. Caller return address is `0x81077d`, immediately after
`0x810778: call 0x81050f` in the function starting `0x810764`.

This establishes malformed/non-closing topology at consumption, **not the
upstream cause**: no faulty emulator opcode, API, float calculation or original
game algorithm has yet been identified. No guest writes, forced loop exits,
capability overrides, runtime fixes or performance changes were made.

Next actionable test: trace mesh construction/mutation before entry to
`0x810764` and locate the first write that makes a selected face's edge chain
non-closing. Resolve the mesh/edge allocation dynamically in each run; the
addresses above are observations, not stable addresses to hardcode. In this
capture the suspect chain fields are preserved in `chain-analysis.json`.
Use the existing EIP hook and size-aware `set_watchpoint` diagnostics for a
bounded writer capture, then test the implicated instruction/API against its
real contract. Extending the startup timeout alone cannot repair this cycle.

Evidence: `scratch/runs/20261014-kkrieger-loop-condition/` contains the unpacked
128KB runtime image at guest `0x800000`, loop/helper disassembly, complete edge
and face arrays, registers/stack, chain analysis, 30-hit execution trace,
loading screenshot, browser logs and all capture scripts. The capture controller
was host-paused from22:15:30 to22:17:26 while Chrome/guest execution continued,
allowing a second read-only CDP client to capture the loop as reached; guest
execution was not paused or changed. The initial controller attempt was stopped
before its first sample to correct an export name in the capture script.
The successful original run ran22:14:05–22:18:26 UTC; first loop snapshot22:17:02.
The reviewed screenshot shows a loading bar filled approximately halfway;
no menu/gameplay/input/audio acceptance. The earlier description of a visually
full bar should not be used as a measure of completed procedural generation.
