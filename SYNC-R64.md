# SalaryMate R64 source sync

Current development version: **5.0.0-dev.2-R64** (Schema 15).

- Source: `sites-source/` (269 tracked source, asset, test and release files).
- Sites source commit: `8cd8a1cdd2f578954e1580244e25cf0c2ea78318`.
- Development site: https://salarymate.sparcgx2420.chatgpt.site/dev/v5.0.0-dev.2/
- Frozen v4.3.2 root files and stable branches remain unchanged.

This is a source snapshot; prior Sites Git history is not imported. Tests that compare historical commit IDs require that original history.

## Build

From `sites-source`, run `node scripts/build-stock-worker.mjs` to regenerate `dist/server/index.js` (generated output omitted from this sync). Run `node scripts/build-single-html.mjs /absolute/path/SalaryMate-R64.html https://salarymate.sparcgx2420.chatgpt.site` for the portable HTML.

This sync does not change GitHub Pages configuration. The Sites URL above remains the development deployment. Private salary/investment records are stored on the user's device and are not included.
