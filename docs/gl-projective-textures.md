# Projective texture coordinates: Oni implementation contract

Oni's New Game reaches unimplemented `glTexCoord4f` (API4430, vector form4431).
The captured scalar argument bits are `3a8c1452,3bb71048,00000000,3bb727be`:
q is not1. Evidence: `scratch/runs/20261011T1719Z-oni-webgl/browser-start.log`.
The browser WebGL menu already renders with the filename-case fix7b088a123;
the software gray-menu issue is independent. No API implementation is included
in this document.

## Correctness constraints

Carry homogeneous `(s,t,r,q)` through the texture matrix and vertex stream.
For a fragment, use interpolated S/Q and T/Q. Dividing at each vertex and
then interpolating is wrong. With clip-space vertex w, the rasterizer needs
interpolated S/w and Q/w (and T/w), independently for each texture unit.
Do not alter vertex position w to approximate texture q: that changes other
interpolants. Preserve existing API IDs and existing packed field offsets.

Current main480dc72e0 has the15-float vertex record from9be0a0efb; do not base
the fix on the older14-float source used in the first Oni diagnostic boat.
One possible appended layout is19floats: existing15, then r0/q0/r1/q1.
All producers, consumers, snapshots and stride checks must agree.

## Paths to update together

- `src/api_table.json`, dispatch generator GPU opcode map and generated tables:
  route4f/fv only after their implementations exist; retain fail-fast otherwise.
- `src/09a8c-gl-encoder.wat`: current texture components, packed vertices,
  copying/chunking/stride calculations, immediate and replay paths.
- `src/09a8e-gl-state.wat`: context save/reset/restore, current attribute stack,
  array defaults and four-component array reads.2f/fv must reset r=0,q=1.
  Audit display-list compile versus execution semantics.
- `lib/gl-command-stream.js`, GL host/worker consumers and `lib/gl-compat.js`:
  stride, attributes, full texture-matrix input, homogeneous varyings, fragment
  division, and border-sampling shader variants for both units.
- `src/09a8g-gl-raster.wat`: clip/interpolation records and separate texture-q
  planes, preserving depth/color/fog interpolation. Existing texture-matrix
  code divides per vertex, so do not extend that approximation to this API.

## Required regression

Render a screen-aligned quad with left `(s,q)=(0,1)` and right `(3,3)` using
a texture whose color boundary is u=0.5. Correct projective sampling crosses
at x=1/4 of the quad; a per-vertex-divide shortcut crosses at x=1/2. Test
both WebGL and software, and both scalar/vector API calls. Include q=1
baseline,2f resetting q, nonzero r under a texture matrix, state restoration,
and client-array/list paths. Test against the old implementation to establish
that the new case fails there. Run existing projective-vertex tests as well.

Then rebuild on a temporary boat with the filename-case fix, repeat the
ordinary Oni menu/New Game/Start route, and verify actual player movement.
Do not equate clearing the API trap with correct rendering or gameplay.

## WebGL texture-matrix prerequisite verified

The browser shader now carries matrix-generated S/T/Q and divides in the
fragment shader, including both texture units and the GL_CLAMP border path.
Extended test-gl-projective-web tests the quarter-width boundary (16/64),
independent position w and texture q (32/64), q=1 reset, WebGL1/2 and both
sampling paths. Old source fails with boundary11; all26 fixed cases plus
16 existing border checks pass. Evidence: scratch/runs/20261011T1846Z-oni-projective-matrix.

This does not implement glTexCoord4f/4fv, change the packed ABI, or fix the
software rasterizer. Those remain required before Oni can pass its trap.
