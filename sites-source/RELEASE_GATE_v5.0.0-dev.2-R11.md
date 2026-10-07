# v5.0.0-dev.2-R11 — automatic dividends, FIFO, batch transactions

## Changes

- Taiwan stock / ETF dividend forms automatically match official announcements by the entered payment date. Exact payment-date matches take priority; otherwise use the latest eligible announcement, excluding announced future payments. Sources without a payment date match by ex-dividend date and visibly ask the user to check the period. Pending and conflicting amounts are not guessed. Selecting a period fills both ex-date and cash dividend immediately. Manual edits turn off automatic replacement. Gross receipts remain explicit user-entered statement values.
- FIFO replaces moving-average realization. Each account/instrument retains purchase lots with original fee-inclusive local and TWD costs. Sales consume oldest lots in date, time, then insertion order. Partial sales allocate that lot's costs proportionally; splits alter quantities while retaining cost. Sale rows expose matched dates, quantities and TWD costs. Remaining average price describes remaining FIFO inventory. Existing transaction data remains unchanged; computed historical gains and remaining costs change to FIFO. The established backup/import quantity-rounding tolerance is retained.
- SmartPortfolio full-history imports accept compatible legacy average or FIFO snapshots, preserve explicit transaction times, and explain FIFO recalculation. Snapshot imports keep their opening basis and do not invent missing purchase lots.
- Batch transactions support up to 100 rows: buys, sales, dividends, splits and opening holdings; add, edit, duplicate and delete draft rows. Excel tab-separated paste supports buy/sell rows and resolves an unambiguous existing instrument/account. Preview checks the complete chronological ledger, shows FIFO/cash impacts, and requires acknowledgement for matching duplicate entries. Editing invalidates review. One atomic commit uses existing operation locks and storage conflict protection. Each saved entry uses the normal transaction edit/delete controls.
- Batch dividend rows also fetch and apply official values, sharing lookups for the same symbol/year. Failed, late or detached responses do not overwrite drafts.
- Mobile batch fields use one column; desktop retains the existing frosted glass layout and top table scrollbar. Chinese and English labels retained.

## Validation

- Source regression: 54/54 passed (R11, stock ledger/UI, SmartPortfolio/market integration, R10).
- Single HTML validation: 33/33 passed (R11, portable APIs, backup merge/encryption, R9 metadata and edit/delete).
- Final FIFO compatibility refinement: 30/30 passed against regenerated single HTML (R11 and stock ledger/UI).
- Covered cross-lot fees/taxes/FX, full and fractional exits, split/reverse split, same-day chronology, account isolation, historical/as-of calculations, oversell rejection, manual and automatic dividend selection, ambiguous announcements, delayed responses, batch paste/CRUD/review, duplicate acknowledgement, stale-tab/storage rollback, payroll preservation, reload and bilingual output.
- Generated Worker syntax and local route smoke checks verified before publication.
- No browser or physical-device visual test was performed, following the user's instruction not to use a virtual browser.

## Compatibility and scope

- Schema 15 and local storage key `salarymate_v5_full_state` unchanged.
- Stable root and other development routes untouched.
- Announcement endpoints and official TWSE/TPEx sources reused from R10; no estimated yield or third-party amount fallback. Lookups require a connection. Some stock announcements do not include payment dates; period selection remains available.
- This is a transaction ledger. It does not submit brokerage orders.
- Site and single HTML release carry `5.0.0-dev.2-R11`.
