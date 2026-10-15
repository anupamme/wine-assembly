# CMR3 native registry preparation

Source-only recipe: `tools/cmr3-register-native.js`. No guest, build, remote
command or registration was executed during preparation. Runtime ownership
must be granted by the root coordinator; Kkrieger's menu diagnostic is next.

The recipe uses the nine historical registrations (including both QASF runs),
explicit native msvcrt/MSDMO/WMASF dependencies and builtin OLE. It requires a
clean isolated checkout with **no** `test/binaries/dlls` directory. The runner's
dynamic lookup searches that directory before the executable directory even
with `--dlls`; the fresh registration VFS contains only the authenticated
12 DLL/AX files and regsvr32. No shared directory is renamed or modified.

The Outcast DIRECTX registration executable is 30,720 bytes, SHA256
`ea8bb5cb31357ee2866e0fce651a29694cb286be9b5e2f96508a92b5f4b3dfeb`.
Local bytes were reverified at the path in the native recovery plan. Static
`objdump -d` shows `GetProcAddress` result stored at `[esp+0x10]`, indirect
call at `0x40133d`, and HRESULT test at `0x401341`; negative HRESULT sets
exit 5. The `.data` string at `0x406040` is `DllRegisterServer`. The existing
runner `--trace-at=0x401341` observes registers without modifying guest data.
Acceptance requires exactly one observed EAX zero, exactly one guest Exit
zero, no trap/NULL/timeout diagnostic, and a native InprocServer32 entry for
the target DLL. Host exit zero alone fails. Unexpected successful nonzero
HRESULT also stops for review. Partial exports remain diagnostic evidence.
An absent return trace is an inconclusive acceptance failure; it does not
diagnose a defect in the native DLL. Review the bounded log before attributing
the failure to registration or changing guest behavior.

Each step preserves argv, merged stdout/stderr, host status/signal/error,
registry export and assessment. Limits are 20,000 batches / 45 guest seconds,
55 host seconds with SIGKILL, nine sequential steps, 570 seconds internal
admission budget, and a required 600-second outer timeout. No threads/child
process flags are enabled. The output is exclusive and never overwritten.
The capacity gate reserves 512MiB above the 2GiB floor. The original 302-file
and native12 inventories are checked before and after; success is written
only after postflight. The registry is **newly generated**, compared with
the missing original SHA but never called recovered unless byte-identical.
Only the two historical C: game root values are seeded; COM keys come from
the original native registration code.

After an explicit runtime grant, prepare an isolated checkout of the reviewed
commit on `bx_erf37bxf`, transfer the authenticated registration executable,
and obtain a canonical build there (or transfer a byte-verified canonical
module built from that exact source). Record canonical build evidence and
the source/module hashes. Do not use a module from a different source tree.
Create `/home/user/cmr3-registry-config-20261015.json` outside the checkout:

```json
{
  "checkout": "/home/user/cmr3-registry-checkout-20261015",
  "output": "/home/user/cmr3-registry-run-20261015",
  "nativeRoot": "/home/user/cmr3-native-recovery-r3-20261015/native",
  "gameRoot": "/home/user/cmr3-recovery-20261015/assembly/game",
  "regsvr32": "/home/user/cmr3-registry-input-20261015/regsvr32.exe",
  "commit": "REPLACE_WITH_REVIEWED_40_CHARACTER_COMMIT",
  "moduleSha256": "REPLACE_WITH_CANONICAL_MODULE_SHA256",
  "gameInventorySha256": "0c09b40c8eadaf148a0a7285be61a1c3e78d090649b41464f4a5e2192f0940b4"
}
```

The game inventory hash was independently read from the retained local
`scratch/runs/20261015-cmr3-original-recovery/assembly/game-inventory.json`;
remote input must match it. The twelve native pins remain in
`docs/cmr3-historical-receipts-20261015.json`, with acquisition provenance in
the native recovery plan/result. The only unknown pin is the future canonical
module; the placeholders deliberately fail closed.

Exact registration command after those prerequisites and grant:

```sh
timeout --signal=TERM --kill-after=5s 600s node /home/user/cmr3-registry-checkout-20261015/tools/cmr3-register-native.js /home/user/cmr3-registry-config-20261015.json
```

Stop on any failed step; do not continue from partial exports or invent missing
COM keys. Check outer terminal status and surviving processes before releasing
the runtime slot. Review final classes (FilterGraph, SampleGrabber, WM ASF
Reader, WMA/WMV decoders and MultiLanguage) and preserve all evidence before
any separately authorized game replay. Registry generation is not a gameplay
qualification. Synthetic acceptance/order tests and the test-manifest gate
passed; this is not an end-to-end registration result.

Root review found that the initial source checkpoint omitted the registration
tool handoff from its branch base, leaving `registry.registrationTool`
undefined. The exact reviewed `a86527eb6065aa623225fa440a0f1df07b8cfd20`
handoff is now incorporated. A source-contract regression fails on the old
checkpoint and passes with the handoff, checking the tool's presence, size,
SHA256 and historical provenance marker. All three focused tests pass.
