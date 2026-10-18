# Local native lifecycle admission

`tools/run-win32-ne-lifecycle-native.js` keeps its historical remote mode by
default, including nine pinned donor paths and the 52-file dependency inventory.
Local use requires `WA_NE_MODE=local-prepare` or `local-run` and
`WA_NE_LOCAL_CONFIG=/absolute/config.json`. Preparation verifies admission and
source/fixture/dependency pins without building or executing a guest. It still
requires an idle runtime lane. A successful preparation is not a suite pass.

Both modes also require the existing `WA_NE_LIFECYCLE_COMMIT`, fresh external
`WA_NE_LIFECYCLE_EVIDENCE` directory, and `WA_NE_ORIGINAL` original PMPRO62 DLL
(SHA-256 `7e2b17e61e7e4808a50478ddcac06f65fcf9f3ffd741d747c8cb75e20cb05db9`).
Production src/lib remain pinned to `d5b940c8b104b2e4d7b7e29506ad6e2fd6aea17c`.

The version-1 JSON config contains:

- `dependencies`: absolute real directory, also the target of this worktree's
  `node_modules`. Both `pngjs` and `wabt` must resolve inside it. Every file is
  freshly hashed; symlinks outside it fail. Every subsequent inspection repeats
  the inventory, detecting additions, removals and mutations.
- `donors`: nonempty array of `{path, sha256}` for actual retained donor files.
  Hashes must match one of the controller's reviewed historical donor hashes.
  Local mode protects these actual files; it does not assert that absent remote
  donor paths or the historical 52-file dependency layout exist.
- `infrastructure`: array of `{pid, startTime, command, role}`. Obtain the exact
  identity with exported `processIdentity(pid)` from `tools/ne-local-admission.js`
  after reviewing the process. Roles are `dashboard`, `watchdog`, or `codex`,
  limited to recognized command shapes. PID start time and complete command must
  still match at every inspection. Do not include competing work as infrastructure.

Unknown Node processes, browsers, and build commands block admission. No process
is terminated or suspended by admission. The free disk floor remains strictly
above 2 GiB and is rechecked around every child. Child deadlines and owned-group
cleanup remain unchanged. Runtime ownership must be assigned before local-run.

Known local preparation inputs as of 2026-10-18: pngjs exists under
`/tmp/wa-local-runtime-deps/node_modules`, but wabt has not been found. Retained
`scratch/runs/20261015-outlaws-kernel32-native/ne-{arena,context,invoke,lifecycle}.tar.gz`
archives are candidate donor sources, not verified restored inputs. The original
DLL is retained beneath the shared repository's
`scratch/runs/20261015-outlaws-oemkeyscan-native/original-loader-fixtures/`.
Supply and verify actual extracted donor paths before running; missing files,
dependencies, and mismatched hashes remain hard failures. No fixture restoration,
dependency installation, build, or native suite execution accompanied this change.

Bounded source-only checks: `node test/test-ne-local-admission.js` and
`node --check tools/run-win32-ne-lifecycle-native.js`.
