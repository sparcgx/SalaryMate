# v4.3.0-dev.3｜Real-Device Acceptance

Status: **PENDING_DEVICE_QA**

Required physical flow:

Launch → Current Company A → Quick Entry → Payroll A → Create B → Switch B → Payroll B → Switch A → Verify isolation → Backup → Modify → Restore → Restart.

Required zero-tolerance values:
- Wrong-company Write = 0
- Context Leakage = 0
- Stale Company Exposure = 0
- Duplicate Commit = 0
- Data Loss = 0

Lifecycle:
- Background → Foreground preserves Draft / Context.
- Force Close → Relaunch preserves persisted data and never auto-commits an unsaved Draft.

Backup:
- State A → Backup → State B → Restore → State A.
- Corrupt / unsupported backup leaves existing data unchanged.

Upgrade:
- Existing installation must be upgraded in place.
- No uninstall and no app-data clear.
- Historical OT physical count must be verified after upgrade.

This checklist is not PASS evidence until executed on real devices.
