# R24 — Global panel transparency

- Added Transparent, Translucent, and Frosted to Layout settings for every interface style. Changes apply immediately and persist through the existing preference/backup flow.
- Shared surface treatment covers navigation, page panels, salary summaries, calendar cells, stock panels, table headers, input fields, and dialogs. Text opacity and primary button contrast remain intact; selected states retain their accents.
- Transparent uses zero background fill, translucent uses 50% fill, and frosted uses 72% fill with 16px backdrop blur. Light/dark surface colors follow the selected style. Fantasy image backgrounds receive a darkening layer in transparent modes to support readable light text.
- Native select options remain solid. Reduced-transparency preferences use opaque surfaces; browsers without backdrop blur receive a stronger frosted fill. Printed surfaces remain white.
- The optional `uiPreferences.surfaceOpacity` defaults to Frosted for old/missing/unknown preferences. No schema/storage-key or financial changes.

Validation: all 15 style/opacity combinations, record preservation, reload, English labels, old/invalid defaults, and storage-failure rollback PASS. Existing 11 interface/background tests PASS. CSS parsing and JS syntax checks PASS; Worker rebuilt. No virtual browser used; actual-device appearance remains for user acceptance.
