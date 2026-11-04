# Architectural decisions

Confirmed by the architect on 2026-11-04 (D01–D50 in the interview; D51+ appended later). The full Q&A with original answers is in [ARCHITECTURE_INTERVIEW.md](ARCHITECTURE_INTERVIEW.md).
**Status:** *In force* = agents must follow it now · *Target Pn* = approved change, built in roadmap phase n (agents follow the
stated interim rule until then). New APPROVAL REQUIRED decisions are appended here (GLB-10).

| ID | Decision | Rules | Status |
|---|---|---|---|
| D01 | A rule that contradicts code is stale unless marked a target; platform config lives in versioned repos | GLB-01 | In force |
| D01a | One module manifest, moved into maestro core; no per-module `module.json` | CORE-06 | Target P3 (today: `scripts/modules.manifest.json`) |
| D02 | Cross-module imports only along declared `dependsOn` edges (incl. types, seeds, tests) | CORE-02 | In force; check P1 |
| D03 | Core has zero knowledge of verticals (only exception: the manifest) | CORE-01 | In force; check P1 |
| D04 | Seams, not switches: new seam = approval; no feature flags in core; seams never replace invariants | CORE-03/04/05 | In force |
| D05 | Layers: service = DB on one model; actions = actor operations on a record; utilities = pure helpers | BE-01 | In force |
| D06 | Side effects isolated from the business result and never visible after rollback; core auto-defers emits | BE-08 | In force (explicit `runAfterCommit`); seam Target P3 |
| D07 | One latest-stable TS in all packages; fix 242 maestro errors; tsc in verify + deploy; strict ratchet later | GLB-05, TS-01 | Target P1 |
| D08 | Root `verify` is the full gate; deploy re-checks; hosted CI later | GLB-11, AGT-08 | In force (current verify); full gate P1 |
| D09 | `withAxios` / `useHttpRequest`; `apiClient` only in core helpers; no extra axios/fetch | FE-03 | In force |
| D10 | Fix only catalogued debt inside the code already being changed | OPT-04, AGT-06 | In force |
| D11 | SchemaDef for entity create/edit; hand Zod only in Armonia with `zodBuilder` helpers; no raw primitives; no Zod outside Armonia | BE-05/06 | In force; check P1 |
| D12 | All four plugins on every schema; only three technical exemption reasons, listed | DB-01 | In force; list + check P1 |
| D13 | Strip/reject reserved server keys from client input; move server context out of `req.body` later | SEC-03 | Target P2 |
| D14 | Action-level permissions generated from `@action`, enforced by core before the body | SEC-02 | Target P2 (interim explicit check) |
| D15 | Soft delete enforced on `aggregate` via plugin hook | DB-04 | Target P2 (interim manual `$match`) |
| D16 | Tenant auto-scoping in core, explicit cross-tenant opt-out, fail closed | DB-02, SEC-05 | Target P2 (interim manual filter) |
| D17 | Models touched only by services, plugins, seeds | DB-03 | In force; check P1 |
| D18 | Unknown public origins fail closed in production; one origin resolver | SEC-04 | Target P2 |
| D19 | Fresh start: no data migrations unless asked; seeds carry changes; existing migrations are leftovers | GLB-06, DB-08 | In force |
| D20 | Definition of done for a new field: contract + UI + 5 locales + seeds/defaults/roles + rule test | GLB-07 | In force |
| D21 | Panel pages lazy-loaded per page | FE-06 | In force for new pages; conversion P4 |
| D22 | `components/ui` is the only primitive layer; no raw interactive HTML; tabler icons | FE-07 | In force; lint P1 |
| D23 | WCAG 2.2 AA for public apps, baseline for the panel, jsx-a11y as errors | FE-09 | In force; lint P1 |
| D24 | Tests with business-rule changes, regression tests for bugs, core tests; no coverage % | TST-01..06 | In force |
| D25 | Live verification of every touched layer, or "NOT live-verified" = unfinished | TST-07, AGT-08 | In force |
| D26 | Approval for commits/pushes, dependencies, destructive dev data; deletion rule kept | AGT-03/04/05/07 | In force |
| D27 | Stop-and-ask triggers (a)–(d); otherwise proceed and list assumptions | AGT-01 | In force |
| D28 | Workspace root becomes a versioned governance/tooling repo | — | Target P0 (needs `git init` approval) |
| D29 | One canonical rule text in `docs/architecture`; thin `.mdc`, `CLAUDE.md`, `AGENTS.md` | — | In force |
| D30 | Real translations in all 5 locales; verify checks presence; en-US is the reference | FE-08 | In force; check P1 |
| D31 | swissOutreach is first-class; musicIndustry is removed | — | Removal Target P3 |
| D32 | Launch modules: PM, PD, eCommerce, finance, carRental, dentalClinic | — | Roadmap input |
| D33 | Structural query-performance rules; SLOs later | OPT-01, DB-06 | In force |
| D34 | Reference by default; snapshot commercial/legal records; bounded embedding only | DB-07 | In force |
| D35 | Decimal128 + currency; one exact core money helper; no float math | GLB-08, DB-09 | In force (helper Target P3) |
| D36 | UTC instants, local calendar strings, company timezone; dayjs only | GLB-09 | In force; consolidation P3 |
| D37 | Armonia strictly isomorphic (no Node built-ins) | (CORE_USAGE_GUIDE ⚠) | Target P3; lint P1 |
| D38 | Logger only, no `console.*`; levels; no secrets/PII in logs | BE-11 | In force; lint P1 |
| D39 | Sensitive fields tagged + default deny + no leakage + read audit + erasure; encryption decided before dental launch | SEC-06, SNP-02 | In force (tagging as touched); seams roadmap |
| D40 | Integrations: adapter + timeout + breaker; signed idempotent webhooks; mapped errors; env secrets; fake adapters | BE-09, SEC-08 | In force |
| D41 | After-commit tasks / cron / Kafka-only-when-durable; Kafka optional with fallbacks | BE-10 | In force |
| D42 | Caches need evidence, company-scoped keys, explicit invalidation, never required | OPT-02 | In force |
| D43 | Soft size triggers (~600 lines/file, ~80/function); no hard gate | OPT-03 | In force |
| D44 | Documentation duties; no ad-hoc markdown | GLB-10 | In force |
| D45 | Fixed 7-section agent report | AGT-09 | In force |
| D46 | Redux slice allowlist; no refetch counters | FE-05 | In force |
| D47 | AI tools act as the user; writes via actions; no sensitive data; read-only public chat | SEC-07 | In force; audit roadmap |
| D48 | Roadmap order: governance → gates → security → consistency → frontend → module debt | — | Plan |
| D49 | `invokeAction` seam for non-HTTP triggers; `workflows/`, `integrations/`, pure `utilities/` | BE-01/02 | Seam Target P3 (interim: ask) |
| D50 | Authority policy confirmed | GLB-01 | In force |
| D51 | Zod outside Armonia is allowed only for AI assistant tool-parameter schemas (`maestro/modules/*/domain/ai/`) and sinfonia's Vite env validation; route-file Zod stays debt (2026-11-04, resolves C13) | BE-06 | In force; `check:zod` exempts those paths |
