# Global engineering rules (GLB-*)

Apply to every package and every task. Each rule cites the interview decision (D-id, see
[../ARCHITECTURAL_DECISIONS.md](../ARCHITECTURAL_DECISIONS.md)) or verified code it rests on.
Enforcement labels: **check `<name>`** = a mechanical check in root `npm run verify` (★ = planned, roadmap P1, not yet built);
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
- **Why:** D07. **Enforce:** check `tsc` ×3 ★ (today only sinfonia's typecheck is real; maestro's TS 4.8 check is vacuous).

### GLB-06 · MUST NOT · No data migrations unless asked
- **Rule:** The platform launches on a fresh database. Carry schema changes in schema + SchemaDef + `*.defaults.ts` / demo seeds / default-role grants, and make sure dev `reset` profiles show them. Do not write migration scripts unless the architect asks.
- **Why:** D19. Existing `maestro/scripts/migrations/*` and root `scripts/migrate-*` are leftovers (see TECHNICAL_DEBT). **Enforce:** review.

### GLB-07 · MUST · Definition of done for a new field
- **Rule:** In the same change, update all of the following:
  1. **Contract chain:** Armonia SchemaDef + DTO, Mongoose schema + `I*` (with `validateSchemaDefAgainstMongoose` passing), field ACL, and the snippet if projected.
  2. **UI chain:** ViewConfig create/edit/sheet nodes (VC-02), TableConfiguration column/filter if listable, labels in all 5 locales (FE-10).
  3. **Seeds and defaults:** `*.defaults.ts`, demo data, default-role grants.
  4. **Test:** one for the field's business rule, if it has one.
- **Why:** D20. **Enforce:** review + check `i18n` ★.

### GLB-08 · MUST · Money
- **Rule:** Store money as `Decimal128` with its currency. Do all arithmetic through the one core money helper using exact scaled integers. Never do float math on amounts. Round once, at defined points (line, tax, document total), to the currency's precision.
- **Current state:** the core helper does not exist yet (roadmap P3). PM's bigint helpers in `maestro/modules/propertyManagement/utilities/lease/rentRemaining.ts` (`moneyToScaled`, `scaledToDecimal128`, `moneyNumber`) are the base it will be promoted from. Until then, reuse those or the module's existing scaled helper, and never `roundMoney` float sums.
- **Why:** D35. **Enforce:** review.

### GLB-09 · MUST · Dates and timezones
- **Rule:**
  - Instants are UTC `Date`.
  - Calendar values (rental day, appointment date, birthday, due date) are local strings validated by `isLocalDateZod` / `isTimeOfDayZod`, never a midnight-UTC `Date`.
  - Business rules ("today", expiry, overdue) are evaluated in the company timezone.
  - dayjs (+ utc, timezone, customParseFormat, relativeTime) is the only date library in all packages. Our code never imports date-fns or moment.
  - Display formatting goes through one core helper (roadmap).
- **Current state:** sinfonia still has 9 date-fns files and armonia/maestro list moment-timezone (debt, P3).
- **Why:** D36. **Enforce:** lint restricted-imports ★.

### GLB-10 · MUST · Documentation duties
- **Rule:**
  - Comments say *why*, never restate *what*.
  - Core seams and public core APIs carry JSDoc.
  - A module README is updated when its public surface changes (routes, contributions, env vars, cron/kafka handlers, manifest deps).
  - An APPROVAL REQUIRED decision gets an entry in `ARCHITECTURAL_DECISIONS.md`.
  - Found-but-unfixed debt goes in `TECHNICAL_DEBT.md`.
- **MUST NOT:** create ad-hoc markdown (task summaries, audit notes, handoffs) unless asked.
- **Why:** D44. **Enforce:** review.

### GLB-11 · MUST · Full verify before claiming done
- **Rule:** Run root `npm run verify` and report its output (counts, failures). Never claim checks passed without running them.
- **Current state:** `verify` = sinfonia+maestro tests, sinfonia typecheck, sinfonia lint. Target (P1): + armonia tests, tsc ×3, and the ★ checks.
- **Why:** D08. **Enforce:** the gate itself.
