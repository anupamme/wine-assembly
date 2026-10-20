# Army Men same-surface BltFast conformance, 2026-10-20

Base: `origin/main` fetched and resolved to
`515897841fde86f9b2e0274387aff10cc9add405`. Isolated sparse worktree:
`/tmp/wa-army-bltfast-oct20`, branch `task/army-bltfast-conformance-oct20`.
No shared HEAD/index changes, workers, game rerun, browser, full build, binary
copies, deployment, Claude panes, laptop scheduler or Heroes II changes.

## Result

The baseline production no-color-key row loop passes all **192** cases using
the eight traced geometries (each separately and in a synthetic sequence,
at four pixel sizes and three pitches). It fails a separate **downward**
same-surface overlap control. Top-down row copies overwrite the next source
row before reading it. Per-row `$memcpy` uses overlap-safe `memory.copy`, so
horizontal overlap within a row is already protected.

The change copies bottom-up only when the backing pointers are equal and the
destination starts below the source within its vertical span. Upward,
horizontal, identity and vertically disjoint copies retain their row order.
The changed production row body passes **276** snapshot cases. This is a
demonstrated synthetic overlap bug, **not an explanation or fix claim for
Army Men's visible stripes**: every captured copy moves upward.

## Original evidence and boundaries

Read retained `scratch/runs/20261019-army-men-scroll-entry-remote-v1/`:
`review.json`, `child.json`, `controller.js`, `pins.json` and trace plan.
Controller SHA-256:
`7c70e72d68cb2d7c2b184c557178e00892bc2938c84fa6d85c3f38a0ddf6ffa7`.
Pinned historical module:
`7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33`.
The historical controller records child43272/controller42566 and original
pre-push observations, not current execution or a BltFast return value.

Same source/destination `0x08221080`, flags `0x10`; source rectangles:
`(3,1,640,386)`, `(4,1,640,386)`, `(5,1,640,386)`, `(4,2,640,386)`,
`(3,2,640,386)`, `(2,2,640,386)`, `(1,3,640,386)`, `(0,3,639,386)`.
Destination `(0,0)` except final `(1,0)`. Pitch, pixel format, backing pointer
and returned HRESULT remain unknown. No pitch was inferred from an image.
The synthetic sequence omits intervening guest rendering and is not a replay.

The [Microsoft BltFast reference](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdrawsurface7-bltfast)
describes source-copy/color-key transfers and excludes clipping. These cases
are valid, in-bounds, no-color-key copies; they do not extend clipping,
color-key, compression, aliasing-between-distinct-objects or error semantics.

## Test architecture and proof

`test/test-directdraw-bltfast-overlap.js` uses only Node built-ins. It extracts
and interprets the actual folded WAT no-color-key row body, with explicit
supported operations and an execution budget. `$memcpy` maps to overlap-safe
`Uint8Array.copyWithin`; a source assertion checks the production primitive
still uses `memory.copy`. This avoids testing only a handwritten model of the
implementation, but is **not compiler or full-handler runtime validation**.

The oracle independently maps destination pixels from an immutable pre-call
snapshot, including each byte of multi-byte pixels. Two literal pixel matrices
check the oracle for horizontal and downward overlap. Entire buffer comparison
also checks row padding, untouched pixels and allocation guards.
Fixtures use synthetic 640x386 surfaces, bytes/pixel 1/2/3/4 and pitches
`640 * bytesPerPixel + {0,4,28}`. None is asserted to be Army Men's actual pitch
or format. Additional controls exercise left, right, down, down-left,
down-right, identity and vertically disjoint copies.

Baseline reproduction, using the new test against the old source:

```sh
git show 515897841fde86f9b2e0274387aff10cc9add405:src/09a8-handlers-directx.wat > /tmp/army-bltfast-baseline.wat
node test/test-directdraw-bltfast-overlap.js /tmp/army-bltfast-baseline.wat
```

Expected baseline result: 192 traced-geometry cases pass, then exit1 at
`down/1/0`, byte1312, actual165 versus expected254. This corresponds to the
second destination row reading an already overwritten source row.

Current source:

```sh
node test/test-directdraw-bltfast-overlap.js
node tools/check-wat-fragments.js src/09a8-handlers-directx.wat
node tools/check-parens.js src/09a8-handlers-directx.wat --no-diff
node tools/check-wat-logical-and.js
node --check test/test-directdraw-blt-clipping.js
git diff --check
```

All pass. The label checker reports existing large-depth-change warnings,
with balanced parentheses and labels in scope.

`test/test-directdraw-blt-clipping.js` already uses `bootRenderHarness`, which
compiles the full module. Its fixture now supports padded pitch and adds five
actual BltFast same-surface cases with flags0x10, full pixel/padding snapshots
and HRESULT assertions. **Only syntax checked here**: running it and normal
build gates is pending a separately admitted full VM validation lane. No
gameplay or performance claim follows from the source-level tests.

Small evidence and check receipts:
`scratch/runs/20261020-army-bltfast-conformance/receipt.json`,
`baseline.log`, `conformance.log`, `fragments.log`, `labels.log`,
`logical.log`, `syntax-conformance.log`, `syntax-runtime.log`, `diff.log`.
The receipt records input/source hashes; Git retains tests and this recovery
recipe, not ignored run evidence. Free disk at the receipt was 2,318,901,248
bytes, above the 2GiB floor.

## Next diagnostic, requiring a new assignment

First run the authored full-handler regression in an admitted environment.
For Army Men itself, a future bounded diagnostic should observe the same
actual call at handler entry and return: surface identity, resolved backing,
width/height/bpp/pitch, source RECT/destination/flags, returned HRESULT, and
small pre/post pixel samples that distinguish a packed row from a pitched row.
Compare bytes against a pre-call snapshot before attributing corruption to
BltFast. Include the first sample before the copy to detect pre-existing
corruption. The existing pre-push trace alone cannot establish that the copy
executed successfully or that incorrect bytes originated in this handler.
No such runtime was performed or authorized in this assignment.

## Runtime context verification limitation

Before source edits, read `~/.codex/AGENTS.md`, project `CLAUDE.md`, app notes
and latest messageboard. Runtime session ID:
`01a158cb-20d2-7981-b2fd-fd8339d624f3`. Read-only `logs_2.sqlite` queries found
no per-thread compaction/200000 records; a bounded recent-global query only
showed coordinator48000 `BodyAfterPrefix` rows. Thus **200000 total could not
be verified from available runtime evidence**. This limitation was appended
to the shared messageboard before edits. No config-only verification claim
or repeated probing followed.
