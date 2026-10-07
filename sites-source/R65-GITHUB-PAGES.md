# R65 — GitHub Pages compatibility

- Publish the portable development app at `/SalaryMate/dev/v5.0.0-dev.2/` on the existing Pages site.
- Permit exactly `https://sparcgx.github.io` at the public read-only portable market routes; preserve method/header/body limits and credential stripping.
- Other origins remain rejected. No payroll or backup upload endpoint added.
- Sites and GitHub Pages have separate browser storage. Use the existing backup export/import to move data. Google Drive uses the user's own OAuth client and may require adding the GitHub Pages origin to that client.
- Frozen v4.3.2 root files remain unchanged. Schema 15 and `salarymate_v5_full_state` stay unchanged.
- Validation: native CORS/security tests and release build; phone visual and OAuth sign-in acceptance not claimed.
