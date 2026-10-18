# IsDBCSLeadByteEx import checkpoint

The root's retained `20261019-madbomber-beep-retry` advances past Beep lookup
to API 288 resolving `IsDBCSLeadByteEx` to NULL on KERNEL32 handle `00db7e54`.
This source change adds API 4578 and explicit native export ordinal 587.
All earlier API IDs and export ordinals remain unchanged. It does not modify
the original guest or establish that its next startup attempt will succeed.

[Microsoft's contract](https://learn.microsoft.com/en-us/windows/win32/api/winnls/nf-winnls-isdbcsleadbyteex)
classifies a BYTE as a potential lead byte in five DBCS pages; it does not
validate a trail byte. The existing shared helper implements their ranges.
The new handler uses that helper and validates its page first. Both true and
valid false results preserve LastError; an unavailable page returns false
with ERROR_INVALID_PARAMETER (87), consistent with the code-page table lookup
in [Wine's implementation](https://github.com/wine-mirror/wine/blob/master/dlls/kernelbase/locale.c).

Runtime-supported pages are 437, 1252, 932, 936, 949, 950 and 1361. For this
classification operation, Macintosh 10000 and Unicode UTF-7/UTF-8 (65000/65001)
also correctly have no DBCS lead bytes. Other unavailable pages fail explicitly;
this is not a claim of general installed Windows NLS coverage or conversion
support for those three additional pages. CP_MACCP selects the default US
Macintosh page. Existing runtime alias conventions are retained: CP_ACP and
CP_THREAD_ACP use process ANSI state; CP_OEMCP uses console output state.
Per-thread locale and independent system OEM configuration remain limitations.

`test/test-dbcs-lead-byte-ex-production.js` authors actual guest calls through
the production PE static IAT and dynamically resolved KERNEL32 EAT, including
ordinal identity, stdcall ESP, all 256 bytes for every supported explicit page,
ACP changes, default OEM/Mac aliases, BYTE narrowing, invalid pages, LastError
preservation and recovery. Run it normally and with `--no-tail-calls` under an
exclusive runtime grant. No build, compiled fixture or original retry has
been run for this source checkpoint.
