# Invisible War renderer candidate review — 15 October 2026

Review base: `343befcb182f3582a3214df5636c49f1176b435e` (includes the
`e86bf1640` production changes). This branch is a held adaptation, not an
integration or a runtime qualification. No build, GPU, browser, guest, or Boat
operation was run. Cross-process transport and shared task ledgers are untouched.

## Finding and bounded correction

Do not cherry-pick `1d5243e237ddb27837ee4a3c1c0aa281006468ec` unchanged.
`lib/d3d9-fixed.js` terminates the cascade when `colorArg1 === 2` and texture
zero is absent, including when COLOROP is SELECTARG2. Initial diffuse RGB then
remains the final visible RGB. The held candidate sees the nominal independent
arguments and replaces that initial diffuse with zero anyway. With RGB mask 7,
SELECTARG1(TEXTURE), SELECTARG2(TFACTOR) with ARG1=TEXTURE, and
MODULATE(TEXTURE,TFACTOR) all become black rather than preserving diffuse.
With a position-only vertex shader it can additionally hide a genuinely live
missing-color linkage error. This is not merely a dead-alpha optimization.

The adaptation retains both original backend changes and adds one exclusion
matching the compiler's exact missing-ARG1-texture termination rule. It does
not invent a texture result or relax the compiler's validation. A subsequent
change to cascade termination must update this exclusion and the regression.

## Discard, alpha, depth, and stencil review

The colorless candidate `7b89c446c0b1a81ec88b271282cec70d78a25138` has no
additional source correctness blocker found under its conservative guards:

- Replacement is after real fixed-function/shader compilation. It applies only
  to fixed pixel programs with color mask zero and excludes alpha test, color
  key, outline coverage and fog. Current fixed pixel lowering has only alpha
  test and sampled stage-zero key discard; it does not write fragment depth.
  Projected-coordinate invalidity sanitizes a sample, without discarding.
- The replacement fragment program neither discards nor changes depth. Existing
  depth comparison/write, stencil fail/depth-fail/pass and masks remain in the
  backend's unchanged state setup and draw path. These are source observations;
  actual coverage and stencil results require WebGL verification.
- Fixed alpha test is emitted from `draw.fixedFunction`; the production D3D9
  host mirrors its render-state alpha test there. The separate `draw.state`
  wrapper applies to guest pixel shaders, which both optimizations exclude.
  This patch does not redefine inconsistent diagnostic-only state snapshots.

The RGB candidate retains the original no-alpha-test, no-specular, one-stage,
CURRENT-result, alpha-masked, alpha-op-disabled and independent-input guards.
Supported source-alpha blend factors 5, 6 and 11 are excluded in either blend
slot whenever blending is enabled. Source/destination-color factors only
consume the RGB being preserved. No separate-alpha blend path exists in this
backend. Unsupported blend factors still fail the unchanged later validation.
TEXTURE/TFACTOR/CONSTANT alpha-replicate/complement modifiers remain independent
of diffuse. Key discard is safe to retain for this rewrite because it consumes
sample alpha, not initial current alpha; the entire texture sample and discard
remain in the source. Unlike the colorless replacement, the RGB rewrite does
not replace the fragment program or strip uniforms/metadata.

## Evidence and remaining gate

Run `node tools/check-iw-render-candidates.js` from this worktree. It runs the
real current fixed-function compiler and extracts the exact transformation
blocks from this branch and the historical commit using `git show`. It fails
if either block is absent. It uses no GL mock, fabricated framebuffer, or
success-returning implementation stub. The historical commit must be available
in the repository; absence is an error, not a skipped check.

Result: **27 source checks passed**, including reproduction of all three
historical missing-texture cases and corrected diffuse retention; independent
stage rewrites; both source/destination source-alpha blend guards; live diffuse,
current, specular and temporary arguments; alpha-test preservation; multistage
retention; key sampling/discard preservation at masks zero and seven; and
programmed-pixel/outline/fog exclusion. The missing-texture regression checks
the entire real generated GLSL body is diffuse-to-output identity before
showing the historical transformation changes its initialization to zero.
`node --check lib/d3d9-backend.js` and `git diff --check` also passed.

This source test does not execute GLSL, link varyings, rasterize fragments, or
measure performance. The original WebGL1/2 stencil/RGB candidate regressions
must be rebased without losing current tests and expanded with a VS supplying
nonzero diffuse RGB for the missing-texture cases before integration. Retain
positive/negative alpha tests and keyed/non-keyed stencil fail/depth-fail/pass,
masked RGB blend factors, and visible missing-varying rejection. Runtime
authorization and current-build qualification remain separate. Invisible War
gameplay/transport stays held; this review makes no new gameplay claim.
