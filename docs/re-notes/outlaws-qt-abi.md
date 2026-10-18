# QT_Thunk: source evidence and unresolved entry contract

Source-only investigation, 2026-10-18, based on main
`f3447c936cd026c9acdd130fbdcd7f1be3f23867`. This does not implement or expose
QT_Thunk and is not runtime compatibility evidence. Originals remain untouched.

## Stack normalization is resolved

[Wine's register-entry macro](https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/kernel16_private.h)
pushes the caller's EBP and establishes a relay EBP.
[RtlCaptureContext](https://github.com/wine-mirror/wine/blob/master/dlls/ntdll/signal_i386.c)
recovers the original EBP and return EIP through that frame and sets captured
ESP to relay EBP + 8. Consequently the argument pointer used by
[Wine's QT implementation](https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/thunk.c)
is **S + 4**, where S is the emulator handler's ESP including the CALL return.
Its copied range is `min(64, B - (S + 4))`; its eventual caller ESP advances
from S + 4 by the actual 16-bit argument cleanup. Its independently returned
EAX, EDX and ECX must not be replaced with packed DX:AX. This is implementation
evidence, not a complete Windows specification.

The unmodified PMPRO62F wrapper has S = B - 0x54. Thus this copy model includes
64 bytes of an 80-byte span. The actual PMPRO62 FLATTHUNK reads a DWORD and
returns with RETF 4, giving S + 8 = B - 0x4c. The saved EDI, ESI, EBX then pop
correctly. Treating the whole copied range as consumed arguments is wrong.
The raw disassembly and original identities remain under
`scratch/runs/20261018-outlaws-guest-bridge-design/` and the existing acquisition
and loader notes. Neither the operation number nor export name defines this ABI.

## Windows and Wine entry contexts differ

Matt Pietrek's primary account,
[Direct Thunking in Windows 95, DDJ special issue 1996](https://jacobfilipp.com/DrDobbs/articles/DDJ/1996/9614/9614c/9614c.htm),
describes at least 0x3c disposable bytes below EBP. Windows aliases the existing
stack, translates EBP, saves PE EBX/ESI/EDI, and clears DS/ES/FS/GS. Its
pseudocode places the previous SS and FS in DI and SI, and the new SS in DX.
The stack-transform calculation is omitted. That omission matters for other
register contents and high halves. The article does not specify complete return
register or flags semantics. The same author's book repeats this account on
printed pages 192–195 (PDF pages 174–177).

Wine uses a copied stack and its own relay BP frame instead. Its
`K32WOWCallback16Ex` copies the caller-provided span, appends a far return and
enters a register-aware relay. QT itself does not copy modified stack bytes back.
These are distinct implementations: neither proves that a private copied-stack
BP or unchanged incoming DS is the Windows callee-entry contract.

## Implementation decision still required

A bounded scalar-call compatibility mode can use the demonstrated stack-copy
and return-cleanup rules without claiming exact Windows stack aliasing. Before
exposing it, choose and document its callee-entry BP/segment/register contract.
Do not silently manufacture register values from incomplete pseudocode. General
EBP-relative scratch access, pointers into the original stack, reverse thunks,
and asynchronous callbacks need an explicit supported design or diagnostic
boundary. Worker remains unsupported.

The existing LibEntry/WEP runner must retain strict stackWords cleanup. A new
mode needs private raw bytes and byte count, argument-start SP and actual final
SP, independent EAX/EDX/ECX, plus an atomic executable-selector-to-live-module
pin. Validate source pages individually (including sparse stacks), wrapping,
alignment, return selector, over-cleanup, owner and generation before settlement.
Restore the complete existing CPU/segments/FP frame on both paths, then merge
only the chosen successful QT outputs. A failed invocation must leave the PE
request parked and diagnostic, never finish it with invented success.

## Prepared discriminating fixtures

`test/helpers/ne-qt-fixture.js` creates a real PE that resolves KERNEL32, walks
its EAT for LoadLibrary16/GetProcAddress16/FreeLibrary16, obtains an NE export,
resolves QT_Thunk by ordinary GetProcAddress, and calls with EDX holding the
far entry. Its wrapper recreates the original scratch and saved-register order.
It records before/after ESP and EBP, independent result registers, scratch
canaries and restored EBX/ESI/EDI, then actually frees the NE module.

The generated NE has real LibEntry and WEP, verifies arbitrary nearest-first
WORD arguments, returns distinct full EAX/EDX/ECX, and supports RETF 0, RETF n,
odd/over-cleanup, trap, infinite-loop and corrupted far-return fixtures. These
are prepared inputs, not tests of an implemented gateway. Pure generation and
NE image validation pass; no canonical build or guest was run. Runtime still
needs main/cooperative, direct/sparse, nested-owner/pin, full-context restoration,
stale settlement/cancellation and original-payload checks after a root grant.
