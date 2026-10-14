# Candidate recovery status

Snapshot after main bea8ac370, 2026-10-14. Refresh with `node tools/audit-candidate-recovery.js`; JSON identifies the manifest SHA256 and reports malformed package references.

134 candidates:117 package recipes,16 manual preparations,1 shared fixture (generally-track-editor uses generally). These counts describe metadata, not successful installed-game reconstruction or current source availability. They do not cover every registry entry or the separate DOS corpus. An output inventory file is not a fresh recovery receipt.

## Completed bounded recovery work

Forced refresh preserves the prior fixture until replacement preparation succeeds (14cc377a7). Publication uses two renames, so process-death/concurrent-writer recovery is still not guaranteed.

The DOS downloader now also stages and hash-checks downloads and extracts into a clean tree before publication. Download, hash, extraction or missing-executable failures preserve the previous archive and game tree; a failed publication attempts rollback and reports the retained backup path if rollback fails. Serialize recovery for each title: the two-renames operation is not crash-atomic. Successful `--force` replaces the complete tree, including local saves/modifications; copy those elsewhere first. Normal cached reuse still checks the archive and executable presence, not every companion file. Offline regressions use a synthetic ZIP and local HTTP, not guest-runtime qualification.

Fresh recoveries were verified and committed for .kkrieger,Sanity,Nocturne,Urban Chaos,Return Fire,Messiah,ThiefII,RageI,RageII,Outcast. Their source/hash/extraction evidence and limitations are in docs/re-notes and per-title output inventories where present. Urban Chaos config.ini and ThiefII DARKINST.CFG are explicitly reconstructed installer state. No new gameplay/audio/FPS or public deployment claim follows from acquisition.

## Remaining manual preparations

| Candidate | Concrete remaining work |
|---|---|
| avp2-demo | Original local installer SHA256 is recorded, but no upstream URL. Recover acquisition provenance and complete original launcher-generated avp2cmds.txt export. |
| dungeons-of-dredmor-release | Steam2 depot recovery is documented separately; requires original torrent/depot preparation and acquisition rights. Generic fetcher has no Steam2 pipeline. |
| starcraft-shareware | Original CCD/IMG preparation and installed-tree export remain manual; do not equate disc acquisition with installed game. |
| diablo-shareware | Pinned original ISO; installed output requires original AUTORUN.EXE guest installer and exported-tree verification. |
| moorhuhn-tennis | Pinned installer; original installer/wrapper must run and export projector/SWF/basepath. |
| moorhuhn-3-puzzles | Shares original Moorhuhn3 acquisition but each loader needs captured child-launch extraction. |
| best-of-moorhuhn | Pinned original ISO plus transient wrapper exports still needed. |
| gallinelle-xxl | Existing manual MODE2/2352 conversion and cabinet recipe. Generic helper supports MODE1 only; add tested mode-specific conversion after confirming permitted acquisition. |
| reflexive-ricochet-xtreme | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-zuma-deluxe | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-crimsonland | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-collapse-crunch | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-alien-shooter | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| baldurs-gate2-demo | Original multipart media and REWise/cabinet merge described in notes; pin every source part and exact case-insensitive overrides before automation. |
| disciples2-demo | Pinned local Wise installer; complete installed-tree export and upstream provenance still needed. |
| beyond-good-evil-demo | Pinned local installer only; upstream URL absent. Preserve original settings registry and complete installation export. |

## Further scope

Ultima IV now recovers its complete 175-file installed payload from the existing
pinned GOG package, including original save templates. Fresh recovery and
byte comparison against independent extraction/restored files passed; see
`docs/re-notes/ultima4-gog.md`. Arena now recovers348 pinned original payload
files, but its older browser-preparation inventory additionally demands102
installer temporary files and70 files absent from the package. The canonical inventory now contains only those 348 original files, and
preparation migrates exact known metadata with backups while preserving saves;
unknown metadata is refused. Pristine and old-metadata preparation pass.
Browser gameplay/save-reload validation remains separate; exact removed
paths/hashes are recorded in the Arena recovery evidence. Daggerfall now recovers1623 original files with fresh
recipe, independent extraction and restored-file byte comparisons; its dedicated
browser metadata preparation remains distinct from generic acquisition.
Shadow Warrior now recovers181 original files, independently byte-compared,
including its original cue sheet, MODE2 media and audio tracks. Its native CD
runtime support remains separate from package recovery. These are separate
from the DOS downloader's existing ZIP recipes.

Audit existing package recipes for installer-only outputs, mutable-save separation and complete output inventories. The initial older-local-tree audit is not current-main completeness. Worms Armageddon already has an integrated complete recipe and fresh667-file recovery verification; the older audit missed it. Silver original media hashes and C:/SILVER plus D:/SILVER ZIP mounting are recovered in docs/re-notes/silver-demo.md, and silver-demo now reconstructs3147 original files and preserves the source ZIP. Dual-drive runtime mounting remains separate from acquisition; no browser/desktop qualification. Reconcile other registry-only fixtures separately. DOS GOG-derived installed trees,Comanche3 original-media provenance and Hornet discovery downloads require their own recovery contracts. Preserve permitted original packages/evidence outside Git; upstream mirrors cannot guarantee permanent availability. Boat SSH remains unavailable to the scoped key. On 2026-10-14, the documented and authorized Boat exec API was verified on a fresh separate test box, allowing clean builds and runtime validation. This resolves the transport blocker only; automated-review restrictions on specific diagnostics remain in force.
