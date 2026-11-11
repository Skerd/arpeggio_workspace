# Arpeggio engineering governance: index

Start here for every task (AGT-12). The text in `docs/architecture/` is canonical. `.cursor/rules/*.mdc`, `/CLAUDE.md` and
`/AGENTS.md` only point here (D29). Rule IDs are stable, so cite them in reports and reviews.

## Always applies
| File | IDs | What |
|---|---|---|
| [AI_AGENT_RULES.md](AI_AGENT_RULES.md) | AGT-01..12 | ask vs act, approvals, git, deletion, verification, report shape |
| [rules/global.md](rules/global.md) | GLB-01..11 | authority, canonicals, types, no migrations, field DoD, money, dates, docs, verify |
| [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) | — | the 16-step protocol + definition of done |

## By area: read the ones your change touches
| You are touching… | Read |
|---|---|
| anything under `*/modules/core/**`, module registration, cross-module imports | [rules/core.md](rules/core.md) (CORE-*) + [CORE_USAGE_GUIDE.md](CORE_USAGE_GUIDE.md) |
| maestro routes, actions, services, cron, kafka, integrations, logging, validators | [rules/backend.md](rules/backend.md) (BE-*) |
| Mongoose schemas, queries, indexes, plugins, seeds, money/date storage | [rules/database.md](rules/database.md) (DB-*) |
| auth, permissions, tenancy, public routes, sensitive data, AI tools, webhooks | [rules/security.md](rules/security.md) (SEC-*) |
| sinfonia pages, contributions, HTTP calls, state, UI, i18n, a11y | [rules/frontend.md](rules/frontend.md) (FE-*) |
| `*.views.ts`, form/sheet pages, viewEngine | [rules/viewconfig.md](rules/viewconfig.md) (VC-*) |
| what a panel page shows: cards, tables, sheets, forms, filters, money/date display, defaults | [rules/ux.md](rules/ux.md) (UX-*) |
| `*.snippets.ts`, armonia DTOs, mappers | [rules/snippets.md](rules/snippets.md) (SNP-*) |
| any `.ts/.tsx` (types, assertions, defensiveness) | [rules/typescript.md](rules/typescript.md) (TS-01) |
| tests, verification | [rules/testing.md](rules/testing.md) (TST-*) + [TESTING_STANDARDS.md](TESTING_STANDARDS.md) |
| performance, caching, refactors, debt | [rules/optimization.md](rules/optimization.md) (OPT-*) + [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) |

## Reference
| File | What |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | verified architecture, module graph, invariants (today vs target) |
| [ENGINEERING_PRINCIPLES.md](ENGINEERING_PRINCIPLES.md) | the 13 principles that decide ambiguous cases |
| [ARCHITECTURAL_DECISIONS.md](ARCHITECTURAL_DECISIONS.md) | D01–D50 with status (in force / target phase) |
| [ARCHITECTURE_INTERVIEW.md](ARCHITECTURE_INTERVIEW.md) | the full interview ledger |
| [ARCHITECTURE_DISCOVERY_REPORT.md](ARCHITECTURE_DISCOVERY_REPORT.md) | source investigation findings |
| [ARCHITECTURAL_CONFLICTS.md](ARCHITECTURAL_CONFLICTS.md) | conflicts + open decisions (an open one → stop and ask) |
| [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) | catalogued debt with defined fixes (the only debt you may fix in passing) |
| [OPTIMIZATION_ROADMAP.md](OPTIMIZATION_ROADMAP.md) | P0–P5 |

## Enforcement status
- **Mechanical today (root `npm run verify`):**
  - Governance checks in `scripts/checks/`: `check:boundaries`, `check:plugins`, `check:zod`, `check:model-access`, `check:i18n`, `check:governance`. Existing debt is frozen in `scripts/checks/baselines/`, so only **new** violations fail.
  - `tsc` for armonia, sinfonia and maestro (one TypeScript version, 0 errors), ESLint for sinfonia, maestro and armonia (errors baselined in one file), the `withLanguagePaths` guard test, and the armonia/sinfonia/maestro test suites.
- **Deploy gate (D08):** the solfeggio images re-run the typecheck and the tests on the modules assembled for the instance; an error stops the build.
- **Baselines:** after fixing debt, run `node scripts/checks/run.mjs --update-baseline` to shrink them. Never re-freeze to accept a new violation without architect approval.
- **Review only:** seam-vs-switch judgment, layer placement, snapshot correctness, ask-vs-act, live-verification evidence, report shape.

## Changing the governance
A rule change needs the architect's approval. Record it as a new D-id in ARCHITECTURAL_DECISIONS.md, edit the canonical rule
here, and keep the `.mdc` pointers and `CLAUDE.md` in sync (`npm run check:governance` verifies links, rule IDs, decision IDs and repo paths).
