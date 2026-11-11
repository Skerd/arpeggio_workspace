# Architectural conflicts

Contradictions between code, docs and rules. Per GLB-01, a conflict with no decision blocks any task that depends on it
(AGT-01c). Add new conflicts at the bottom with status **OPEN**.

| ID | Conflict | Resolution | Status |
|---|---|---|---|
| C1 | Rule required `maestro/modules/<m>/module.json` and forbade a parent manifest; none exist, and the code/deploy read an unversioned root `scripts/` manifest | Rule was a leftover of a reverted change. One manifest, moved into maestro core (D01a). CORE-06 | RESOLVED (moved 2026-11-05: `maestro/modules/core/modules.manifest.json`) |
| C2 | Rule/memory: sinfonia `src/modules/base` is transitional and holds the widgets | `base` is gone; widgets are in `core/components/viewEngine/widgets` | RESOLVED (docs fixed) |
| C3 | Rule: HTTP only via `useHttpRequest`/`withAxios`; 138 files call `apiClient` directly, plus an extra axios instance and raw fetch | D09: `withAxios` for components, `useHttpRequest` for hooks, `apiClient` only in core helpers; existing sites are debt | RESOLVED (debt) |
| C4 | Rule: "never a second Zod schema"; widespread hand Zod in Armonia, and Zod in maestro/sinfonia | D11: hand Zod allowed in Armonia only, built from `zodBuilder` helpers | RESOLVED (debt) |
| C5 | Declared edges violated: maestro finance→eCommerce, sinfonia PM→PD, core string refs | D02/D03 | RESOLVED (debt) |
| C6 | Rule "always all four plugins" vs README "not every schema takes the full stack" vs reality | D12: all four by default, three listed exemption reasons | RESOLVED (list in P1) |
| C7 | PM emits notifications before commit; other modules defer | D06 | RESOLVED (seam built 2026-11-05) |
| C8 | Migrations in two places, three conventions | D19: fresh start, migrations are leftovers | RESOLVED (removal needs approval) |
| C9 | READMEs: 4 servers vs 6, incomplete alias tables, `sync:module-aliases` claim, armonia layout | Update READMEs in P0/P1 (GLB-10) | RESOLVED 2026-11-06: maestro, sinfonia and armonia READMEs rewritten against the code (6 servers, full alias tables, manifest `dependsOn`, 13 contribution kinds, alias sync, apps, 5 locales, lint, module links) |
| C10 | `.cursor/rules/arpeggio-viewconfig.mdc` says "never add widgets" vs D04 seam policy | VC-03: a new widget token = APPROVAL REQUIRED seam | RESOLVED |
| C11 | Root `verify` covers only sinfonia typecheck/lint; maestro's TS 4.8 typecheck is vacuous | D07/D08 | RESOLVED (P1) |
| C12 | `pushAll.sh` says "21 repos (3 cores + 18 modules)" and skips solfeggio; there are 25 | Update the script comment/coverage when the workspace repo is created | RESOLVED 2026-11-09 (roadmap P6: the script walks all 25 repos) |
| C13 | D11 says no Zod outside Armonia. The `check:zod` baseline finds 60 maestro/sinfonia files, about 40 of them AI assistant tool-parameter schemas (`maestro/modules/*/domain/ai/tools/*`), plus sinfonia Vite env validation (`sinfonia/src/modules/core/helpers/environment/env.ts`) and more route files than discovery found (finance, carRental, dentalClinic, PM) | D51: both exempt (not client/server contracts); route-file Zod stays baselined debt | RESOLVED |
| C14 | GLB-09 says calendar values (due dates, claim periods, warranty ends, permit expiry, sale date) are local strings validated by `isLocalDateZod`; propertyDevelopment stores 43 and propertyManagement about 25 such fields as midnight-UTC `Date`, and PM validators pass a hard-coded `"UTC"` to `notInTheFutureZod` (`createSale`, `createPaymentPlan`, `recordTitleTransfer` validators, `reservation`/`sale` SchemaDefs): `validateFormZod` passes no timezone to armonia `(languageCode, form)` factories, so company-timezone validation needs a new core seam (CORE-03); PM crons already use company days since Wave 2 (found 2026-11-10) | Needs an architect decision: convert the fields to local strings through schema + SchemaDef + seeds (GLB-06, no migration), or accept `Date` for these modules and evaluate them with `localDateOf` | RESOLVED 2026-11-10 by D115 (local strings, module by module) + D116 (company-timezone validation seam); work tracked in roadmap P7 |

## Open decisions
None from the interview (U01 was resolved by D49). Items that need a decision later:
- **Hosted CI:** when more than one human pushes (D08).
