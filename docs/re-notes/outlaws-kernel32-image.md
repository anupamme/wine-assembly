# Readable native KERNEL32 image

## October 18 restoration

Restored against `dddfa4d6a86bd5ce2cb849808e523abf34d3868f`, after reviewing
historical implementation `5069c3f18`, guest hint/name correction `12708f0c4`,
file-count correction `c384183ec`, and validation receipt `fb37ac0c5`.
Historical runtime receipts do **not** validate this restored source.

`GetModuleHandleA(NULL)` retains the EXE identity. Native KERNEL32 has its own
process-owned heap image, published under `DLL_LOAD_LOCK` only after all PE
headers, export tables, names and executable JMP entries are initialized.
`GetProcAddress` resolves that same image, so an EAT walker and a named lookup
receive the same entry. Export thunk records hold guest RVAs pointing to a
two-byte hint followed by the complete API name, including in sparse memory.
Explicit loads have independently counted references; draining those refs
does not unmap the process module. Loading a new PE clears the old identity.
Real mapped DLL precedence and missing-private-path rejection are preserved.

The 458-entry ownership manifest is the historical explicit surface, not a
new claim that every process API belongs to KERNEL32. Its named ordinals are
emulator ABI; legacy ordinals retain their explicit assignments. The generator
resolves IDs against **current** `api_table.json`. The region mirror is freshly
generated for current declarations. The image builder and generated section
live in `08-pe-loader.wat` to preserve the compiler's source-file budget.

Ordinals 35/36/37 and `QT_Thunk` remain absent. No silent success handlers,
guest LoadLibrary16 wiring, NE lifecycle adapter, or QT register/stack ABI is
added. Original PMPRO62F requires those later stages. The 31 original
payload records are not needed for the deterministic tests below; acquisition
and verification are owned by a separate task.

## Validation status and next commands

Source-only checks passed: generator regeneration/staleness and five invalid
manifest controls, JavaScript syntax, WAT balance/labels, manifest membership,
region declarations/owners/mirror, raw-address and embedded-WAT gates, and
`git diff --check`. No canonical build, Wasm test, guest or browser has run for
this checkpoint. The tiny tests also instantiate Wasm and remain deferred.

After an explicit runtime grant and independent idle/disk preflight, run in
the candidate checkout, retaining logs and module/map hashes in a fresh run
directory. These are the next test commands, not an admission controller:

```sh
timeout --kill-after=5s 180s bash tools/build.sh
timeout --kill-after=5s 60s node test/test-kernel32-image.js
timeout --kill-after=5s 60s node test/test-kernel32-image.js --sparse
```

Generate a deterministic fixture (pure JS) into the fresh evidence directory:

```sh
node -e 'require("fs").writeFileSync(process.argv[1], require("./tools/kernel32-native-fixture").makeFixture())' /ABS/RUN/kernel32-fixture.exe
sha256sum /ABS/RUN/kernel32-fixture.exe build/wine-assembly.wasm lib/region-map.generated.js
```

Then substitute the observed fixture hash and run each arm separately:

```sh
timeout --kill-after=5s 75s node test/test-kernel32-image-candidate.js --wasm=build/wine-assembly.wasm --fixture=/ABS/RUN/kernel32-fixture.exe --fixture-sha256=HASH
timeout --kill-after=5s 75s node test/test-kernel32-image-candidate.js --wasm=build/wine-assembly.wasm --fixture=/ABS/RUN/kernel32-fixture.exe --fixture-sha256=HASH --sparse
timeout --kill-after=5s 180s node test/test-process-memory-hooks.js
timeout --kill-after=5s 180s node test/test-dll-lifecycle-real-pe.js
```

The full-module tests cover simultaneous publication, 64 balanced references,
actual EAT-JMP native execution and complete dispatch names, stdcall cleanup,
EXE exports, system/private paths, and process reload. The hook test covers
both readable PE entries and native thunk descriptors. The historical native
controller is deliberately not restored: it pins obsolete external modules
and unrelated historical paths. A current admitted run must seal its actual
inputs and retain process cleanup evidence. Browser behavior, original game
launch, gameplay, audio and FPS remain unvalidated.
