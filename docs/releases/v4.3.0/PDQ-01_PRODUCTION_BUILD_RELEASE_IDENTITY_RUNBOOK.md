# PDQ-01｜Production Build & Release Identity Runbook

Status: **READY TO EXECUTE / PHYSICAL BUILD NOT_RUN**

This runbook is derived from the frozen v4.3.0-RC.1 Canonical Source. It does not change product code.

## Canonical package
- Source ZIP SHA-256: `bfef4c6de7901d55933fc9730b00f4ad7355aa6ea075ec41a0547998cfde1c97`
- Product: `4.3.0-RC.1`
- Schema: `13`

## Android — Windows

### Required identity
- Release package: `com.salarymate.personal`
- Debug package: `com.salarymate.personal.debug`
- Release versionCode: `18`
- Release versionName: `4.3.0-RC.1`

### Build
Use the existing release signing key; do not create a new keystore.

From the extracted RC.1 source root, run PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\BUILD_SIGNED_ANDROID_WINDOWS.ps1
```

The script:
1. validates keystore / alias / passwords;
2. runs `npm ci`;
3. runs Android doctor;
4. runs source/regression tests;
5. runs runtime dependency audit;
6. builds Web assets;
7. runs Capacitor Android sync;
8. compiles Android unit / instrumentation test APK;
9. builds signed Release APK + AAB;
10. verifies signatures, package, versionCode/versionName and unexpected permissions.

Expected outputs:
- `output\SalaryMate_v4.3.0-RC.1-release.apk`
- `output\SalaryMate_v4.3.0-RC.1-release.aab`

### Connected-device automated gate
Connect and authorize the physical Android device, then run:

```bat
RUN_RC1_DEVICE_GATE_WINDOWS.cmd
```

Expected result directory:
- `test-results\formal-v4.3.0-RC.1\...`

This gate verifies the connected Debug instrumentation path only. Manual upgrade / backup / lifecycle / accessibility evidence remains required.

### Data-preserving Release upgrade
Before install:
- export two usable `.salarymate` backups;
- record company / payroll / OT / leave / snapshot counts;
- do not uninstall;
- do not clear App data.

Then run:

```bat
INSTALL_TO_ANDROID_WINDOWS.cmd
```

The installer uses `adb install -r` and requires the existing Release package to be present. It records pre/post identity reports and verifies versionCode 18 / versionName 4.3.0-RC.1.

## iOS — macOS

### Required identity
- Release bundle ID: `com.salarymate.personal`
- Debug bundle ID: `com.salarymate.personal.iosdev`
- CURRENT_PROJECT_VERSION: `6`
- MARKETING_VERSION: `4.3.0`
- SalaryMate product identity: `4.3.0-RC.1`
- Deployment target: iOS 16.0+

### Prepare native project
From the extracted RC.1 source root:

```bash
./PREPARE_IOS_MAC.command
```

This requires macOS, Node.js 22.13+ and Xcode 26+. It installs locked dependencies, runs regressions, syncs iOS assets/plugins, resolves Swift packages, then opens `ios/App/App.xcodeproj`.

### Foundation / simulator gate
Run:

```bash
./RUN_IOS_FOUNDATION_GATE_MAC.command
```

The automated iOS gate performs Xcode version verification, locked dependency install, regression tests, iOS sync, package resolution, isolated simulator build and XCTest validation.

### Physical Release build
In Xcode:
1. select target `App`;
2. select the existing signing Team;
3. select the physical iPhone;
4. use the Release configuration / Release bundle identity `com.salarymate.personal`;
5. build and install without deleting the existing app/data when performing the in-place upgrade test.

Physical iPhone upgrade, backup/restore, lifecycle, VoiceOver and manual acceptance remain separate PDQ gates and cannot be inferred from simulator success.

## PDQ-01 PASS rule
PDQ-01 can become PASS only when both platform build identities are verified from real build outputs. A source-level identity check alone is insufficient.

Until then:
- PDQ-01 = PENDING
- Physical Device QA = PENDING
- v4.3.0 Stable = BLOCKED
