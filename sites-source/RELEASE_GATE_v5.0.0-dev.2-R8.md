# v5.0.0-dev.2-R8

Route: `/dev/v5.0.0-dev.2/` · schema 15 · storage key `salarymate_v5_full_state`.

Changes:

- Added editing for compensatory-time credits and settlements. Existing IDs stay stable, and ledger validation rejects edits that invalidate used or settled hours.
- Added deletion of saved year-end estimates without changing payroll records.
- Added SmartPortfolio import management: edit live assets and transactions, or delete an import group with an explicit summary of affected data. The original archived backup is retained when editing live records.
- Retained existing add/edit/delete workflows for companies, payroll, overtime, leave, income, stocks, transactions, raises and custom rule items.
- Added Chinese / English controls in the upper-right corner, system-language detection, remembered manual preferences and a “System language” option in Settings. Other system languages fall back to English.
- Localized navigation, forms, notices, accessible labels, company rules, stock tools and legal/help content. User-authored text and canonical form values are preserved. Switching language does not rerender the form or discard drafts.
- Added offline locale assets, localized printable reports and a two-row mobile header to keep controls separated from company/year filters.

Validation:

- 98 automated tests passed: `v5-r8`, `v5-r7`, `v5-r6`, `v5-stocks`, `v5-r1`, `v5-full-dom` and `v5-full/*`.
- New tests cover system language and overrides, cross-tab preference changes, draft/selection preservation, canonical select values, unchanged user text, English UI coverage, compensatory-time validation, independent year-end deletion and scoped SmartPortfolio deletion.
- Extended DOM inspection covered company rule forms, manual quotes, stock buy/sell/dividend/split forms, investment tabs and annual-report preview without runtime errors.
- JavaScript syntax, Worker packaging and whitespace checks passed. Schema and previous routes remain unchanged.
- No visual browser session was used, following the user's prior preference. Responsive layout was checked in source; pixel-level browser rendering was not verified.

Build locales through `node scripts/build-locales.mjs`, or run `node scripts/build-stock-worker.mjs` to rebuild locales and package the Worker together.
