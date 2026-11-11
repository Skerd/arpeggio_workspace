# Development workflow

The mandatory protocol for every meaningful task. Rule references point into [rules/](rules/) and [AI_AGENT_RULES.md](AI_AGENT_RULES.md).

## The 16 steps
| # | Step | What it means here |
|---|---|---|
| 1 | Understand the change | Restate the user-visible outcome. Ambiguous about behavior? AGT-01a → ask. |
| 2 | Identify areas | Which packages, modules and layers (service/actions/workflow/integration/route/UI), and which repos (nested!). |
| 3 | Inspect existing code | Read the schema, query, caller and closest canonical (GLB-03). A name, URL param or on-screen control is not evidence that behavior exists. |
| 4 | Locate reusable core | [CORE_USAGE_GUIDE.md](CORE_USAGE_GUIDE.md): seams, factories, helpers (`zodBuilder`, money, snippets, `runAfterCommit`). |
| 5 | Identify applicable rules | [README.md](README.md) routing table. |
| 6 | Evaluate architectural impact | Does it cross a module edge (CORE-02)? Touch core (CORE-03)? Need a new seam? Hit an open decision? |
| 7 | Decide on clarification | AGT-01 (a)–(d) → stop and ask; else note assumptions. |
| 8 | Plan the minimal correct change | Smallest change that fully works; definition of done (GLB-07) for schema changes; no migrations (GLB-06). |
| 9 | Implement | Copy the canonical, no unrequested expansion, debt only per AGT-06. |
| 10 | Verify correctness | Tests per TST-01..03 (regression test for bug fixes). |
| 11 | Run checks | `npm run verify -- --changed` for a change before its commit; the full root `npm run verify` at the end of a multi-lane round and before a push (GLB-11, D135). The full run: governance checks (about 1 s), all test suites, typecheck of all three packages and lint, run side by side by `scripts/verify.mjs` (target about 3 min; see TESTING_STANDARDS.md "Keeping verify fast"). |
| 12 | Live verification | TST-07: API against a dev profile + DB effect; UI click-through incl. empty, error and permission-denied cases. See `.claude/skills/verify/SKILL.md`. |
| 13 | Review the diff | Every nested repo touched; no debug code, no unrelated churn, no apiServer debug connects. |
| 14 | Identify unintended changes | Formatting rewrites, regenerated `tsconfig.json` (sinfonia vite rewrites module paths), lockfile churn. |
| 15 | Report decisions | AGT-09 sections 1–4. |
| 16 | Report verification + concerns | AGT-09 sections 5–7. |

## Dev environment (verified)
- Profiles: `npm run dev -- up|reset <profile>`, with profiles ecommerce, carRental, dentalClinic, propertyManagement and all. Each has its own DB, Redis DB, Kafka prefix and ports (81/91/101/111/121). See `scripts/dev/README.md`. `reset` is destructive (AGT-07).
- Manual start: `cd maestro && npm run api:development`; `cd sinfonia && npm run coreDev`.
- Tests: root `npm test` runs armonia, sinfonia and maestro.

## Definition of done
- [ ] Outcome proven live at every touched layer (AGT-10, TST-07)
- [ ] Tests added per TST-01..03, `npm run verify` green, output in the report
- [ ] GLB-07 chain complete for schema changes (contract, UI, 5 locales, seeds/defaults/roles)
- [ ] No new rule violations; debt fixed only per AGT-06, new debt logged
- [ ] README / ADR / TECHNICAL_DEBT updated where GLB-10 requires
- [ ] Report in AGT-09 shape; approvals requested, not assumed
