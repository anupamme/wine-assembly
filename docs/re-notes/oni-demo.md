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
