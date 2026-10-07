# R66 — Personal real-time Taiwan index chart

## Choice

Use Fugle's documented browser WebSocket `indices` channel plus intraday quote/candles and index catalog endpoints. The personal basic plan lists one connection, five subscriptions, and 60 intraday API calls/minute; this panel uses one active index subscription. It requires the user's own API key.

TradingView's widget documentation says paid personal plans do not upgrade embedded exchange data, and the current widget market list does not list TWSE. Therefore it is not labelled or used as a free real-time TAIEX substitute.

References checked 2026-10-07:
- https://developer.fugle.tw/docs/pricing/
- https://developer.fugle.tw/docs/data/websocket-api/getting-started/
- https://developer.fugle.tw/docs/data/websocket-api/market-data-channels/indices/
- https://developer.fugle.tw/docs/data/http-api/intraday/quote/
- https://developer.fugle.tw/docs/data/http-api/intraday/candles/
- https://developer.fugle.tw/docs/data/http-api/intraday/tickers/
- https://www.tradingview.com/widget-docs/faq/data/
- https://www.tradingview.com/widget-docs/markets/asia-pacific/

## Behavior

Replace the prominent market-controls area with a compact Taiwan index panel. Keep the existing holdings quote/NAV controls in a collapsed `Holdings updates` group. Start with TAIEX IX0001; populate switchable indices from the provider's INDEX catalogs instead of guessing codes.

Show provider timestamp once, latest value, daily change only when the provider supplies a valid same-day reference, and actual intraday history. Stream ticks update the last minute point; missing data is never filled with invented points or zero. Ignore old or invalid timestamps; a new trading day clears old reference values. Use source closed/stale states. Data remains in memory.

The key lives only in a closure for the page session. Password input is cleared after submit; disconnect erases the key. Only the exact Fugle API/WebSocket origin receives the key, directly from the browser. No SalaryMate proxy, payroll data, portfolio, or backup is sent to Fugle. No key is added to storage, source, logs, or exports. Direct HTTP requests omit cookies and reject redirects.

Pause on navigation away, page background/offline/pagehide. Resume uses one connection and ignores callbacks from prior sessions. Connection failures use bounded exponential retry. Updates touch only the chart/metrics region; existing stock timers and FIFO remain unchanged.

## Validation

31 native tests passed: seven new index connection/data/privacy tests plus existing rendering/security/Pages compatibility coverage. Syntax/build/portable release gate applied. No virtual browser was used. Real authorized provider login, intraday end-to-end delivery, mobile visual validation and OAuth sign-in are unverified until the user enters their own API key.

Schema 15 and `salarymate_v5_full_state` remain unchanged; v4.3.2 is frozen.
