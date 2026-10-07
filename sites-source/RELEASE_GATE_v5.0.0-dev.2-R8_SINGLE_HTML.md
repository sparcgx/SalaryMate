# R8 single HTML distribution

Based on `v5.0.0-dev.2-R8`, schema 15. The hosted application and legacy routes keep their existing behavior.

The standalone document embeds all 13 JavaScript modules, the stylesheet, Chinese/English catalog, offline license content and PNG icons. No script, stylesheet or font download is needed to open it. Service-worker registration is disabled for the standalone distribution. Local-file contexts that reject history URL rewrites keep state-based navigation without rewriting the URL.

Data remains in the browser; no personal records are embedded in the distributed file. Export a backup before moving the HTML file or changing browsers. Website data can be imported through the existing backup workflow. The password-encrypted backup remains optional.

Price updates and ticker-name lookup require a connection to the existing site's public market-data service. Dedicated portable routes accept local-file opaque origins and the site's own origin only. They expose only quote/name lookup, omit credentials, retain the existing request validation and shared rate limit, and never receive company, payroll, account or transaction data. The original API's same-origin restriction remains unchanged.

Build:

```sh
node scripts/build-single-html.mjs /absolute/output.html https://salarymate.sparcgx2420.chatgpt.site
```

Validation:

- All 98 existing checks passed against the inline HTML bundle.
- All 5 portable checks passed: CORS preflight, public quote/name lookup, origin/method/input restrictions, rate limiting, local-file navigation, English switching, encrypted backup round-trip and public-identifier-only client requests.
- JavaScript syntax, Worker packaging and whitespace checks passed.
- DOM checks used jsdom, with simulated local-file storage and Web Crypto. A visual browser session was not used.

Run the existing suites with `SALARYMATE_SINGLE_HTML=/absolute/output.html`, adding `tests/v5-single-html.test.mjs` for portable coverage.
