# Global engineering rules (GLB-*)

Apply to every package and every task. Each rule cites the interview decision (D-id, see
[../ARCHITECTURAL_DECISIONS.md](../ARCHITECTURAL_DECISIONS.md)) or verified code it rests on.
Enforcement labels: **check `<name>`** = a mechanical check in root `npm run verify` (★ = planned for roadmap P1, not built yet);
**review** = agent and architect review only.

---

### GLB-01 · MUST · Authority: code is the current truth
- **Rule:** Verified implementation is the current truth. A rule or doc that contradicts the code is stale and gets rewritten, unless it is an approved target (every D01–D50 decision is one). A contradiction with no decision goes to [ARCHITECTURAL_CONFLICTS.md](../ARCHITECTURAL_CONFLICTS.md), and a task that depends on it stops and asks.
- **Why:** D50, D01. **Enforce:** review. **Exception:** none.

### GLB-02 · MUST · Verify before using
- **Rule:** Before using any API, core component, utility or pattern, open its source or an existing caller. Never infer an API from names, types or docs alone. Symbols not found under `*/modules/core` (or a verified module usage) do not exist.
- **Why:** existing rule `arpeggio-verify-before-using`, preserved. **Enforce:** review.

### GLB-03 · MUST · Copy the closest canonical; smallest correct change
- **Rule:** Find the closest existing implementation and use it as the primary reference. Make the smallest change that fully works. No speculative abstractions (Base/Abstract/Factory/Manager with no current consumer), no "for later" helpers, no parallel implementations: extend or reuse what exists. A wrong convention is changed platform-wide or not at all.
- **Canonicals:** CRUD `maestro/modules/core/api/auxiliary/private/country.ts` + `sinfonia/src/modules/core/clients/panel/private/tenancy/systemSettings/countries/`; lifecycle `maestro/modules/propertyManagement/api/realEstate/private/unit/reservation.ts` + `reservation.actions.ts`; non-CRUD router `.../realEstate/private/dashboard.ts`.
- **Why:** existing philosophy rule; system-loyalty feedback. **Enforce:** review.

### GLB-04 · MUST · One feature = one contract chain
- **Rule:** A feature is an Armonia contract + Maestro runtime + Sinfonia UI, never types on one side only. Never add a new HTTP framework, ORM wrapper, state library, form engine, test runner or query language.
- **Why:** existing philosophy rule. **Enforce:** review; dependency additions need approval (AGT-04).

### GLB-05 · MUST · Type minimalism
- **Rule:** See [typescript.md](typescript.md) (TS-01). One identical latest-stable TypeScript version in armonia, maestro and sinfonia. New code is written as if `strictNullChecks` + `noImplicitAny` apply everywhere.
- **Why:** D07. **Enforce:** `npm run typecheck` (armonia, sinfonia, maestro; all on TypeScript 5.9.3 and at 0 errors since 2026-11-04).

### GLB-06 · MUST NOT · No data migrations unless asked
- **Rule:** The platform launches on a fresh database. Carry schema changes in schema + SchemaDef + `*.defaults.ts` / demo seeds / default-role grants, and make sure dev `reset` profiles show them. Do not write migration scripts unless the architect asks.
- **Why:** D19. The leftover migration scripts were removed on 2026-11-04. **Enforce:** review.

### GLB-07 · MUST · Definition of done for a new field
- **Rule:** In the same change, update all of the following:
  1. **Contract chain:** Armonia SchemaDef + DTO, Mongoose schema + `I*` (with `validateSchemaDefAgainstMongoose` passing), field ACL, and the snippet if projected.
  2. **UI chain:** ViewConfig create/edit/sheet nodes (VC-02), TableConfiguration column/filter if listable, labels in all 5 locales (FE-10).
  3. **Seeds and defaults:** `*.defaults.ts`, demo data, default-role grants.
  4. **Test:** one for the field's business rule, if it has one.
- **Why:** D20. **Enforce:** review + check `i18n`.

### GLB-08 · MUST · Money
- **Rule:** Store money as `Decimal128` with its currency. Do all arithmetic through the one core money helper using exact scaled integers. Never do float math on amounts. Round once, at defined points (line, tax, document total), to the currency's precision.
- **The helper (D35, built 2026-11-05):** `armonia/src/modules/core/helpers/money.ts`, shared by maestro and sinfonia. Amounts are `bigint` minor units at the currency's `decimalPlaces` (default 2): `toMinor`, `fromMinor`, `sumMinor`, `multiplyMinor`, `percentOfMinor`, `includedPercentOfMinor` (VAT inside a gross price), `allocateMinor` (splits that add up exactly), `prorateMinor` (× factors ÷ divisor, e.g. interest over days). Code that keeps JS numbers uses `addMoney`, `subtractMoney`, `multiplyMoney`, `percentOfMoney`, `roundToCurrency`. Rounding is half away from zero, once. maestro converts to stored `Decimal128` with `decimal128FromMinor` (`maestro/modules/core/utilities/helpers/money.ts`); Stripe amounts come from finance `toStripeAmount`.
- **Rollout:** done in finance, carRental, dentalClinic and propertyManagement (its lease helpers in `rentRemaining.ts` are built on it; payment-plan interest is one shared function, `armonia/src/modules/propertyManagement/helpers/paymentPlanInterest.ts`, used by the server and the sale form preview) and propertyDevelopment, and eCommerce (online sales: each tax rate rounded once so the total is the sum of the breakdown; till: POS sales, refunds, cash moves, Z-report, fiscalization; and the browser's POS payment screen and bill split, which use the server's exact rules). **Done 2026-11-05:** no float money math is left; core `roundMoney` is removed. New code MUST use the helper. Hours, days and ratios are not money: never round them with a money helper.
- **Why:** D35. **Enforce:** review.

### GLB-09 · MUST · Dates and timezones
- **Rule:**
  - Instants are UTC `Date`.
  - Calendar values (rental day, appointment date, birthday, due date) are local strings validated by `isLocalDateZod` / `isTimeOfDayZod`, never a midnight-UTC `Date`.
  - Business rules ("today", expiry, overdue) are evaluated in the company timezone: core `companyTimeZone` / `companyTimeZoneOf` (`Company.timezone`, else `SERVER_TIMEZONE`, else UTC, D91). A location with its own timezone (rental location, clinic location) uses that zone for its slots.
  - dayjs (+ utc, timezone, customParseFormat, relativeTime) is the only date library in all packages. Our code never imports date-fns or moment.
  - Display formatting goes through the one core helper, sinfonia `core/helpers/general/dateTime.ts`: `formatDate` + `DATE_FORMATS` (`Intl` in the language picked in the app, calendar days with `timeZone: "UTC"`; when the browser has no date data for that language, e.g. Albanian in some Chrome builds, the month and weekday names come from dayjs's locale) and `formatRelativeToNow` (dayjs, the user's language). `DateInput` patterns are dayjs tokens (`YYYY-MM-DD`, `YYYY-MM-DD HH:mm`, `HH:mm`).
- **Current state (2026-11-05):** done. No date-fns or moment import is left; armonia `zodBuilder` uses dayjs and evaluates "today" in the company timezone; moment-timezone is removed from armonia and maestro, date-fns from sinfonia (react-day-picker still uses it internally, which is allowed).
- **Why:** D36. **Enforce:** ESLint `no-restricted-imports` (date-fns, moment) in sinfonia, maestro and armonia.

### GLB-10 · MUST · Documentation duties
- **Rule:**
  - Comments say *why*, never restate *what*.
  - Core seams and public core APIs carry JSDoc.
  - A module README is updated when its public surface changes (routes, contributions, env vars, cron/kafka handlers, manifest deps).
  - An APPROVAL REQUIRED decision gets an entry in `ARCHITECTURAL_DECISIONS.md`.
  - Found-but-unfixed debt goes in `TECHNICAL_DEBT.md`.
- **MUST NOT:** create ad-hoc markdown (task summaries, audit notes, handoffs) unless asked.
- **Why:** D44. **Enforce:** review.

### GLB-11 · MUST · Verify before claiming done
- **Rule:** Run the verify and report its output (counts, failures). Never claim checks passed without running them. Two tiers (D135):
  - **Before a commit:** at least `npm run verify -- --changed`. It runs the governance checks and lint, the typecheck of each touched package, and the tests of each touched module plus the modules that import it, and falls back to the full run by itself when armonia, a `core` folder, locale or static files, the checks or baselines, a package's dependencies or test/typecheck/lint scripts, or a file outside a module changed. `--plan` prints the steps without running them.
  - **Full `npm run verify`:** at the end of a multi-lane round or wave, and before a push or deploy.
- **Current state:** `verify` = the seven governance checks (`npm run check`) + armonia/sinfonia/maestro tests + typecheck of all three packages + ESLint for sinfonia, maestro and armonia (one baseline). The solfeggio images re-run typecheck + tests on the assembled modules (deploy gate, 2026-11-06). P1 is complete.
- **Why:** D08. **Enforce:** the gate itself.
