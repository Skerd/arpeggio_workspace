# Technical debt catalogue

Only items listed here with a **defined fix** may be fixed during unrelated tasks, and only inside code the task already
changes (AGT-06 / OPT-04). Larger items are scheduled in [OPTIMIZATION_ROADMAP.md](OPTIMIZATION_ROADMAP.md).
Add found-but-unfixed debt at the bottom of the right section (GLB-10).

Columns: **ID · Debt · Where · Defined fix (when touched) · Rule**

## Backend / maestro
| ID | Debt | Where | Defined fix | Rule |
|---|---|---|---|---|
| TD-B01 | Direct model statics outside services (~300) | `api/**` in all modules | Move the query into the entity's `*.service.ts` and call it | DB-03 |
| TD-B02 | Raw value Zod in Armonia validators | `armonia/src/modules/*/api/**/*.form.validator.ts` | Replace each raw check with the `zodBuilder` helper; infer the form type | BE-06 |
| TD-B03 | Zod defined outside Armonia (7 files) | maestro eCommerce `fiscal.ts`, `productOrder.ts`, `checked/posSession.ts`, `posOrder.ts`, `inventoryMovement.ts`, `public/shopProductReviews.ts`; sinfonia `listingCategories/editCategory.tsx` | Move to an Armonia `*.form.validator.ts` using helpers | BE-06 |
| TD-B04 | `throw new Error` for business/provider rules | `eCommerce/utilities/fiscalization/fiscalizationService.ts`, `propertyManagement/api/realEstate/public/marketingAvailability.ts:41` | Use `apiValidationException` + a key in 5 locales | BE-07 |
| TD-B05 | Notifications emitted before commit | propertyManagement (e.g. `reservation.actions.ts:448`, `realEstateNotificationHandlers` callers) | Wrap in `runAfterCommit(session, …)` | BE-08 |
| TD-B06 | Field-write check used as action permission | PM `reservation.actions.ts` `cancel` (and similar) | Interim: `SchemaGuard.checkModelPermission` / party guard; full fix with SEC-02 seam | SEC-02 |
| TD-B07 | PATCH used as a state machine | `core/api/company/private/users.ts` (`/unlock*`, `/resend*Email`) | Convert to `@action` POST | BE-03 |
| TD-B08 | `console.*` (188) | maestro, mostly PM `realEstateNotificationHandlers.ts`, core, eCommerce | Replace with `params.logger` / `getLogger` | BE-11 |
| TD-B09 | Aggregates without `deletedAt` (12 files) | `finance/.../escrowTransaction.ts`, `core/api/auxiliary/private/stats.ts`, edifice/project/floor services… | Add `deletedAt: null` to the first `$match` (until the D15 hook) | DB-04 |
| TD-B10 | Full workflows in `utilities/services/*` | `posService.ts`, `rentalLifecycle.ts`, `rentalReservationService.ts`, `checkoutPlacementService.ts`, `appointmentLifecycle.ts`… | Gradual: one-entity transitions → actions (after `invokeAction`); cross-entity → `workflows/`; adapters → `integrations/` | BE-01/02 |
| TD-B11 | Plugin gaps without a listed reason | 192 schemas (see discovery) | Add the plugin, or an exemption entry with one of the 3 reasons | DB-01 |
| TD-B12 | `validateSchemaDefAgainstMongoose` missing | core 21, eCommerce 7, finance 5, dentalClinic 3, carRental 2, propertyManagement 1, swissOutreach 1 | Add the call next to the schema | DB-05 |
| TD-B13 | Float money math / duplicate money helpers | core `roundMoney`, `parseMoneyInput`, `optDecimal`, ~20 cents files | Use PM scaled helpers (core helper after P3) | GLB-08 |
| TD-B14 | Hand-written CRUD verbs | `core/api/company/private/users.ts`, `core/api/user/private/data.ts`, `eCommerce/.../private/cart.ts` | Migrate to `createCrudRouter` where the resource is CRUD | BE-03 |
| TD-B15 | Unused-looking helpers that throw plain `Error` | `transactionUtils.ts` `withSession`, `getSessionAwareOperations` | Verify consumers (AGT-05) → remove or convert | AGT-05 |
| TD-B16 | moment-timezone | maestro deps, armonia `zodBuilder.ts` | Replace with dayjs + tz | GLB-09 |

## Module boundaries / core purity
| ID | Debt | Where | Defined fix | Rule |
|---|---|---|---|---|
| TD-M01 | finance → eCommerce imports | `finance/database/schemas/{paymentTransaction,escrowTransaction,giftCard}/*.defaults.ts` | Move the demo seeding of those records into eCommerce | CORE-02 |
| TD-M02 | sinfonia PM → PD imports | `constructionProgressSection.tsx:11`, `deliveryReadinessCard.tsx:13` | Move the components into PD, or render through a contribution | CORE-02 |
| TD-M03 | Core names verticals | `maestro/modules/core/environment/validator.ts:176,185` | Env-validator contribution seam (approval) | CORE-01 |
| TD-M04 | Core tests import a vertical | sinfonia `viewEngine/_tests/formRenderers.test.tsx:9`, `formWidgets.test.tsx:8` | Replace with core fixtures | CORE-01 |
| TD-M05 | Replace-style seams | `createCrudRouter` `beforeDelete` (replaces `assertCanDelete`), `overrideRestoreHandler` | Make the hooks additive (approval: core change) | CORE-04 |
| TD-M06 | Header switch cluster | `EntityListPageProps` (~10 header props) | `header` slot + exported parts (approval) | CORE-03 |
| TD-M07 | Armonia Node built-ins | `armonia/src/modules/core/helpers/exceptions.ts`, `discoverModuleLocales.ts` | Static JSON imports / injected loader | D37 |

## Frontend / sinfonia
| ID | Debt | Where | Defined fix | Rule |
|---|---|---|---|---|
| TD-F01 | Direct `apiClient` in components (138 files) | eCommerce 36, core 33, PM 33, dental 17, carRental 11, swissOutreach 6 | `withAxios` (component) / `useHttpRequest` (hook) | FE-03 |
| TD-F02 | Extra axios instance | `core/helpers/chat/publicChat/publicChatClient.ts:46` | Review; use `apiClient` or document it as an exception | FE-03 |
| TD-F03 | Refetch counters in Redux | `uiSlice` `newCompanyCreated`, `newUserCreated`, `editUser` | `EntityListRefs` / `tableUpdateContext` | FE-05 |
| TD-F04 | Raw interactive HTML / duplicate primitives | raw `<button>` 153, `<select>` 17, `<table>` 14; Tooltip/Button/Select duplicates; direct `sonner` Toaster in public/portal | `components/ui` primitive | FE-07 |
| TD-F05 | Extra icon libraries | lucide, MDI, remixicon, radix-icons | tabler (simple-icons for brands) | FE-07 |
| TD-F06 | Page factory bypasses | roles create/edit; swissOutreach campaigns/prospects/createCampaign; eCommerce categories create/edit | Generic factories / exported parts | FE-02 |
| TD-F07 | Eager panel pages | route contributions (eCommerce 112, PD 136, PM 81, carRental 58 imports) | `React.lazy` per page | FE-06 |
| TD-F08 | Wrong locale folders | swissOutreach `fr-CH`/`it-CH` | Rename to `fr-FR`/`it-IT`, translate | FE-08 |
| TD-F09 | Dead / orphan translation files | ~33 core en-US (beyond the ~30 legacy paths), PM `components/ui/{edificeCard,projectCard}.json` | Verify (AGT-05), then remove | FE-08 |
| TD-F10 | date-fns imports (9 files) | auditTimeline, quickFilterBar, dateInput, PM/eCommerce views | dayjs (after the dependency is added) | GLB-09 |
| TD-F11 | `as any` (471) / `@ts-ignore` (8) | sinfonia | Fix the type at its source | TS-01 |
| TD-F12 | Leftovers | `routeConfig.tsx:74` (`menu === "test"` → `111`), stale `vite.config.ts` base comment, eslint ignore `apps/shop`, `lint:tokens` missing script, coverage include path, commented StrictMode | Remove / fix | GLB-03 |
| TD-F13 | Failing sinfonia tests (found 2026-11-04 by root verify, cause not investigated) | `sinfonia/scripts/studioSourceIndex.test.ts` ("finds the create/edit sharing…": 38 vs >40), `sinfonia/src/modules/core/clients/studio/catalog/studioModules.test.ts` (eCommerce vs eCommerceMarketplace), `sinfonia/src/modules/core/components/entityPage/list/card/_tests/displayRow.test.tsx` (denied row reported to group) | Investigate: stale test expectation vs regression in uncommitted work | TST-02 |

## Tooling / repo
| ID | Debt | Where | Defined fix |
|---|---|---|---|
| TD-T01 | Vacuous maestro typecheck, 242 TS 5.9 errors | maestro | P1 |
| TD-T02 | Dockerfile `sed`-patches armonia `zodBuilder.ts`; prod runs `ts-node-dev --watch` | `solfeggio/apps/maestro/Dockerfile` | Fix the source error; tsc gate; compiled runtime later |
| TD-T03 | Leftover migrations | `maestro/scripts/migrations/*` and its `migrate:*` npm scripts; root `scripts/migrate-entity-cards.mjs` (the architect removed the other root migration scripts and the root migrations folder on 2026-11-04) | Remove (approval) |
| TD-T04 | musicIndustry remnants | manifest, `@musicIndustry` aliases, `maestro/scripts/import-music-catalog.ts`, sinfonia JSON | Remove (approved, D31) |
| TD-T05 | Unused deps / double lockfile | sinfonia zustand, @tanstack/react-router, shadcn runtime, faker runtime; `yarn.lock` + `package-lock.json` | Remove (dependency approval) |
| TD-T06 | Broken scripts | maestro `test:pdf-extraction`; sinfonia `runXAndY` (root `run.txt` was removed by the architect on 2026-11-04) | Remove/fix |
| TD-T07 | Stale armonia copy | `sinfonia/node_modules/armonia` (copied by `coreInstallAndDev`) | Switch the script to a link or the alias only |
| TD-T08 | README drift | maestro/sinfonia/armonia READMEs (C9) | Update |
