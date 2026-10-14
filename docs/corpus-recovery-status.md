# Candidate recovery status

Snapshot after main bea8ac370, 2026-10-14. Refresh with `node tools/audit-candidate-recovery.js`; JSON identifies the manifest SHA256 and reports malformed package references.

134 candidates:117 package recipes,16 manual preparations,1 shared fixture (generally-track-editor uses generally). These counts describe metadata, not successful installed-game reconstruction or current source availability. They do not cover every registry entry or the separate DOS corpus. An output inventory file is not a fresh recovery receipt.

## Completed bounded recovery work

Forced refresh preserves the prior fixture until replacement preparation succeeds (14cc377a7). Publication uses two renames, so process-death/concurrent-writer recovery is still not guaranteed.

Fresh recoveries were verified and committed for .kkrieger,Sanity,Nocturne,Urban Chaos,Return Fire,Messiah,ThiefII,RageI,RageII,Outcast. Their source/hash/extraction evidence and limitations are in docs/re-notes and per-title output inventories where present. Urban Chaos config.ini and ThiefII DARKINST.CFG are explicitly reconstructed installer state. No new gameplay/audio/FPS or public deployment claim follows from acquisition.

## Remaining manual preparations

| Candidate | Concrete remaining work |
|---|---|
| avp2-demo | Original local installer SHA256 is recorded, but no upstream URL. Recover acquisition provenance and complete original launcher-generated avp2cmds.txt export. |
| dungeons-of-dredmor-release | Steam2 depot recovery is documented separately; requires original torrent/depot preparation and acquisition rights. Generic fetcher has no Steam2 pipeline. |
| starcraft-shareware | Original CCD/IMG preparation and installed-tree export remain manual; do not equate disc acquisition with installed game. |
| diablo-shareware | Pinned original ISO; installed output requires original AUTORUN.EXE guest installer. Remote runtime access currently unavailable. |
| moorhuhn-tennis | Pinned installer; original installer/wrapper must run and export projector/SWF/basepath. Remote runtime access currently unavailable. |
| moorhuhn-3-puzzles | Shares original Moorhuhn3 acquisition but each loader needs captured child-launch extraction; remote runtime unavailable. |
| best-of-moorhuhn | Pinned original ISO plus transient wrapper exports; remote runtime unavailable. |
| gallinelle-xxl | Existing manual MODE2/2352 conversion and cabinet recipe. Generic helper supports MODE1 only; add tested mode-specific conversion after confirming permitted acquisition. |
| reflexive-ricochet-xtreme | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-zuma-deluxe | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-crimsonland | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-collapse-crunch | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-alien-shooter | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| baldurs-gate2-demo | Original multipart media and REWise/cabinet merge described in notes; pin every source part and exact case-insensitive overrides before automation. |
| disciples2-demo | Pinned local Wise installer; complete installed-tree export needed, with upstream provenance and runtime access unresolved. |
| beyond-good-evil-demo | Pinned local installer only; upstream URL absent. Preserve original settings registry and complete installation export. |

## Further scope

Audit existing package recipes for installer-only outputs, mutable-save separation and complete output inventories. The initial older-local-tree audit is not current-main completeness. Worms Armageddon already has an integrated complete recipe and fresh667-file recovery verification; the older audit missed it. Silver original media hashes and C:/SILVER plus D:/SILVER ZIP mounting are recovered in docs/re-notes/silver-demo.md, and silver-demo now reconstructs3147 original files and preserves the source ZIP. Dual-drive runtime mounting remains separate from acquisition; no browser/desktop qualification. Reconcile other registry-only fixtures separately. DOS GOG-derived installed trees,Comanche3 original-media provenance and Hornet discovery downloads require their own recovery contracts. Preserve permitted original packages/evidence outside Git; upstream mirrors cannot guarantee permanent availability. Current Boat API refuses SSH, which blocks required separate-box guest/runtime verification; do not work around that permission restriction.
