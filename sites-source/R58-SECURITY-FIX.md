# R58 Security Fix

Baseline: `v5.0.0-dev.2-R57`, commit `c1bf346ac6c2f5cc27bb0eaccfed8edda759ee5d`.

## Changes

- Date validation requires a complete 10-character `YYYY-MM-DD` calendar date.
  Backup collections reject nonempty invalid dates before normalization, merge
  or commit. Missing optional dates remain compatible with older backups.
- Salary-adjustment and year-end summaries HTML-escape effective dates. Saved
  malformed dates are not silently rewritten; invalid adjustments are excluded
  from effective pay calculations and remain available for data health review.
- Public market requests read a bounded UTF-8 stream, stop above 16,000 bytes,
  cancel oversized readers and time out stalled bodies after 10 seconds.
- Rate limiting covers missing/malformed IP metadata with a shared fallback
  bucket (30/minute). The trusted-IP limit remains 30/minute. Each worker also
  has a 600/minute budget and bounded client bookkeeping; active buckets are
  not evicted to admit new identities. Rejections include `Retry-After`.
- Only `/dev/v5.0.0-dev.2/` receives the new CSP and Permissions-Policy headers.
  CSP blocks inline event handlers and limits script/network/frame sources,
  while allowing the existing Google Identity/Drive paths and ChatGPT framing.
- The portable HTML has CSP hashes computed from all 16 emitted inline scripts;
  it allows the same public market origin. HTTP-only `frame-ancestors` is not
  misleadingly placed in the portable meta policy.
- Main-page printing and stock image fallback use existing delegated events,
  so they do not depend on blocked inline handlers. The separate downloaded
  annual print report retains its existing standalone print control.

## Verification

- 18 focused security regression tests: complete dates, malicious imports,
  old data, both output sinks, byte limits, stream cancellation/timeout,
  missing-IP and worker budgets, portable proxy, CSP configuration, stock
  output/image validation, CSV formulas, encrypted backup authentication,
  Google token storage, ownership and redirect protection.
- Existing R38, R42, R46, annual analysis, comp time, reconciliation, copy-month,
  R57 calculation/cache and render-scope suites passed: 75/75. Together with
  the security tests, 93/93 program tests passed.
- `scripts/r58-release-check.mjs` verifies emitted script hashes and syntax,
  generated Worker response headers, frozen-route response preservation,
  release identifiers, Schema 15 and the existing data key.
- Tests use native Node/VM functions and synthetic streams/data only. No
  virtual browser, real financial records or actual Google account are used.

## Boundaries

The limiter is a per-worker application safeguard, not a distributed edge/WAF
quota or a full DDoS guarantee. CSP permits existing inline CSS; it does not
permit inline JavaScript. No deployment-edge header observation or real-device
Google login/visual verification is claimed. The frozen v4.3.2 source and
response policy, payroll/FIFO formulas, Schema 15, `salarymate_v5_full_state`,
backup encryption format and direct-to-own-Google-Drive flow remain unchanged.

References used for compatibility and defense design:
- https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
