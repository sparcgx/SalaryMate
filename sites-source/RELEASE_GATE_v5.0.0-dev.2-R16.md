# v5.0.0-dev.2-R16 — Macaron and Hi-HD styles, expanded accents

Date: 2026-10-04 (Asia/Taipei)

Settings → Layout settings removes Minimal white and adds Macaron candy and Hi-HD dot grid. Saved/imported `white` preferences normalize to Classic cards; missing or invalid values still use glass. Five presets remain independent from text density and the seven accent colors.

The candy style uses solid pastel surfaces, rounded panels and soft depth. The dot-grid style uses a static fine-dot page background, crisp panel borders and offset button shadows while preserving readable fonts and responsive fields. Both include matching selection previews. Pink, indigo violet, warm orange and berry red accents now have working light/dark tokens and swatches. Accent options wrap into a two-column mobile grid. Storage failures roll back color selection instead of showing a successful save.

Dark stock gain/loss colors retain the existing Taiwan convention (profit red, loss green). English translations, R16 URLs and service-worker cache version are updated. Schema 13, the v5 storage key, financial records and root v4.3.2 remain unchanged.

Validation: 8 interface runtime tests pass for all five presets, seven accents, independent combinations, reload persistence, migrated white preferences, English text, unchanged records and failed-storage rollback. JavaScript syntax and Worker packaging pass. No virtual browser was used; device visual acceptance remains user validation.
