# SalaryMate v4.3.1-web — Stable / Freeze

Date: 2026-09-29 (Asia/Taipei)

- User authorized Stable / Freeze promotion after reporting High Motion real-device testing OK.
- Scope: Web/PWA release only; promoted from v4.3.1-web-dev.2.
- Changes at promotion: release identity, PWA asset/cache version, and release evidence only. No new feature or payroll logic change.
- Automated regression: 15 PASS / 0 FAIL; identity, Schema 13, payroll storage, baseline hashes and asset checks PASS.
- User-reported High Motion real-device acceptance: PASS. Device-specific battery/performance benchmarking is not claimed.
- Payroll storage remains salarymate_v310_state. Appearance remains salarymate.visualEffects.v1. No data migration or clearing.
- Android/iOS native Gate: UNVERIFIED. Native data-safety BLOCKER: OPEN. Neither is reclassified by this Web freeze.
- GitHub stable/v4.3.1-web and freeze/v4.3.1-web must reference the same final release commit.
- Preserve stable/v4.3.0 and freeze/v4.3.0. Future feature changes branch from this release; do not modify the frozen baseline directly.
- Freeze is a release governance designation; no server-enforced branch protection is claimed.
