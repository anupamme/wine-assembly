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

The coordinator selected a Windows-compatible stack alias rather than a
private copied-stack BP. Before exposing it, finish the callee-entry
BP/segment/register contract.
Do not silently manufacture register values from incomplete pseudocode. General
EBP-relative scratch access, pointers into the original stack, reverse thunks,
and asynchronous callbacks need an explicit supported design or diagnostic
boundary. Worker remains unsupported.

The existing LibEntry/WEP runner must retain strict stackWords cleanup. A new
mode needs an owned stack alias, argument-start SP and actual final
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

## Alias and lifetime preparation checkpoint

`lib/ne-qt-stack.js` is a read-only planner, not selector publication. Current
segmented handlers require 64KiB-aligned bases, so the supported initial alias
window is the aligned 64KiB containing ESP. EBP, the return slot and documented
scratch must fit within it. Both ends of every guest page must translate into
one contiguous physical window; holes, split backing, wrap and odd pointers are
rejected. This admits qualifying direct and sparse mappings without pretending
that all sparse stacks qualify. A BP-relative scratch write then reaches the
actual PE stack. Pure tests establish those address identities only.

**Mapping lifetime is not established by translation.** The planner cannot pin
VirtualAlloc backing, and the existing virtual-map release path has no apparent
span pin. Before entering aliased sparse memory, add an owned mapping lease or
explicitly reject it. Holding DLL_LOAD_LOCK while executing is not a substitute:
the lock does not protect virtual-map lifetime and would deadlock callbacks.
Thread retirement/process reset must revoke the alias before freeing backing.
An actual gateway must save/restore the original DWORD at S, which its far
continuation overwrites. Scratch modifications by the NE callee remain visible.

The source candidate adds `win16_bridge_invoke_target`: under the frame's owned
scope and DLL mutex it resolves a live executable selector to a ready module
and pins it atomically. A pinned frame cannot change its module or entry target;
existing frame teardown releases the pin. This does not expose QT or change
LibEntry/WEP stack cleanup. `test-ne-qt-ownership-candidate.js` prepares native
checks for invalid/data/unloaded addresses, duplicate binding, target changes,
final-free exclusion and stale-frame teardown. Native checks are **not run**.
