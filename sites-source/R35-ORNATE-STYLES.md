# v5.0.0-dev.2-R35 — ornate reference styles

Upgraded the five R34 styles in place. Stored style IDs and displayed names remain compatible.

- Doodle: sticker-like framing, vivid layered shadows, colored corner tabs and dotted paper.
- Cream: champagne double borders, pearl medallions, peach washes and embossed panel edges.
- Dusk: violet aurora, orbital background arcs, jewel-like frames and restrained border glow.
- Pencil: stacked sheets, graphite double rules, collage tape and pencil accents.
- Studio: blue-gold architectural geometry, beveled panels and metallic note accents.

Page headings, primary actions, navigation framing, summaries and stock panels now share each style's ornamental language. Preview cards and bilingual descriptions match. Decorative pseudo-elements are noninteractive and confined to corners. Dense financial values retain normal text rendering. Mobile rules shrink title ornaments and keep fields readable. Aurora motion respects reduced-motion. Surface alpha and blur settings remain independent; main navigation stays opaque. Print overrides remove decoration.

Fixed R34 cascade conflicts: per-theme tokens and details now match the common defaults' specificity; section descendants inside :is() use :where() so an incidental element selector no longer overrides per-theme rules.

Validation: full stylesheet parsed with CSSOM; app JavaScript syntax checked; existing R34 targeted tests passed (theme persistence, bilingual UI, quick action, data preservation and six-page navigation). Worker build and single-HTML packaging passed. No virtual-browser or physical-device visual validation performed. No data-model, financial calculation or account-storage changes.
