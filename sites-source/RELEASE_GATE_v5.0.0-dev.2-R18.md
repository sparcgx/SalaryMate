# v5.0.0-dev.2-R18

## Changes

- Restyled Macaron Candy using the four supplied reference images: ivory watercolor paper, mint blue, butter yellow, rounded controls, and softly outlined panels.
- Applied the treatment to navigation, summaries, forms, dialogs, tables, and the calendar. Existing responsive grids and accent selection are retained.
- Added an original background produced in one image-generation call, compressed to a 21,536-byte WebP and embedded in CSS for offline use. Source: `assets/macaron-paper-r18.webp`; prompt: `assets/macaron-paper-r18-prompt.json`.
- Renamed Hi-HD to `奇幻 HD-2D 風格` / `Fantasy HD-2D`. The stored `pixel` preference key remains compatible.
- Updated the service worker and asset revision to R18. No storage schema or financial calculation changes; the v4.3.2 root page is unchanged.

## Verification

- All 8 interface-style tests pass, including persistence, English labels, accent independence, migration, and storage-failure rollback.
- Rebuilt English translations and the Worker containing 80 static assets.
- Source syntax and whitespace checks pass.
- No virtual browser was used, following the user's preference. Actual-device visual acceptance remains available to the user.
