# Testing standards

Rule IDs: [rules/testing.md](rules/testing.md) (TST-01..07). Decisions: D24, D25.

## Tooling (verified)
| Package | Runner | Environment | Helpers |
|---|---|---|---|
| maestro | vitest ^1.6 (`maestro/vitest.config.ts`, tsconfig paths only) | node | one `mongodb-memory-server` replset per run (`modules/core/_tests/mongoGlobalSetup.ts`; transactions work), each DB-backed file on its worker's database (emptied per file) via `connectTestDatabase` / `disconnectTestDatabase` (`modules/core/_tests/testDatabase.ts`), `modules/core/_tests/httpHarness.ts` (Express app + auth stub; `loopbackServer` for a hand-built app), `vi.mock` |
| sinfonia | vitest ^4 (`sinfonia/vitest.config.ts`) | jsdom, globals, `src/test/setup.ts` | Testing Library + jest-dom |
| armonia | vitest ^4.1 (`armonia/vitest.config.ts`; the stale `vitest.config.js` sits next to it), run by root `npm test` | node | none |

Test files live in colocated `_tests/` folders. Do not use `__tests__` or add a second runner.

## Keeping verify fast
Root `npm run verify` targets about 3 minutes. It used to take 20+, and nearly all of that time was setup, not tests.

- **Parallel steps:** `scripts/verify.mjs` runs the checks, lint, the three test suites and the three typechecks side by side, longest first, `VERIFY_JOBS` at a time (default 4). Each step prints its counts when it ends, and a failing step prints its whole output; full logs go to a temp folder named in the last line. Without the maestro suite, every step together takes about 40 s.
- **Maestro files run 4 at a time:** `maestro/vitest.config.ts` sets `maxWorkers: 4`. More workers mostly queue on the single in-memory `mongod`.
- **One database per worker, not per file:** `connectTestDatabase` uses `test_worker_<VITEST_POOL_ID>`. It empties every collection when a file starts (it never drops one, even a collection only an earlier file's models used, but such a collection loses its unique indexes, so a fixture that writes to it directly never depends on which file ran before), then runs `Model.init()` for every registered model. Each collection and its indexes are built once per worker, so later files only clear data.
  - Before (2026-11-07), every file created a fresh database and built every model's collections and indexes: about 170 files × about 200 models. The suite took about 10 minutes, with `mongod` busy and vitest idle.
  - Until TD-B184 (2026-11-23), a file dropped the collections its own models did not use, so the next file that used them built them again: about 2,600 drops a run, and `Model.init()` took 1,320 of the suite's 1,590 summed seconds. Building one collection or index is a step `mongod` runs one at a time for all workers.
- **Writes are acknowledged without a disk sync:** `mongoGlobalSetup.ts` sets the test replica set's default write concern to `w: 1`. With the default majority, every write on the one node waited for its journal to reach the disk (about 6 ms an insert, 30 ms a collection or index). Reads see the same data either way. Do not set `majority` in code or tests without a reason; it brings the wait back.
  - Keep `Model.init()`: a transaction gets 5 ms to take a collection lock, so creating a collection or building an index inside one fails it with LockTimeout (TD-B19).
- **Diagnosing slowness:** check CPU (`ps -Ao pcpu,command | grep -E "vitest|mongod"`). A busy `mongod` with an idle vitest means setup work per file; look at what `connectTestDatabase` or a file's `beforeAll` builds before blaming the tests.
- **Scoped verify (D135):** `npm run verify -- --changed` runs only what the uncommitted changes of the 25 repos can affect: the checks, lint, the touched packages' typechecks, and the touched modules' tests plus the modules that import them. Anything whose reach a module cannot bound (armonia, `core`, locale and static files, checks and baselines, dependencies, files outside a module) makes it run in full. `--plan` lists the steps.
- **Agent lanes:**
  - Lanes run only their own new or changed test files, once, plus tsc and the checks.
  - A single change is verified with `--changed` before its commit; one full `npm run verify` runs at the end of a wave, not per lane or per round.
  - Findings after a lane's round become TECHNICAL_DEBT.md rows, not new rounds.

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
