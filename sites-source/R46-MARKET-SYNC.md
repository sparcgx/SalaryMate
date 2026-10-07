# R46 — SmartPortfolio market update mode

Continues the existing SalaryMate development release; reference: SmartPortfolio v1.12.0 market card and update flow. Schema 15 and `salarymate_v5_full_state` are unchanged.

- One market card combines USD/TWD, sync status, last successful sync in Taipei time, FX reference date, actual updated/requested price counts, and saved holding-price freshness.
- Automatic refresh every five minutes while the investment page is visible and idle. Update now remains available when automatic refresh is paused. Individual quote sync can be disabled independently, leaving reference FX refresh enabled.
- Preferences and last sync metadata are optional portfolio fields, retained by JSON restore. Existing manual prices and funds stay manual. Each stock has an explicit automatic/manual mode, with an editable manual price/NAV form.
- Taiwan quotes prefer source-timestamped TWSE MIS trades. Missing, invalid or future trade records fall back to TWSE/TPEx closing data. A dated closing fallback cannot overwrite a later saved intraday trade on the same day. Nasdaq and Frankfurter retain the existing integrations.
- Daily ETF NAV and supported issuer intraday estimates refresh with market quotes, but remain separate from stock valuation and transaction costs. The R44 compact latest-NAV-and-time display stays intact.
- Quote requests contain eligible, deduplicated market/symbol pairs only; a symbol-free request can update FX. No salary, account, quantity or transaction payload is transmitted. Portable HTML uses the existing restricted public-market endpoint.
- In-flight updates are discarded when investment data changes, editing begins, the page is hidden or quote sync is disabled. Failed sources and storage errors preserve prior financial values. Manual prices, transaction FX and FIFO costs are never replaced by the scheduler.

## Verification

`node --test tests/v5-r46-market-sync.test.mjs tests/v5-r40-nav.test.mjs tests/v5-r41-intraday.test.mjs`

31 tests passed: old-data compatibility, restored preferences, manual/fund preservation, price-only update counts, partial/failure states, source-time freshness, older-price rejection, five-minute scheduling, duplicate request prevention, pause/visibility/editing/offline protections, storage failures, latest-trade parsing and closing fallback, portable FX-only requests, public-only request payloads, manual editor saves, bilingual market card, and compact NAV regressions.

The legacy R41 scheduler test now exercises the unified five-minute updater. Its source-outage fixture explicitly opts into automatic prices; the dedicated manual-NAV test still checks manual-price preservation.

No virtual browser or phone visual acceptance was performed. Frozen v4.3.2 static files remain unchanged.
