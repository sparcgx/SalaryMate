# PAX-04｜Loading / Empty / Failure State Hardening

Status: **IMPLEMENTATION REGRESSION PASS / DEVICE QA PENDING**

## State contract
- Web: `Idle / Loading / Ready / Empty / Invalid / Failure`
- Operation: `Idle / Loading / Submitting / Failure`
- Android: `Loading / Empty / Invalid / Ready / Failed`

`Loading ≠ Empty`, `Empty ≠ Invalid`, `Invalid ≠ Failure`.

## Runtime safety
- Corrupt startup storage renders Failure, not Empty.
- Startup read failures never auto-write a blank state.
- Invalid Current Company blocks operational pages and routes recovery to Company Management.
- Company switch persists first; failed persistence rolls UI/memory back to the previous company.
- Destructive writes and restore use rollback-safe commit behavior.
- Restore input is parsed/validated before mutation.

## Regression
- Executable source gates: **25 / 25 PASS**
- Product FAIL: **0**
- Schema: `13`
- Version Drift: `0`
- Source Manifest: **256 files / 0 SHA errors**
- ZIP integrity: **PASS**

Core byte-identical to PAX-03 R1:
- NativePayrollMath
- NativeSalaryMateRepository
- Storage
- Snapshot Store
- Backup Crypto
- Native Backup

Environment pending:
- Production build: `esbuild` dependency unavailable
- Android SDK / Gradle / physical device
- iOS Foundation parser/native build: `xcode` npm module unavailable

Source SHA-256: `58c2bf04d745ee26e825ef1e36c0452c9a9957a2fe50b36dac07e0072650a212`

Next: **PAX-05｜Navigation / Draft / Context Operational Safety**
