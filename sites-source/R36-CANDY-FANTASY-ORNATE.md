# v5.0.0-dev.2-R36 — candy and fantasy ornate presets

Added two selectable variants without replacing the original presets:

- 馬卡龍糖果・華麗版 / Macaron Candy · Ornate: pearl icing, pastel ribbon borders, layered candy frames, colored medallions and a soft ambient wash.
- 奇幻 HD-2D・華麗版 / Fantasy HD-2D · Ornate: stepped blue-gold frames, jewel emblems, inset metallic edges and slowly drifting motes.

Each variant has its own bilingual preview. Existing embedded candy scenery and all five HD-2D scenes remain available. Mobile scene framing and HD-2D transparent-panel darkening are retained. Mobile decorations and title icons are smaller; input text remains at least 16px. Motion respects reduced-motion. Surface opacity choices stay independent, and primary navigation remains opaque.

Implementation: stored preset IDs macaron-luxe/pixel-luxe map to the base macaron/pixel CSS theme. A separate style-variant attribute enables only the additional ornament. Original IDs remain unchanged. Changing to an ordinary theme clears the variant attribute on both body and html. HD-2D background controls and theme-color metadata use the base theme while preference persistence, selected radio and settings summary retain the preset identity. Schema and storage keys are unchanged.

Validation: 6 targeted JSDOM tests passed, covering both variants, reload/export-payload retention, five HD-2D backgrounds, three opacity modes, English labels, original style switching and data preservation. Full CSS syntax parsing, JavaScript syntax check, Worker build, single-HTML packaging and whitespace checks passed. No virtual browser or physical-device visual testing was performed.
