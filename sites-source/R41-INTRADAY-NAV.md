# SalaryMate v5.0.0-dev.2-R41

2026-10-05. Existing Sites project appgprj_6aa0d52f0f308191b5f325b9a8e004e4.

## Intraday estimated ETF NAV

- Capital and Fubon official public feeds for TWD share classes. Capital JSON and Fubon published table were inspected with real source responses, including issuer timestamps.
- Source time in Taipei, estimated NAV, matching issuer market price and premium/discount. No premium is calculated from an unrelated TWSE closing quote.
- Separate optional `intradayNav`, `intradayNavStatus`, `intradayCheckedAt` metadata. Daily TWSE NAV, valuation quotes, manual quote mode, FIFO costs and transactions are preserved.
- Public `/api/stocks/nav` and its existing portable CORS counterpart. This route queries issuer feeds directly and does not depend on closing-price or daily-NAV availability. Thirty-second shared public cache; no holdings, payroll, account names or transaction data are sent.
- Visible investment page polls at 60-second intervals during weekdays 09:00–13:30 Taipei time. User can pause automatic queries or update manually. Hidden pages, other pages and open editors do not make automatic queries. Results completing after portfolio edits or editor opening are discarded.
- Live, stale (>3 minutes), pre-open, closed, non-trading, failed and unsupported states. Failures retain previous values. State labels also age when automatic queries are paused. Reopening a visible page recomputes freshness.
- Sources without a verified adapter remain explicitly unsupported; coverage is not all Taiwan ETFs. Fund holidays are determined when supplied by the issuer; weekday polling alone does not prove an exchange trading day.
- Traditional Chinese / English labels; wrapping controls and separated value blocks. No new motion effects or transparency changes.

## Validation

`node --test tests/v5-r41-intraday.test.mjs tests/v5-r40-nav.test.mjs tests/v5-r38-rounding.test.mjs`: 20 / 20 passed. Covers source parsing and timestamps, shared cache, independent NAV route, partial outages, malformed/future/older/currency data, data restore, unchanged valuation/FIFO, automatic-update boundaries, editing races, opaque-origin portable route, daily NAV regression, and September overtime 19,665.

Build and JavaScript syntax validated, including 15 embedded modules plus portable bootstrap in the single HTML. Frozen v4.3.2 static files are unchanged. Existing storage key `salarymate_v5_full_state` and Schema 15, backup paths, Google Drive and style variants are retained.

No virtual browser was used. Mobile physical-device visual acceptance has not been claimed.
