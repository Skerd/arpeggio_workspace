# Architectural conflicts

Contradictions between code, docs and rules. Per GLB-01, a conflict with no decision blocks any task that depends on it
(AGT-01c). Add new conflicts at the bottom with status **OPEN**.

| ID | Conflict | Resolution | Status |
|---|---|---|---|
| C1 | Rule required `maestro/modules/<m>/module.json` and forbade a parent manifest; none exist, and the code/deploy read `scripts/modules.manifest.json` (unversioned) | Rule was a leftover of a reverted change. One manifest, moved into maestro core (D01a). CORE-06 describes today + target | RESOLVED (move = P3) |
| C2 | Rule/memory: sinfonia `src/modules/base` is transitional and holds the widgets | `base` is gone; widgets are in `core/components/viewEngine/widgets` | RESOLVED (docs fixed) |
| C3 | Rule: HTTP only via `useHttpRequest`/`withAxios`; 138 files call `apiClient` directly, plus an extra axios instance and raw fetch | D09: `withAxios` for components, `useHttpRequest` for hooks, `apiClient` only in core helpers; existing sites are debt | RESOLVED (debt) |
| C4 | Rule: "never a second Zod schema"; widespread hand Zod in Armonia, and Zod in maestro/sinfonia | D11: hand Zod allowed in Armonia only, built from `zodBuilder` helpers | RESOLVED (debt) |
| C5 | Declared edges violated: maestro finance→eCommerce, sinfonia PM→PD, core string refs | D02/D03 | RESOLVED (debt) |
| C6 | Rule "always all four plugins" vs README "not every schema takes the full stack" vs reality | D12: all four by default, three listed exemption reasons | RESOLVED (list in P1) |
| C7 | PM emits notifications before commit; other modules defer | D06 | RESOLVED (debt + seam P3) |
| C8 | Migrations in two places, three conventions | D19: fresh start, migrations are leftovers | RESOLVED (removal needs approval) |
| C9 | READMEs: 4 servers vs 6, incomplete alias tables, `sync:module-aliases` claim, armonia layout | Update READMEs in P0/P1 (GLB-10) | OPEN (doc fix) |
| C10 | `.cursor/rules/arpeggio-viewconfig.mdc` says "never add widgets" vs D04 seam policy | VC-03: a new widget token = APPROVAL REQUIRED seam | RESOLVED |
| C11 | Root `verify` covers only sinfonia typecheck/lint; maestro's TS 4.8 typecheck is vacuous | D07/D08 | RESOLVED (P1) |
| C12 | `pushAll.sh` says "21 repos (3 cores + 18 modules)" and skips solfeggio; there are 25 | Update the script comment/coverage when the workspace repo is created | OPEN (tooling) |

## Open decisions
None from the interview (U01 was resolved by D49). Items that need a decision later:
- **Field-level encryption for health data:** decide before the dentalClinic launch (SEC-06.5).
- **Production runtime:** when to replace `ts-node-dev --watch --transpile-only` with compiled JS (D07, P1/P3).
- **Hosted CI:** when more than one human pushes (D08).
