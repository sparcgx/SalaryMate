# R62 — Header alignment and display work

Page-header actions occupy the right column, stacking on narrow screens.
The HD-2D mascot and heading copy are separate children. This fixes the old
mobile stock-heading rule that placed the description across the mascot's
grid column. Stock headings and a shorter two-line description are centered
inside their own text area; the right-side options menu remains accessible.

The original mascot is losslessly encoded as WebP: 1,488,589 to 1,155,728
bytes (22.4% fewer transferred bytes). Resolution and visible pixels are
preserved. Existing PNG URLs remain available for old clients. The current
PWA shell and portable HTML use the WebP asset with the appropriate MIME type.

After a view changes, localization visits main content and the shared topbar
instead of rescanning the sidebar, footer and open dialogs. Explicit language
changes still translate the entire interface; dialog rendering keeps its
existing scoped localization. This is a bounded reduction in rendering work,
not a measured phone speed claim.

Schema 15, storage key, calculations and v4.3.2 remain unchanged. Verification
uses native Node fixtures, existing localization/security regressions and
the portable/CSP release gate. No virtual browser or phone visual PASS.
