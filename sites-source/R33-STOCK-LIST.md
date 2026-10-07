# v5.0.0-dev.2-R33 — stock identity and classification

Added a compact Stocks tab with searchable, categorized, favorite-first listings. Desktop rows expose buy/edit/delete; mobile opens the same actions through the stock name. The official directory searches Taiwan symbols, names and industries and opens a reviewable add-stock form. Adding a stock never adds shares or transactions.

Stock fields: optional favorite, group, typeOverride, industryOverride, exchangeOverride, iconMode, iconData and marketInfo; optional quoteChange/quoteChangePercent. Existing schema 13 and storage key are retained. Full backup and Google Drive synchronization already include the stock portfolio. No new account, holdings or transaction storage is added to the server.

Official classification sources:
- https://openapi.twse.com.tw/v1/opendata/t187ap03_L
- https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O
- https://openapi.twse.com.tw/v1/opendata/t187ap47_L

TWSE/TPEx price Change and close yield the daily percentage against close minus Change. Nasdaq uses supplied net/percentage change. Missing changes remain unknown. Official metadata updates preserve explicit user overrides. Changing the instrument clears the old instrument's quote and profile. Manual price changes clear daily-change figures.

Directory: latest available close, sorted by traded shares, maximum 60 matches. Only instruments matched to the available official company/fund profiles appear; this is not a complete global security directory or popularity ranking. Exact-symbol lookup and manual add remain available when a profile is missing. Search terms are public-instrument queries; the server does not receive accounts, holdings, trades, user categories or icons.

Icons: bundled official-site favicons for 2330 (TSMC), 2409 (AUO), 0050 (Yuanta issuer), with symbol/ETF fallback and editable custom images. Original sources:
- https://www.tsmc.com/themes/custom/bootstrap_sass/images/favicon.ico
- https://auo.com/favicon.ico
- https://www.yuantaetfs.com/favicon.ico

Custom PNG/JPEG/WebP images are read and reduced to 96×96 entirely in the browser, retained in the stock record, and may be removed. No external logo lookup service receives the user's instrument list.

Validation: 7 R33 tests + 19 stock ledger/UI tests passed. Additional existing market/lookup/refresh tests passed in a bounded run. Packaged routes and single-HTML embedded-icon/state checks passed. Real official endpoint fields were inspected. No automated browser or physical-device visual testing was performed.

The prior no-company workflow test now uses the supported quote-refresh control instead of the manual-price button removed in R30. Existing payroll and frozen v4 page sources are unchanged.
