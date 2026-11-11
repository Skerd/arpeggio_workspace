# Architecture discovery report

The read-only source investigation of 2026-11-04 (three parallel sweeps plus targeted checks), done before the interview.
Labels: **VERIFIED** (seen in code) · **DOCUMENTED** (docs only) · **INFERRED** · **UNKNOWN** · **CONFLICT** (code ≠ docs/rules).

## Workspace
- VERIFIED: 25 git repos.
  - 4 roots on branch `new_main`, plus 7 vertical repos in each of maestro/armonia/sinfonia.
  - The workspace root is not a repo; it holds `.cursor/rules` (12 files), `.claude/skills/verify`, `scripts/` (dev profiles, manifest, loose migrations) and personal/media files.
- VERIFIED: Armonia is consumed as source:
  - maestro: tsconfig `paths` + `node_modules/armonia` symlink;
  - sinfonia: Vite/vitest alias. `sinfonia/node_modules/armonia` is a stale copied directory (drift).
- VERIFIED: no CI, no git hooks, no import-boundary tooling.

## Maestro
- VERIFIED: 6 servers (README says 4, CONFLICT). Route auto-discovery. `createCrudRouter` with 7 verbs. 381 `@action` methods in 111 files (347 transactional).
- VERIFIED: `BaseCrudService` (1,462 lines) does not add the company filter.
- VERIFIED: plugin coverage across 192 schema files: 18 lack ownership, 19 audit, 26 softDelete, 67 lifeCycle; 15 have none.
- CORRECTION: "propertyDevelopment has no createdAt" is false. `auditPlugin` sets `timestamps: true`.
- VERIFIED: about 300 direct `Model.op(` calls in `api/` files.
- VERIFIED: about 1,285 `apiValidationException` uses. `fiscalizationService` throws plain `Error` (500s).
- VERIFIED: `runAfterCommit` is used 23 times (carRental, dentalClinic, eCommerce, finance). PM emits notifications before commit.
- VERIFIED: actions get no automatic model-permission check. PM `reservation.cancel` uses a field-write check as the permission and returns a misleading error.
- VERIFIED: the server context travels in `req.body`. `validateFormZod` keeps raw client keys, and no reserved-key stripping exists.
- VERIFIED: public company resolution fell back to a wildcard/platform company (fixed by D18). CORRECTION: "two host resolvers" was wrong; `siteHost.ts` builds site hosts, it does not resolve them.
- VERIFIED: `softDeletePlugin` doesn't cover `aggregate`; 12 aggregate files lack `deletedAt`.
- VERIFIED: TS 4.8.4, non-strict. `tsc` is vacuous (stops on zod 4 `.d.cts` parse errors). TS 5.9 finds 242 errors (PD 158, PM 37, core 23, eCommerce 10, scripts 5, swissOutreach 4, finance 4, carRental 1).
- VERIFIED: 188 `console.*` calls. Logger is Winston `serverLog.ts`.
- VERIFIED: tests: 99 files (core 41, PM 22, eCommerce 17, carRental 9, dental 5, finance 5, PD 0, swissOutreach 0).
- VERIFIED: business logic is spread across actions, `utilities/services/*` (multi-trigger workflows), route hooks and thin services.
- VERIFIED: `@action` only records metadata. No system actor exists.

## Sinfonia
- VERIFIED: one app per build (`VITE_SINFONIA_APP`): core panel, portal, studio (dev), PM public, dyeus.
- VERIFIED: 12 contribution kinds. CONFLICT: the old rule listed 5.
- VERIFIED: `EntityListPage` used by 149 pages. Generic create/edit used by 131/145 and 128/134 pages. Bypasses: roles create/edit, swissOutreach, eCommerce categories.
- CONFLICT (HTTP rule): `withAxios` in 500 files, `useHttpRequest` in 15, direct `apiClient` in 138 (44 inside `useEffect`). One extra `axios.create`, 3 raw `fetch`.
- VERIFIED: Redux has 6 slices and no entity lists. CONFLICT: `uiSlice` refetch counters.
- CONFLICT: `src/modules/base` no longer exists (the old rule and memory said it was transitional).
- VERIFIED: route contributions eagerly import every page, so the panel ships as one chunk.
- VERIFIED: UI duplication: Tooltip/Button/Select duplicates, raw `<button>` in 153 files, 6 icon libraries.
- VERIFIED: i18n:
  - 5 locales, path-literal guard test (~1,151 calls);
  - swissOutreach `fr-CH`/`it-CH` folders never match;
  - ~63 core en-US files have no source file.
- VERIFIED: TS `strict:false` but `strictNullChecks`/`noImplicitAny` on. 471 `as any`.
- VERIFIED: ESLint is generic, `no-explicit-any` off, 6 jsx-a11y rules as warnings. `lint:tokens` points to a missing script.
- VERIFIED: tests: 129 files (123 core). The coverage `include` points at a missing path.
- VERIFIED: unused dependencies: zustand, @tanstack/react-router, shadcn (CLI) as a runtime dep. Both `package-lock.json` and `yarn.lock` exist.

## Armonia
- VERIFIED: contents: SchemaDef + builders, ~50 `zodBuilder` helpers, DTOs, ViewConfig types, filter DSL, exceptions. No reverse imports.
- VERIFIED: not isomorphic. `exceptions.ts` and `discoverModuleLocales.ts` use `fs` at load. `zodBuilder` imports moment-timezone.
- CONFLICT (Zod rule): hand-written Zod share: core 68/96, PM 59/121, PD 136/225, eCommerce 40/132. Zod outside Armonia in 7 files.
- VERIFIED: `strict: true`, TS 5.9.3, 6 tests, never run by root `verify`.

## Cross-cutting
- CONFLICT: the modules rule required `module.json` (none exist); the real manifest was the root `scripts/` copy, which was unversioned (moved to `maestro/modules/core/modules.manifest.json` on 2026-11-05, D01a).
- CONFLICT: dependency edges: maestro finance→eCommerce (5), sinfonia PM→PD (2), core string references to verticals.
- VERIFIED: money is Decimal128 in 139 files, with several arithmetic helper sets. Dates: dayjs (101 files), date-fns (9), moment-timezone (1).
- VERIFIED: migrations live in two places with three safety conventions. Leftovers per D19.
- VERIFIED: deployment:
  - Docker Compose on a single host, multi-instance;
  - the maestro image runs `ts-node-dev --transpile-only --watch` and seds a patch into armonia;
  - `pushAll.sh` covers 24 of 25 repos.
- UNKNOWN: whether any public route is actually exploitable through client-sent server keys (SEC-03 says to check per route).
