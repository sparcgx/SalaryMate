# R59 — Compact stock-list quotes

The stock list now uses the requested two-column quote layout. Price and M/D
appear in the left column, daily percentage change in the right column, with
the latest available ETF NAV below. Source, currency and the full timestamp
remain in the quote tooltip and existing stock details.

Only recognized TWSE/TPEx closing sources use the Close label. Latest-trade
quotes use Latest; manual prices use Price. Missing quotes or percentage
changes remain unavailable, not zero. Prices retain up to four decimal places
with a two-decimal minimum; percentage changes show two decimals. No saved
values, valuation calculations, market feeds or refresh logic change.

The component inherits active theme colors, including the HD-2D gold rule.
At widths up to 540 px, quotes span the row below the stock identity to leave
room for both numeric columns. The existing icon/symbol/name layout remains.
Labels support Traditional Chinese and English.

Validation uses native Node rendering fixtures, existing security and market
regressions, syntax/build checks and the CSP-aware portable release gate.
No virtual browser is used; phone visual/touch acceptance is not claimed.
Schema 15, device storage key, Google Drive flow and frozen v4.3.2 stay intact.
