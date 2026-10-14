#!/usr/bin/env bash
# Execute only after acquiring the serialized remote build/browser slot.
# No dependencies/assets are installed or copied. Run from the candidate root.
set -uo pipefail
run_dir=${1:?usage: bash test/helpers/palette-runtime-validation.sh NEW_EVIDENCE_DIR}
mkdir "$run_dir" || exit 2
run_dir=$(cd "$run_dir" && pwd)
seal_artifacts() {
  (cd "$run_dir" && find . -maxdepth 1 -type f ! -name artifacts.sha256 -print0 \
    | sort -z | xargs -0 sha256sum > artifacts.sha256)
}
trap seal_artifacts EXIT
git rev-parse HEAD > "$run_dir/source-head.txt" || exit 2
git status --short > "$run_dir/source-status.txt"
git diff --binary HEAD > "$run_dir/source.patch"
if test -s "$run_dir/source-status.txt"; then
  echo 'Candidate must be clean before validation; see source-status.txt.' >&2
  exit 2
fi
node --version > "$run_dir/node-version.txt"
uname -a > "$run_dir/environment.txt"
printf 'CHROME=%s\n' "${CHROME:-/usr/bin/chromium}" >> "$run_dir/environment.txt"
printf 'step\texit\tstarted_utc\tfinished_utc\n' > "$run_dir/status.tsv"
failed=0
run_step() {
  local label=$1 limit=$2 start rc
  shift 2
  start=$(date -u +%FT%TZ)
  printf '%q ' "$@" > "$run_dir/$label.command"
  printf '\n' >> "$run_dir/$label.command"
  timeout --signal=TERM --kill-after=10s "$limit" "$@" > "$run_dir/$label.log" 2>&1
  rc=$?
  printf '%s\t%s\t%s\t%s\n' "$label" "$rc" "$start" "$(date -u +%FT%TZ)" >> "$run_dir/status.tsv"
  printf '%s exit=%s\n' "$label" "$rc"
  if (( rc != 0 )); then failed=1; tail -n 25 "$run_dir/$label.log"; fi
  return "$rc"
}
# Do not qualify a candidate whose canonical build fails a required gate.
run_step build 600s bash tools/build.sh || exit 1
sha256sum build/wine-assembly.wasm > "$run_dir/production-module.sha256"
run_step palette-lifetime 240s node test/test-d3dim-palette-alpha-page-watch.js
run_step device7-load 240s node test/test-d3dim-device7-load.js
run_step indexed-texture 240s node test/test-d3dim-indexed-texture.js
run_step software-raster 240s node test/test-gl-software-raster.js
# Keep collecting independent failures; never modify tolerances or count SKIP
# as acceptance. The fixture explicitly requests WebGL1 and WebGL2.
run_step gpu-pixels 360s env PALETTE_GPU_EVIDENCE="$run_dir/pixels.json" \
  node test/test-d3dim-palette-gpu-web.js
exit "$failed"
