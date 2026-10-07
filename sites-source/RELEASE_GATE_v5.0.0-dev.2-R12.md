# v5.0.0-dev.2-R12 — 4/2 stock forms and automatic expected dividends

## Requested changes

- Transaction editor shown in the supplied screenshot now has four field columns on desktop and two at <=720px. The announcement panel spans the full row. The same layout applies to batch transaction rows and expected-dividend adjustment forms. Nested trade/dividend containers participate in the parent grid; hidden types remain hidden and disabled. Date/time fields keep intrinsic-width limits and mobile padding.
- Opening the dividend/income tab automatically queries official Taiwan stock / ETF announcements for tracked instruments, groups duplicate symbols across accounts, caches them locally, and adds expected dividends. Refresh is also available manually. Existing fresh caches are reused for six hours; failed automatic attempts are throttled. Only public market/symbol/year/forecast selectors leave the device.
- Official forecast lookup spans prior-year ex-dates through next-year announcements, preserving cross-year payment events. Normal historical dividend lookup keeps its original date range.
- Future ex-dates use current held shares as a provisional estimate; passed ex-dates use the position immediately before the ex-date. Ex-date purchases are excluded; ex-date sales do not remove entitlement. Accounts remain separate. Later opening snapshots mark eligibility unknown. Missing dates/amounts and conflicting announcements are not invented or treated as zero.
- Expected amounts remain outside actual cash flow, dividends and income. Users can edit, delete, restore deleted items, reset official values, or explicitly record a received dividend. Overrides persist across refresh; deleted periods are not automatically re-added. Confirmed receipts suppress only the matching forecast. Existing receipts with missing ex-date metadata but the same payment date prompt review instead of allowing a second automatic receipt.
- Announcement results wait while a form is open, merge onto current matching instrument identities, and use existing atomic storage protection. Partial failures retain older announcements; total failure preserves the previous cache.
- Cached announcements and adjustments live on existing asset records, so ordinary/encrypted backups and overwrite/copy imports preserve their identity. Schema 15 and local storage key are unchanged. FIFO and batch accounting remain intact.

## Validation

- Existing R10/R11 regression: 20/20 passed.
- R12 focused checks: 10/10 passed.
- Final single HTML checks: 38/38 passed (R12, R11, R7 backup safety, standalone HTML/portable endpoints).
- Covered cross-year API boundaries, ex-date entitlement, separate accounts, uncertain opening history, pending/zero/conflicting amounts, automatic insertion and deduplication, CRUD/restore/reset, confirmed receipt conversion, stale responses, open-form preservation, concurrent storage rejection, copied accounts, encryption and bilingual UI.
- Tests use the device-local date, matching the application date helper.
- Layout reviewed against the provided desktop screenshot and CSS cascade. No browser or physical-device visual testing, following the user's no-virtual-browser instruction.
- Generated Worker route/version and forecast input validation checked locally before publication.

## Sources and limitations

- Official TWSE investment Q&A explains that ex-date purchases do not qualify and ex-date sales retain that distribution entitlement: https://investoredu.twse.com.tw/pages/TWSE_InvestmentQA.aspx?ID=1 (retrieved 2026-10-04).
- Official announcement feeds and TWSE/TPEx per-share cash fields reused from R10; no yield-based prediction or third-party value fallback. Announcements may not yet contain a payment date or final amount. Expected gross values are estimates, not actual receipts.
- Initial lookup includes upcoming ex-dates, payments due today or later, and recent ex-dates with no announced payment date. Previously tracked unconfirmed events remain available when still returned by the official feed.
- Website and single HTML version: `5.0.0-dev.2-R12`.
