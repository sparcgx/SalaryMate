# v5.0.0-dev.2-R13 — Google Drive direct backups

Date: 2026-10-04 (Asia/Taipei)

## Delivered

- Settings → Data management → My Google Drive.
- Browser-only Google Identity Services token flow with `drive.file` permission, not full Drive access.
- Each user supplies a Web application OAuth client ID for their own Google Cloud project. The client ID is kept in that browser, outside business data and exports. No client secret or API key is requested.
- Verified Google account email is shown before a backup can be sent. No local data is uploaded merely by opening the panel or connecting.
- Browser fetches go directly to `https://www.googleapis.com/drive/v3/` and the official resumable-upload endpoint. Every call omits cookies, disables caching and rejects redirects. Upload destinations are constrained to Google Drive.
- Complete payroll/investment snapshots are created as distinct JSON files in the user's Drive folder `個人薪資與投資管理`. Existing snapshots are never overwritten by auto-save or another device.
- Optional existing AES-256-GCM / PBKDF2 backup encryption runs before upload. Passwords and OAuth tokens are never persisted in browser storage, exported, or sent to the website server.
- Explicit session auto-save: saves the initial snapshot, then debounces meaningful saved-data changes for 10 seconds. Unchanged data does not create another copy. Errors, expiration, disconnect and page close stop auto-save; it does not run in the background after the page closes.
- Cloud list, pagination, rename, move to trash, revoke access and remove connection settings.
- Restore downloads straight to the browser, then reuses validated import preview, encrypted-password entry and overwrite/copy/complete-restore options. Restore stops auto-save before showing the import preview.
- Local offline data and local backup downloads remain available. Cloud versions do not silently merge with or replace local state.
- Traditional Chinese / English and responsive glass dialogs. Privacy pages document the actual data paths.

## Activation requirement

No Google OAuth client ID was provided in this session. The published integration is ready for setup, but a real Google account login/upload was not performed and is not claimed as passed.

In the user's Google Cloud project:

1. Enable Google Drive API.
2. Configure Google Auth Platform branding/audience/data access, including `https://www.googleapis.com/auth/drive.file`; add the intended account as a test user while the app is in testing mode.
3. Create a **Web application** OAuth client and add the exact authorized JavaScript origin `https://salarymate.sparcgx2420.chatgpt.site` (no `/dev/` path).
4. Paste the public client ID in the app and connect. Each browser/device must use the same OAuth project to find the same app-created backups.

Direct `file://` opening cannot use Google's web authorization. The standalone HTML still provides all offline features; use the hosted HTTPS edition or a configured localhost origin for Google Drive.

Reference documentation checked 2026-10-04:

- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get

## Verification

47 tests passed, 0 failed, 0 skipped against the generated standalone HTML: R13 direct-Drive behavior (9), R12 dividend forecasts (10), R11 FIFO/batch/dividends (11), R7 backup/merge/encryption/layout (12), single-file/portable market (5).

Drive verification uses intercepted Google Identity/API responses, not a real account. Cases include no traffic before user intent, least privilege, memory-only token handling, account display, direct destination, immutable backups, rename/trash, import preview, local encryption/wrong password, session auto-save and storage integration, rejected grants, 401/403, blocked non-Google upload URLs, escaped remote filenames, revocation, removal of settings, local-file guard and English UI.

JavaScript syntax and `git diff --check`: passed. Worker embeds 80 static assets. Standalone HTML embeds 15 modules. The Site has no Drive backend, no Drive data endpoint, no new D1/R2 storage, and no new persistent personal-data server.

No virtual browser used, following the user's preference. Real Google OAuth/origin and mobile visual acceptance remain for user testing after configuration.

## Compatibility

- Schema 15 and `salarymate_v5_full_state` unchanged.
- v4.3.2 stable route and previous versions preserved.
- Existing encrypted and SmartPortfolio backup formats preserved.
- Existing quote/dividend service continues to receive only public instrument identifiers; Drive backup payloads and Google tokens do not go through it.

