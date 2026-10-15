# Secondary sound-buffer interface candidate

The original .kkrieger requests IID_IDirectSoundBuffer8 after creating its
secondary PCM buffer. Existing QueryInterface refuses that IID. The retained
unpacked image and the new EIP-zero stop identify a null audio-buffer call as
the next lead; the actual initialization HRESULT still needs a runtime capture.
See `docs/re-notes/kkrieger-beta.md` and the original run evidence
`scratch/runs/20261015-kkrieger-short-original` in the coordinator checkout.

This candidate adds a distinct 24-slot secondary-buffer wrapper. Its 21
inherited methods share the original buffer, reference count, PCM storage and
voice. QI retains controlling IUnknown identity, checks all GUID words,
rejects primary buffers and reports auxiliary-wrapper exhaustion without
rewriting another interface. The shared vtable registry is extended at its
tail, preserving existing Worker offsets.

SetFX, AcquireResources and GetObjectInPath have real appended dispatch slots
with the correct argument counts, but remain **explicitly unimplemented**:
they call the normal fail-fast diagnostic. Effects and deferred resources are
open API work. There is no successful no-op, fabricated capability error or
change to existing creation flags. This is inherited Buffer8 compatibility,
not complete Buffer8 support or a gameplay qualification.

`test/test-directsound-buffer8.js` prepares actual generated-thunk dispatch
checks, stdcall frames, full identity/primary/exhaustion/Worker-registry
checks, Lock/Unlock/Play/cursor/Stop on the real host audio model, final voice
release, and all three explicit extension traps. No external PE is required.
Runtime tests and canonical build are pending a serialized CPU grant.

Official contract references:

- [Buffer8 identity and primary-buffer restriction](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418055(v=vs.85))
- [Microsoft SDK header, GUID and vtable order](https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/dsound.h)
- [SetFX](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418145(v=vs.85)), [AcquireResources](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418057(v=vs.85)), [GetObjectInPath](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418068(v=vs.85))
