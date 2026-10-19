# Conan 2004 demo: original installer recovery

Task: `NEW-GAME-CONAN-DEMO-20261010`. Availability checked 2026-10-19
03:16–03:18 UTC from source checkout `6d98feb01924f766b8d72fc8d656c0ab9c20f11c`.

The user's 2026-10-18 authorization permits ordinary Accept/Yes for Conan.
`scratch/license-acceptance-authorization-20261018.json` and its durable
`docs/` copy explicitly include this task. Actual guest acceptance has not
been observed; installation and gameplay are unqualified. The historical
instruction not to answer acceptance is superseded by this authorization.

## Availability and evidence

The recorded original is
`test/binaries/win98-games-a-d/Conan cauldron-DX9-D3D/ConanPC-Demo.exe`.
It is absent at that path in `/home/user/wine-assembly` locally and on
`bx_rqnkhrnr` (read-only command `cmd_0dponcufriga`). A filename inventory
under remote `/home/user` and `/tmp` found no Conan or `0803Z` names
(`cmd_rzi9zjm6ch7l`, exit 0, empty output). Local filename inventory likewise
found no original or capture. This does not establish absence inside archives.
There is no Conan candidate manifest entry in this source revision.

The append-only board records original staging and SHA verification on
`bx_hx8msa33` at 2026-10-10 07:59, followed by ordinary language, welcome,
and destination inputs reaching an EULA with I Reject selected at 08:03.
Historical evidence ID: `20261010T0803Z-conan-destination`. The actual SHA,
size, remote absolute source path, controller, and capture bytes have not
been recovered; do not substitute guessed values or current build identity.

`boat --json info bx_hx8msa33` reports stopped, healthy, snapshot available,
snapshot completed and verified `2026-10-10T21:59:36.229Z`, and no pending
wipe. CLI history can read stored command metadata while stopped, but its
latest 100 command records only reach 20:57 that day. A direct `/commands`
pagination GET with the existing wine-ops API key returned HTTP 403 and was
not retried through another route or credential.

After coordinator authorization for recovery-only resume, the normal
`boat --json resume bx_hx8msa33` command returned exit 1 / HTTP 403:
`api_key_action_forbidden`: `This API key cannot perform sandbox.resume.`
No alternate route was attempted. The sandbox was not resumed, no files
were transferred, and no guest, browser, or build ran. This enforced access
restriction is the immediate blocker, independent of license authorization.

## Recovery and execution prerequisites

1. Resume the saved sandbox through an authorized supported session once
   the access restriction is resolved. Do not retry denied pagination,
   SSH/scp, or substitute credentials. Recheck the snapshot and preserve all
   original files. Inventory Conan filenames and the historical evidence
   before selecting any source; compute actual size and SHA-256.
2. Recover the original installer, its controller/logs and EULA capture using
   permitted exec/FilesAPI directly to roomy `bx_rqnkhrnr`. Keep large bytes
   off this local host (2.32 GB available after checkout; required floor
   greater than 2 GB). Pin and verify both ends of each transfer. Record a
   recovery manifest including source box, absolute paths, size and hashes.
   Snapshot-stop the recovery box after transfer verification; do not delete.
3. Prepare an isolated immutable stage with a coherent source/module pair.
   Audit the selected runner's full boot closure: SYSTEM_DATA_FILES including
   stdole type libraries, bitmap fonts including Terminal.fon, substitution
   font map and referenced fonts, and the actual app manifest and every mount.
   Reuse the qualified boot-closure checker with its matching source; do not
   infer completeness from an installer file existing. Preserve originals.
4. Obtain the coordinator's sole-runtime allocation. Use a bounded controller
   with deadline, disk floor, output caps, process-group cleanup, lease and
   source/hash verification. Reconstruct ordinary language/welcome/destination
   inputs from recovered evidence, observe the actual EULA, then select the
   authorized Accept/Yes control normally. Never patch around the installer.
5. Capture actual acceptance and installed-file inventory separately. Register
   the real installed executable only after identifying it. Original launch,
   player-controlled gameplay, and inspected screenshot remain required;
   an installer frame does not establish gameplay. Use distinct run folders
   and publish result metadata last after artifact verification. No public
   deployment is authorized by this task.

No code changed and no runtime tests ran. Validation for this checkpoint is
read-only availability inspection, current task/authorization reconciliation,
document review, and `git diff --check`.
