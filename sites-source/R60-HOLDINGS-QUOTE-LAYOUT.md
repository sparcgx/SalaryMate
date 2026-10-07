# R60 — Consistent holdings quotes

My holdings now reuses the R59 quote summary: price with M/D on the left,
daily percentage change on the right, and the latest ETF NAV below. The
column heading is shortened to Quotes. The shared holdings/closed-position
table uses the same renderer, while stock details still show full source,
currency and timestamp information.

The existing ledger widths and horizontal scrolling are retained. A scoped
rule lets NAV text wrap within the quote cell. Price precision, close/latest
labels, unavailable values, gain/loss colors and theme borders are inherited
from the stock-list component. No valuation, FIFO, transaction or stored-data
logic changes.

Validation: compare both views using native Node rendering fixtures, check
the unchanged portfolio and holding calculations, verify English labels,
and run the existing portable/CSP release gate. No virtual browser or phone
visual/touch acceptance is claimed. Stable v4.3.2 and Schema 15 stay frozen.
