# SalaryMate R67 sync

Sites source commit: 1ae68d6997a3c9b357a47a8a890df0a4a8acad49

The topbar Jingyu companion now takes one random six-second flight when tapped, returning to its original position. Tap again or press Escape to stop. Reduced motion uses a static greeting. The overlay does not capture input; navigation, forms, backgrounding, scrolling and resizing clean up the animation.

Source is mirrored under sites-source/. Generated sites-source/dist/server/index.js is omitted and rebuilt by scripts/build-stock-worker.mjs.

Six existing rendering/translation/Pages tests, native lifecycle and bounded-route checks, JavaScript syntax, worker/portable build and release gates passed. No virtual browser was used; physical-device visual acceptance is pending.

Built on restored R65. The cancelled R66 index feature stays removed. Schema 15, salarymate_v5_full_state, Google Drive and frozen v4.3.2 remain unchanged.
