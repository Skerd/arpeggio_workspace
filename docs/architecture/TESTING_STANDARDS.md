# Testing standards

Rule IDs: [rules/testing.md](rules/testing.md) (TST-01..07). Decisions: D24, D25.

## Tooling (verified)
| Package | Runner | Environment | Helpers |
|---|---|---|---|
| maestro | vitest ^1.6 (`maestro/vitest.config.ts`, tsconfig paths only) | node | `mongodb-memory-server` replset (transactions work), `modules/core/_tests/httpHarness.ts` (Express app + auth stub), `vi.mock` |
| sinfonia | vitest ^4 (`sinfonia/vitest.config.ts`) | jsdom, globals, `src/test/setup.ts` | Testing Library + jest-dom |
| armonia | vitest ^4.1 (`armonia/vitest.config.ts`; the stale `vitest.config.js` sits next to it) | node | none |

Test files live in colocated `_tests/` folders. Do not use `__tests__` or add a second runner.

## What a change must carry
| Change | Required test |
|---|---|
| Action / workflow / service with a business rule | vitest. DB-backed (memory replset) if it writes in a transaction, pure otherwise |
| Bug fix | regression test that fails before the fix |
| Core component / helper / seam | core test with core fixtures (never vertical imports) |
| ViewConfig-only feature UI | none, unless it has custom logic |
| Integration adapter | test against a fake adapter |
| Pure display field | none |

There is no coverage-percentage target. Untested modules (propertyDevelopment 0, swissOutreach 0, most sinfonia
features) are not backfilled wholesale: tests arrive with changes, and P5 prioritizes the launch modules.

## Live verification
Every touched layer gets verified live:
- **API:** a real request against a dev profile, checking the database effect.
- **UI:** a browser click-through of the changed flow, including the empty, error and permission-denied states.

If the environment can't run, the report says **"NOT live-verified"** and the work is unfinished. See `.claude/skills/verify/SKILL.md` for endpoints, headers and the auth procedure. The password-hash swap needs approval (AGT-07).

## Test quality
- Assert the effect (DB rows, response shape, emitted after-commit tasks), not internal calls.
- One behavior per test name. Use realistic tenant fixtures (two companies when tenancy matters).
- Never weaken an assertion or skip a test to get green. Report the failure instead.
- Known flakiness: some maestro tests hit 5 s timeouts under load. Re-run before reporting, and report it if it persists.
