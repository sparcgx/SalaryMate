# v5.0.0-dev.2-R15 — Interface styles

Date: 2026-10-04 (Asia/Taipei)

Settings → Layout settings → Interface style now offers animated frosted glass, minimal white, classic cards and dark. Native radio controls include compact previews, apply immediately, and retain keyboard focus after selection. Density and accent color remain independent. The settings summary shows the current style.

The optional `uiPreferences.interfaceStyle` value is normalized, saved and restored in the existing Schema 13 state and backup flow. Missing or unknown values use glass. A failed save restores the previous selection and reports failure. Business records are unchanged by style selection. R15 retains the existing v5 state key, Google Drive behavior and all root v4.3.2 files.

CSS covers navigation, panels, dialogs, fields, salary/calendar/investment surfaces, dark semantic colors, reduced transparency, and print backgrounds. Existing responsive grids and text-density controls remain in place. All added UI text has English translations. Script/CSS URLs and the v5 service-worker cache are revisioned as R15.

Validation: 5 focused R15 runtime tests and 12 existing R7 backup/import/layout regressions pass. They cover all presets, reload persistence, business-data preservation, independent density/accent settings, dark toolbar color, unknown preferences, failed saves and English labels. No virtual browser was used, following the user's preference; actual-device visual acceptance remains user validation.
