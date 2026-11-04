# Testing rules (TST-*)

The full standard is in [../TESTING_STANDARDS.md](../TESTING_STANDARDS.md). The IDs live here so that other files can cite them.

- **TST-01 · MUST:** a new or changed action, workflow or service with business rules gets a vitest test. Use a DB-backed test (mongodb-memory-server **replset**) when the code writes in a transaction; otherwise a pure test. *(D24)*
- **TST-02 · MUST:** every bug fix adds a regression test that fails before the fix. *(D24)*
- **TST-03 · MUST:** core components, helpers and seams have tests using core fixtures, never vertical code. *(D24, CORE-01)*
- **TST-04 · MAY:** feature UI driven purely by ViewConfig needs no component test, unless it contains custom logic. *(D24)*
- **TST-05 · MUST:** use vitest only. Tests sit in a colocated `_tests/` folder, never `__tests__`. Integrations are tested with fake adapters, never live providers. *(existing rule; D40)*
- **TST-06 · MUST NOT:** coverage-percentage targets, or wholesale backfill of untested modules. Tests arrive with changes. *(D24)*
- **TST-07 · MUST:** verify every touched layer live (API request + DB effect; browser click-through incl. empty, error and permission-denied cases), or report "NOT live-verified" and treat the task as unfinished. *(D25)*
