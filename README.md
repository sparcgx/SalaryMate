# SalaryMate

目前開發分支狀態見 [v4.3.1-dev.1](DEV_v4.3.1-dev.1.md)；可編輯程式位於 `app-source/`。以下 v4.3.0 內容保留為歷史證據，最新正式 Identity 請參照根目錄 `version.json`。

## Current Formal Release Promotion

**v4.3.0｜Formal Release & Stable Freeze**

Canonical Source SHA-256:

`bfef4c6de7901d55933fc9730b00f4ad7355aa6ea075ec41a0547998cfde1c97`

- Release target: `4.3.0`
- Schema: `13`
- Android versionCode: `18`
- iOS build: `6`
- Full source regression: **47 PASS / 0 FAIL**
- RC source freeze: **PASS**
- Source Manifest: **324 files / 0 SHA errors**
- ZIP integrity: **PASS**
- Full platform build/device: **PENDING_ENVIRONMENT**
- Physical device QA: **PENDING_DEVICE_QA**
- Stable promotion: **NOT AUTHORIZED**

GitHub stores the version-governance/evidence index for the v4.3 line. The exact executable RC.1 source is the canonical ZIP identified by the SHA above.

Android PDQ-01~09 and iOS PDQ-01~10 physical QA are complete and PASS. RC.2 is eligible for formal v4.3.0 promotion; final signed v4.3.0 binary identity remains a separate Formal Binary Gate.


### Formal Binary Gate

Formal source freeze is PASS. The signed v4.3.0 APK/AAB and iOS Release build must be rebuilt with the existing production signing identities before stable/v4.3.0 is created. RC.2 binaries are validation evidence only and are not relabeled as v4.3.0 binaries.
