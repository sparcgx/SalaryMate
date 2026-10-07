# v5.0.0-dev.2-R19 — Fantasy HD-2D backgrounds

## User-visible changes

- Layout settings displays Background settings when Fantasy HD-2D is selected.
- Five selectable scenes: Fantasy Canyon (existing), Enchanted Forest, Sunset Harbor, Aurora Castle, and Sky Islands.
- Native radio cards show scene thumbnails, names, descriptions, and selected state. Three columns on desktop, two on mobile; keyboard focus is visible.
- Selecting a scene applies it immediately and remembers it across reloads and style changes. Chinese and English labels are included.

## Compatibility and assets

- Added the optional `uiPreferences.hd2dBackground` preference using the existing storage/backup workflow. Missing or unknown values use the original canyon; schema 13 and the existing storage key are unchanged.
- Storage failures roll back the selection and preserve saved records. Financial data/calculations and the v4.3.2 root application are unchanged.
- Four original artworks were generated with one built-in imagegen call per scene, with no variants or retries, and visually inspected. Compressed WebP sources are in `assets/hd2d-*-r19.webp`; exact prompts/provenance are in `assets/hd2d-backgrounds-r19-prompts.json`.
- Backgrounds are embedded into CSS; no third-party image requests or account permissions are needed. Existing dark surfaces preserve text contrast over all scenes.

## Verification

- Interface/background tests: 11 PASS, 0 FAIL, covering all choices, persistence, style independence, Chinese/English, legacy fallback, and storage-failure rollback.
- Full CSS parses without errors; embedded scene variables and background card layout checked in JSDOM.
- JavaScript syntax and whitespace checks pass; Worker and English catalog rebuilt.
- No virtual browser used, following the user's preference. Actual device visual acceptance remains with the user.
