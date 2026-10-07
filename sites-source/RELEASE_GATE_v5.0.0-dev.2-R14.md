# v5.0.0-dev.2-R14 — Google Drive 403 diagnosis

Date: 2026-10-04 (Asia/Taipei)

The user saw the generic Google Drive access-denied message in R13. That text combined unrelated failures, so the actual cause could not be inferred from the report. The Drive OAuth token is held only in the user's browser and Drive calls go directly from the browser to Google; there is no Site-side Drive request log or authorized way to read that user's Google error response here.

R14 interprets Google's `error.errors[].reason` and `google.rpc.ErrorInfo.reason` on 403. The UI now shows the operation (account verification, list, folder creation, upload, read, or edit), a targeted action and a sanitized reason code. It differentiates disabled Drive API in the **same project as the OAuth client ID**, missing `drive.file` permission, a different app/client for an older file, file editing permissions, full storage, quota/rate limits and organization policies. Unknown or malformed reasons are displayed only as `未提供`, with a precise operation and safe fallback instructions. Google's arbitrary message, request URL, OAuth token, backup content and IDs are never copied into the diagnostic.

The user's current local records and Drive files remain unchanged on an unsuccessful request; no fallback upload to the Site or another service is introduced. R13 storage schema, local state key, backup format, 15-module standalone build and Drive direct-call architecture remain intact.

Official references:

- https://developers.google.com/workspace/drive/api/guides/handle-errors
- https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get

Verification: 49/49 pass, 0 fail or skipped, using the generated standalone HTML. The R13/R14 targeted cases plus R12, R11, R7 and standalone-file regressions model Google's nested `SERVICE_DISABLED` detail, `insufficientPermissions`, `storageQuotaExceeded`, missing/malicious reason codes, and assert no local data mutation or exposure of Google's arbitrary error text. No real Google-account response was available, so R14 cannot claim to know which reason caused the user's previous 403. Browser QA omitted following the user's no-virtual-browser request.
