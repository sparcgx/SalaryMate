# R68 — Jingyu wing animation and curved flight

The R67 static-image hover is replaced by eight painted wing poses and a ninth gliding pose. The existing mascot identity and idle image are retained. Flights last about 7.8 seconds, follow a randomized cubic Bezier route sampled by distance, accelerate on takeoff, bank and turn with the direction of travel, alternate flapping and gliding, and slow down to return home. Eye-midpoint registration offsets stabilize the body across the generated frames.

The sheet is requested on the first tap and reused in memory. The PWA includes it in its offline cache; the single HTML build embeds it. Drawing occurs only during the requested flight. Tap again, Escape, navigation, opening a form, backgrounding, resizing, scrolling or changing motion preference cleans up frames, timers and listeners. Reduced motion and loading failures use a static greeting. No data, backup, network provider or schema change is introduced. R66's cancelled Taiwan-index feature remains absent.

## Asset and generation

- Built-in image generation tool, transparent background; no CLI/API fallback.
- Reference: `dist/dev/v5.0.0-dev.2/art/jingyu-hd2d-r62.webp`.
- Final asset: `dist/dev/v5.0.0-dev.2/art/jingyu-flight-r68.png` (1254 x 1254, true alpha, 3 x 3 atlas). The generated pixels are copied unchanged. Alignment is performed by the animation code.
- Original output retained at `/workspace/scratch/ffb98c0ef4a0/generated_images/exec-53c64103-3cf3-49be-bb70-d64b40c611a2.png`.

First generation prompt: create a square 3-by-3 transparent sprite sheet of the reference owl, preserving cream feathers, turquoise eyes, navy/gold cape, gem and book. Draw the same airborne front-three-quarter character in eight wing phases (fully up, upper 45 degrees, horizontal, lower 45 degrees, fully down, folded recovery, upper recovery, almost fully up) plus a horizontal gliding pose. Keep body registration consistent, feet tucked, no text/grid/background or clipped wings.

Final corrective prompt (verbatim):

> Use case: precise-object-edit. Edit this flight sprite sheet to make it production usable. Preserve all nine owl poses, the character's identity, navy gold cape, book, turquoise eyes and gem, feather rendering, and existing wing sequence. Keep a square canvas with EXACTLY 3 equal columns by 3 equal rows. Essential correction: SHRINK EACH OWL INDIVIDUALLY TO 65% OF ITS CURRENT SIZE inside its own cell, NOT the whole grid. Give every cell broad transparent padding of at least 15% on all four sides, including the fully raised wing in the top-left cell and both horizontally spread wings in the right column. No wing may touch or cross any cell boundary or canvas edge. Lock the HEAD CENTER at exactly x=50%, y=47% of each cell; head size, body size and whole body registration must match identically across every frame. The same character must not grow, shrink, shift or tilt between cells; only the wings move through their intended phases. Keep true transparent alpha outside each owl. Absolutely no text, grid lines, cell labels, floor, cast shadow, scenery or other additions. This sheet must be directly playable using a fixed 3-by-3 CSS sprite grid without trimming or per-frame realignment.

The output still required per-frame registration, which is encoded in the runtime atlas offsets rather than altering the artwork.

## Verification

Six existing rendering/translation/Pages tests passed. Native object fixtures exercised all nine poses, directional turning, delayed image load/cancellation, failed-load fallback, reduced motion and cleanup. 976 sampled positions across four portrait/landscape viewport sizes stayed bounded. JavaScript syntax and the normal build/portable/frozen-page release gates are applied during packaging. No virtual browser was used; physical-phone visual acceptance remains pending.

Schema 15, `salarymate_v5_full_state`, Google Drive and frozen v4.3.2 are unchanged.
