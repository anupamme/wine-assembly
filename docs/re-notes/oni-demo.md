# Oni demo preflight

Source https://mods.oni2.net/node/335; linked
https://mods.oni2.net/system/files/Oni%20Demo.zip fetched on boat bx_3uhkes9x.
94,583,006 bytes; SHA256
9913e0f866e25bcd11571dec645be420e717092763a8f34ebe4d4ec3c47ec7e5.
7z extraction:42files,169519142 bytes, no errors.

This is explicitly a community repack, not the original installer. Its README
says it combines the original demo levels1/4 and alternate demo level2, and
ships modern OniX plus the original demo application under
Older Oni apps/Windows 98-ME/Oni.exe. For Win98 testing use that executable
and matching binkw32.dll, with GameDataFolderX copied as GameDataFolder,
per the supplied rename instruction. Preserve the source tree. The original
run_wind.bat uses Oni -noswitch. No public redistribution grant established.

Remote source: /home/user/oni-demo-preflight/extracted/. No fixture copied
to the persistent box. Next verify original PE/imports, stage the documented
legacy layout, and run bounded CLI after Turok releases runtime.
No launch, gameplay, screenshot, FPS, audio or mobile qualification yet.

## First bounded startup (16:27Z)

Original Oni.exe SHA256
d1579b3a205bdb7771ac32ebf3af61f927d352fe2e3e35128207e84a2937a12d.
Default and supplied -noswitch route both enumerate the four level DATs,
initialize sound/input/graphics/game systems, then ExitProcess(0) while
loading level0. The later eip-zero diagnostic is after that explicit exit;
do not report it as the startup cause. Exported guest startup.txt/debugger.txt
identify error1 at BFW_TM_Game.c:2529, propagated through Oni_Level.c:405
and Oni.c:936. No explanatory error text is supplied. Next map the failing
template/level load return and its file/mapping inputs; no cause proven.
Evidence: scratch/runs/20261011T1627Z-oni-startup (commands and guest logs).
The build is own branch6823f45d3/base3cf809538, not latest main GL changes.

## Filename-case lead (16:35Z)

The exact error at0x42211f is "This level is not valid" (string52b01c).
It tests level-valid byte564ad8[level]. The parser421030 splits at underscore
and period, then compares the suffix byte-for-byte with "Final" at52acc8
(4210c1..4210f7); mismatch clears the flag at421146. Actual ZIP entries are
level0_Final.dat etc., whereas traced FindFirst/CreateFile names are lowercase.
lib/filesystem.js findFirstFile enumerates normalized map keys, losing original
case. Next controlled enumeration-case probe, then general case-preservation
across mounts/create/move/copy/persistence if confirmed. No guest patch.

Controlled confirmation: run20261011T1637Z-oni-case-probe wraps only
FindFirst/Next returned names with actual names read from the extracted tree.
No EXE/data bytes change. The30000-batch replay no longer reports invalid
level; it loads resources and reaches the reviewed Bungie intro. Remaining
guest logs contain missing particle-class warnings, not the earlier error.
This is a diagnostic wrapper, not a production fix. Next preserve original
case as VFS metadata while retaining normalized lookup keys, including eager,
lazy/provider mounts, create/copy/move and serialization. Test general mixed-
case enumeration and rerun Oni without the wrapper on a fresh remote build.

## General filename fix (16:48Z)

File entries now retain their basename spelling independently of normalized
lookup keys. CLI and browser manifest mounts preserve it for eager/lazy/provider
files; create, truncate, copy, move (including case-only rename), child merge,
localStorage and overlay hydration retain the metadata. Old entries without
metadata still enumerate their normalized basename. Directory case and other
mount paths that already discard spelling are outside this change.

Fresh remote build on bx_kmxkny92 passed, as did all 15 test-vfs*.js files.
The new mixed-case regression fails against the old filesystem implementation.
Unmodified Oni/data, without the diagnostic wrapper, now reaches the reviewed
Bungie intro at 30000 batches: run20261011T1648Z-oni-case-fixed. This verifies
the startup fix, not gameplay, FPS, audio or browser/mobile compatibility.
