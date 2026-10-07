# R48 — One quote time and consistent gold menus

- Holding rows, watchlist rows, the stock list and the instrument detail now display one quote timestamp: the provider timestamp when present, otherwise its saved market timestamp or price date. The duplicate price-date line is removed.
- Latest NAV remains visible. When a quote price is present, NAV's separate publication time is available in the value's title instead of another date line. A NAV-only instrument still shows its NAV timestamp. Fetch time is never substituted for source time, and no saved price, NAV or timestamp is changed.
- The HD-2D gold frames from R47 also apply to the annual tabs (收入總覽 / 所得對帳 / 試算與調薪), work calendar tabs (月曆 / 加班紀錄 / 請假紀錄 / 補休帳本), and four home shortcuts. Original and ornate HD-2D retain their distinct border treatments. Active tabs have brighter frames, and the previous underline is removed.
- Small-screen tabs retain horizontal scrolling. Home shortcuts retain a two-column wrap, with padding for icons, text and gold borders. Other themes, salary/investment calculations, market scheduling, Schema 15 and `salarymate_v5_full_state` are unchanged.

Verification: existing NAV rendering regression passed; JavaScript syntax, worker build and single-HTML packaging checked. Frozen v4.3.2 static files are unchanged. No virtual browser or phone visual acceptance was performed.
