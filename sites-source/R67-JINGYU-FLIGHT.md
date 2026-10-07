# R67 — Tap Jingyu to fly

Built on the restored R65 source. The cancelled R66 Taiwan index/Fugle feature stays removed.

The existing HD-2D topbar companion is a keyboard-accessible button with a minimum 44px touch target. Tap or press Enter/Space for one six-second random flight with a gentle flutter and gold sparks; it then returns to the original position. Tap the original button again or press Escape to stop.

The flight overlay does not capture input or affect document layout. Its route stays within the visible viewport with space around the phone edges and bottom menu. Only one flight can exist. Completion, navigation, opening a form, style changes, backgrounding, scrolling, resizing, printing or changing the reduced-motion preference remove the overlay, animation, event listeners and timer. Nothing runs while idle.

Reduced motion, unsupported animation APIs and an unloaded image use a brief static greeting glow. Reuse the existing local WebP asset; no new image download, provider, data field, backup change or external request is introduced.

Validation: native JavaScript fixtures checked single-flight behavior, completion/repeated clicks, lifecycle cleanup, reduced-motion greeting and 80 bounded routes across four portrait/landscape desktop/mobile sizes. Six existing rendering/translation/Pages tests passed. JavaScript syntax and release/build gates are checked when packaging. No virtual browser was used; physical-device visual acceptance is pending.

Schema 15, `salarymate_v5_full_state`, Google Drive and frozen v4.3.2 remain unchanged.
