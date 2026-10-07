# v5.0.0-dev.2-R9

## Requested changes

- Dividend ledger and stock transaction detail show ex-dividend date and cash dividend per share. Both are editable optional metadata; legacy rows show an em dash. Payment date and gross dividend remain the basis for received cash and annual income.
- Validate the optional date and per-share amount; retain original SmartPortfolio source identity on transaction edits. New fields survive JSON/encrypted backups, overwrite/copy merges and CSV exports.
- Existing overtime and leave editors expose a separate delete action, using the existing confirmation and dependency guards. New unsaved forms do not have delete actions.
- Chinese/English labels, mobile action spacing, and R9 asset cache versions updated only under the current v5 route. Stable routes and storage keys unchanged.
- Regenerated the single HTML edition and Worker bundle from the same product sources.

## Verification

- 5 focused R9 checks passed against local source modules.
- 53 checks passed against the generated single HTML: R9 changes, R8 localization and editing, stock accounting/UI, encrypted backup/merge, and portable market integration.
- DOM checks cover legacy/new dividends, high-precision per-share values, gross/net total preservation, invalid optional fields, save/reload, CSV, encrypted backup round-trip, duplicate merge strategies, and delete/cancel of the exact selected attendance record.
- Source syntax and diff whitespace checks passed; no browser session used.

## Scope notes

- Per-share cash dividend is descriptive metadata, not inferred from current holdings or used to overwrite actual gross receipts.
- Existing SmartPortfolio backups have no dedicated ex-dividend date/per-share fields; these remain blank for older imports and can be filled in manually.
