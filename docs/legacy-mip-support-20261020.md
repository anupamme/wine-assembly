# Legacy mip continuation: MIPLINEAR

Base: fetched main `ee3a71e3398a98a360d02c25d02bfeb544f0e14f`, including
combined correction `fbf684a1796e47a0aa5c1552bb38dd743cd3c16a`.
The first demonstrated remaining defect is MIPLINEAR (`0x08`).
Only `fill_primcaps.dwTextureFilterCaps` changes: `0xFB` to `0xF3`.
DX7 builders inherit this as `0x030003F3`. NEAREST/LINEAR, DX7 MINF/MAGF
POINT/LINEAR, the prior cube/address corrections, and all other caps remain.

The [Microsoft D3DPRIMCAPS contract](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps)
requires mip-level selection and within-level bilinear sampling for MIPLINEAR.
The saved SDK headers in the evidence identify its cap as `0x08` and legacy
`D3DFILTER_MIPLINEAR` as **4**. Stage filter enums differ: value 4 is not used
as a MIPLINEAR request in the stage-state fixtures.

Implementation evidence is stronger than those names: the filter-selection
block inside `d3dim_draw_tl_triangle_textured` sets `linear` only for value 2.
The exported `d3dim_gpu_describe` independently writes the same boolean.
`d3dim_texture_sample_keyed` takes one bound image and no chain, derivatives
or LOD; its zero-linear branch takes one point tap.
`lib/d3dim-gpu.js` turns that boolean into point min/mag and sets `mip: 0`.
The legacy MIN-only request (offset 328, stage filters and legacy MAG zero)
therefore fails even the within-level bilinear requirement. No claim about
automatic LOD is needed to establish this defect.

`node test/test-legacy-mip-support.js` executes extracted production WAT and
the actual JS sampler assignment:

- 36 state cases: legal point/linear stage controls and legacy point/linear/
  MIPNEAREST/MIPLINEAR controls, each with stage MIPFILTER 0/1/2.
- Two explicitly bound images (4x4 black/white and 2x2 red/blue checkerboards),
  instrumented fixture fetches, and actual production addressing/bilinear
  helpers. LINEAR blends four taps to gray/purple; MIPLINEAR takes one black/red
  point tap. These are distinguishable image fixtures, **not a simulated
  automatically selected mip chain**.
- 90 filter fields across HAL/HEL enumeration builders and GetCaps 1/2/3/7,
  both primitive kinds, aligned/unaligned storage, descriptor sizes and guards.
  Enumeration dispatch-to-builder wiring is checked; callbacks are not executed.
- Seven mutation negatives: re-advertised MIPLINEAR, restored MIPNEAREST,
  missing point, missing linear, unrelated filter clearing, changed GPU mip
  lowering, and changed software filter selection.
- The unchanged fetched-main baseline passes the backend observations but
  fails specifically because it advertises MIPLINEAR.

This is extracted-source qualification with fixture state/fog/fetch boundaries.
No full draw, native COM dispatch/callback, actual GPU render, game, canonical
build or leased runtime was executed. The previous filter task's actual receipt,
contract log, test and source were read before extending this fixture.

Scope stops here. Remaining legacy `0x10`/`0x20` claims are not qualified by
this task; reserved bits are untouched. Modern mip-stage bits were already
absent. No other GL/D3D capability audit was performed.

Evidence and standalone replay:
`scratch/runs/20261020-legacy-mip-support/README.txt`.
Only the filter mask and this uniquely named test/document are owned.
Before integration the coordinator must reconcile existing exact-mask assertions
in `test-legacy-cube-caps-contract.js`, `test-legacy-texture-remaining-caps.js`,
`test-legacy-texture-filter-caps.js`, and
`test-d3d-device-enumeration-lifetime.js` from FB to F3 (including DX7).
The evidence runs the old source suites with that expectation-only adjustment
in isolated copies; it does not modify those shared test paths or claim a native
enumeration pass. Main integration remains coordinator-owned.
