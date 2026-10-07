# v5.0.0-dev.2-R10

## Requested changes

- Phone transaction forms use a single column, including nested dividend fields. Date/time/month inputs and grid children are constrained to their containers; iOS native input appearance no longer supplies an unconstrained minimum width.
- Desktop tables have synchronized horizontal scrollbars above the table. Resize, table replacement, keyboard scrolling, trackpad scrolling and cleanup are handled. Mobile retains normal table swipe behavior.
- Dividend forms query TWSE and TPEx public announcements using only market, symbol and year. The user can select an event and apply the announced ex-dividend date and cash dividend per share. An exact unique payment-date match can fill empty fields. Existing values survive errors; stale responses cannot fill another stock or dialog. Pending amounts stay unknown.
- Announcement source links and lookup time are saved with the transaction. Manual changes remove the applied-source label. Actual gross receipts, fees and taxes remain separately entered.
- Monthly reconciliation has an explicit “all amounts match” action. It fills matching amounts and marks review complete in one step, preserving source fingerprint, stale-tab protection and source warnings. Entered differences are not overwritten.
- Updated Chinese/English labels, R10 cache versions and portable HTML. Stable routes, schema and storage key remain unchanged.

## Official source verification

Observed public responses on 2026-10-04 Asia/Taipei:

- TWSE ETF distributions: `/rwd/zh/ETF/etfDiv` with `stkNo`, `startDate`, `endDate`, `response=json`.
- TPEx ETF distributions: `https://info.tpex.org.tw/api/etfExDiv`, the form POST used by the official ETF portal, with `lang=zh-tw`.
- TWSE `TWT48U_ALL` and TPEx `tpex_exright_prepost` current announcements.
- TWSE historical event list `TWT49U` plus `TWT49UDetail` explicit cash-dividend field. Combined rights + dividend values are never used as cash dividends. At most 24 recent stock events are queried per period, in bounded groups.
- Successful live source samples inspected: 0050, 2330 and 00836B. Blank/pending source values remain null, including partially available sources.

Coverage is Taiwan stocks and ETFs. TPEx individual-stock lookup uses available recent announcements; historical issuer coverage can vary. Other markets are explicitly left for issuer-announcement entry. Lookup uses the payment year and prior year. Network errors are visible and do not change saved financial data.

## Verification

- 50 final checks passed against the generated single HTML: R10 changes, R9 metadata and deletes, R8 localization/editing, stock ledger/UI, and portable API behavior.
- Earlier source regression passed 70 checks; final resolver changes were verified in the R10 tests above.
- New checks include official endpoint mapping, pending values, partial outage, mixed rights/dividend precision, exact-period fill, manual override, stale responses, gross/net preservation, one-click reconciliation and safeguards, top-scroll synchronization, and language switching.
- Generated Worker smoke checks: the v5 R10 route returns 200; dividend input validation returns 400; the portable dividend preflight returns 204.
- JavaScript syntax and diff checks passed. No virtual browser or iPhone session used; phone layout changes were reviewed against the supplied screenshot and CSS structure.
