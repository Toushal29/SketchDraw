# v9 plan for retired Library records

## Current guarantee

SketchDraw v8 still reads, writes, and syncs the complete `library` payload. Notebook edits only `quickNotes`; the retired study, wiki, journal, writing, research, and media records are kept unchanged when a v8 file is opened and saved. Keep that behavior while the v8 format is supported.

## Migration sequence

1. **Add a user-facing archive export before changing the file format.** Offer a portable JSON archive that includes every retired collection, original record IDs, timestamps, and embedded media data. Let users save it independently of a sketch so removing a sketch does not remove the only copy.
2. **Test the export against representative v8 files.** Include empty collections, Unicode, large embedded media, missing optional values, and records edited by two synced copies. Re-importing the archive into a test fixture must reproduce the same records.
3. **Choose the v9 storage policy after the export ships.** The default recommendation is to stop writing the retired collections into newly saved v9 files, while keeping the v8 reader and an explicit v8-to-v9 migration step. Do not silently discard data during ordinary open or save.
4. **Define mixed-version sync behavior before release.** A v8 copy may still write retired records after another device has upgraded. Either preserve them in a compatibility archive section while v8 peers remain in use, or show a clear version conflict and require an explicit migration. Never let a v9 save silently erase records written by a v8 copy.
5. **Remove legacy fields only after a compatibility window.** Keep v8 parsing for at least one supported release after v9 ships. Remove old model types and sync keys only after the v9 export, migration, and mixed-version behavior are all covered.

## v9 exit criteria

- Users can export all retired records without opening the removed Library workspace.
- Opening a v8 file never drops legacy records, including when recovery or sync merge runs.
- v8 and v9 copies sharing a folder cannot silently overwrite each other's retired records.
- Tests cover v8 read and save round trips, archive export, interrupted edits, and concurrent record edits and deletions.
- The release notes explain the migration and where the archive is stored.
