# R21 — Mobile background composition

- At widths up to 720px, Fantasy HD-2D uses a compact scenic area, 260–405px tall, with a vertical fade to the navy page background. Landscape images no longer scale to fill the entire tall phone viewport.
- Individual focal positions retain the canyon, forest, harbor buildings, aurora castle, and sky ruins. At 320–720px widths, at least 69% of image width remains visible.
- Macaron uses a similarly compact, right-aligned paper scene fading into ivory. Desktop composition and saved background choices are preserved.
- Styling is screen-only; print behavior is unchanged. No new image downloads, runtime scripts, settings, or data/schema changes.
- Verified CSS parsing and individual mobile scene bindings in JSDOM by explicitly applying the mobile media branch (JSDOM does not evaluate viewport media queries). Desktop cover mode and all image-layer visibility checked. Worker rebuilt; syntax and whitespace checks pass.
- No virtual browser used. Actual-device appearance remains for user acceptance.
