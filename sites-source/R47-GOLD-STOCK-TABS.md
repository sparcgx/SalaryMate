# R47 — Gold investment menu frames

The six investment tabs now use opaque blue backgrounds with gold frames in the original and ornate HD-2D themes. The active tab has brighter gold, a second inner frame and heavier text. The ornate theme adds double borders and matching beveled corners. Keyboard focus has a separate visible outline.

The existing horizontal scroll layout stays in place on small screens, with space for the frames, shadows and focus outline. The change adds no motion and uses only HD-2D-scoped screen styles. The other themes keep their existing styles.

Only CSS and development release/cache labels change. Salary, investment calculations, market sync, Schema 15 and `salarymate_v5_full_state` remain as released in R46. Frozen v4.3.2 static files are unchanged.

Verification: clean diff formatting, worker build and JavaScript syntax, and single HTML packaging with 16 compiled inline scripts. No virtual browser or phone visual acceptance was performed.
