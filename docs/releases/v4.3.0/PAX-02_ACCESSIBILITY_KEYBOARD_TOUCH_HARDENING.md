# PAX-02｜Accessibility & Keyboard / Touch Hardening

Status: **IMPLEMENTATION REGRESSION PASS / PHYSICAL ACCESSIBILITY QA PENDING**

## Web
- Skip link to main content.
- Route changes move focus to the page heading.
- Dialog Tab / Shift+Tab trap, Escape guard and return-focus behavior.
- Backdrop close uses Dirty Guard.
- Required/help/invalid form semantics.
- Payroll 3-step semantic progress.
- Keyboard-accessible backup file trigger and radio groups.
- 44 px coarse-pointer controls and 48 px text controls.
- Large-text wrapping and reduced-motion support.

## Android Compose
- Shared page/section heading semantics.
- Custom home actions expose Button role.
- Quick-entry custom choices expose selected-state description.
- Decorative short bottom-navigation labels / monogram are removed from screen-reader semantics.

## Regression
- Executable source gates: **23 / 23 PASS**
- Product FAIL: **0**
- Version Drift: **0**
- Schema: **13**

Core byte-identical vs PAX-01 R1:
- NativePayrollMath
- NativeSalaryMateRepository
- Storage
- Snapshot Store
- Backup Crypto
- Native Backup

## Pending
- Android TalkBack / soft-keyboard physical QA
- iOS VoiceOver / Dynamic Type physical QA
- Production build / native toolchain validation

Source SHA-256: `aa52632f13ce3678db7142c823ac16969298c1fb7b61b242cdff551f1a5ae5a7`

Next: **PAX-03｜Form Validation & Error Messaging**
