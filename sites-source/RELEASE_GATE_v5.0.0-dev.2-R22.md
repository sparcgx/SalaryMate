# R22 — Align desktop stock page with the shared layout

The stock-only 1920px workspace override widened the top bar and shifted the centered 1200px content to the right, unlike the user's correct home-page reference. Removed that override so stock pages use the shared 1500px shell and existing responsive margins.

Stock heading now shares the standard page-heading theme treatment and desktop typography. Stock action buttons keep their labels on one line and do not shrink; wide tables retain their existing scrolling mechanism.

Validated computed shell/content dimensions before and after switching Home → Investment → Home in JSDOM, all six stock header actions, shared heading markup, and stock table presence. Worker rebuilt; syntax and whitespace checks pass. No virtual browser used. Financial behavior, storage, and stock content are unchanged.
