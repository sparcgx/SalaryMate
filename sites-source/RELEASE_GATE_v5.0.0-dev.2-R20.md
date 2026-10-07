# R20 — Restore scene visibility

The generic non-glass rule hid `.ambient-glass` with higher specificity than the later Fantasy HD-2D and Macaron display rules. Scene assets and saved choices were present, but their entire background layer was hidden.

Restricted background hiding to Classic Cards and Dark, the two flat themes. Image themes now retain their background layer. Updated app and service-worker asset revision to R20 to invalidate stale CSS.

Verified in JSDOM that no unconditional hiding rule matches Fantasy HD-2D, Macaron, or Glass; their layers display as block, while Cards and Dark remain hidden. All five HD-2D choices resolve to their matching embedded WebP variables. Worker rebuilt, syntax and whitespace checks pass. No virtual browser was used. No data/schema changes.
