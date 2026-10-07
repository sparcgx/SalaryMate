# R26 — Navigation and surface consistency

- Primary sidebar/mobile dock, top toolbar, and utility menu keep their theme's solid surface and do not change with panel transparency. Navigation controls also remain solid.
- Recent salary rows, salary record headers/details, table headers/cells, and summary subdivisions now inherit the outer panel visually instead of retaining solid backgrounds or stacking additional transparency.
- Nested cards/stat panels inside a parent panel or dialog use a single outer background/blur layer.
- Hover uses a subtle row-level tint with transparent cells, preventing opaque stripes and double-painted table headers. Selected calendar dates and primary actions retain their meaningful accent states.
- Rules are screen-only; financial calculations, saved choices, and print rendering are unchanged.

Validated all three transparency modes with fixed navigation and transparent inner salary/table surfaces using JSDOM (screen media branch explicitly applied). CSS parsing, Worker build, JavaScript syntax and whitespace checks pass. No virtual browser used; actual-device visual acceptance remains user verification.
