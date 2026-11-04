# Optimization and remediation roadmap

Order approved in D48: **gates first**, so every later refactor is mechanically checked. Each item needs its own go-ahead
before work starts (OPT-06). Seams ship with a pilot module, tests and live verification. Nothing here is implemented yet.

Scale: Severity (S1 critical → S4 low) · Impact (H/M/L) · Confidence (H/M/L) · Risk of change (H/M/L) · Effort (S ≤1d, M ≤1w, L >1w).

## P0: Governance install
| Item | Sev | Impact | Conf | Risk | Effort | Deps | Action |
|---|---|---|---|---|---|---|---|
| Docs + rules + `CLAUDE.md`/`AGENTS.md` + thin `.mdc` | S2 | H | H | L | S | — | **Done 2026-11-04** (this change) |
| `git init` workspace root with allowlist `.gitignore` (D28) | S2 | M | H | L | S | approval | `.gitignore` prepared; init awaits approval |
| README fixes (C9) | S4 | L | H | L | S | — | update maestro/sinfonia/armonia READMEs |

## P1: Gates and checks
| Item | Sev | Impact | Conf | Risk | Effort | Deps | Action |
|---|---|---|---|---|---|---|---|
| One TypeScript version in all 3 packages; fix 242 maestro errors (PD 158 first) | S1 | H | H | M | L | dependency approval | D07 |
| Root `verify`: tsc ×3 + armonia tests | S1 | H | H | L | S | above | D08 |
| `check:boundaries` from the manifest (D02/D03) | S2 | H | H | L | M | — | node script, no deps |
| `check:plugins` + exemption list (D12) | S2 | M | H | L | S | — | script |
| `check:zod` (raw primitives, Zod outside armonia) (D11) | S3 | M | H | L | S | — | script |
| `check:model-access` with a baseline (D17) | S3 | M | H | L | S | — | script |
| `check:i18n` (5 locales per literal/exception key) (D30) | S3 | M | H | L | S | — | extend the guard test |
| ESLint for maestro (`no-console`) and armonia (no Node built-ins); sinfonia restricted imports + jsx-a11y errors | S3 | M | H | L | M | dependency approval | D22/D23/D37/D38 |
| `check:governance` (links, rule IDs) | S4 | L | H | L | S | — | D29 |
| Deploy image runs tsc + tests; remove the armonia `sed` patch | S2 | H | H | M | S | TS fix | D07/D08 |

## P2: Security invariants
| Item | Sev | Impact | Conf | Risk | Effort | Deps | Action |
|---|---|---|---|---|---|---|---|
| Reserved-key guard on client input (D13) | S1 | H | M | M | S | P1 | core middleware + tests; per-public-route audit |
| Public origin fails closed + one resolver (D18) | S1 | H | H | M | S | — | env flag for dev/single-tenant |
| Tenant auto-scope in `ownershipPlugin`, fail closed (D16) | S1 | H | H | H | L | P1 | pilot module; explicit `crossTenant` opt-outs |
| Action permissions (D14) | S1 | H | H | H | L | P1 | core seam → PM reservations pilot → role seeds → modules |
| Soft-delete aggregate hook (D15) | S2 | M | H | M | S | — | review the 12 files |

## P3: Consistency seams
| Item | Sev | Impact | Conf | Risk | Effort | Deps | Action |
|---|---|---|---|---|---|---|---|
| Auto-defer emits after commit (D06) | S2 | H | H | M | S | — | fixes PM emit-before-commit |
| `invokeAction` + system/customer actor; `workflows/`, `integrations/` (D49) | S2 | H | M | H | L | D14 | migrate big `utilities/services` gradually |
| Core money helper (D35) | S2 | H | H | M | M | — | promote PM scaled helpers |
| dayjs everywhere + format helper (D36) | S3 | M | H | L | M | dependency approval | |
| Armonia isomorphic (D37) | S2 | M | H | M | M | — | exceptions/locales loader |
| Manifest into maestro core (D01a) | S3 | M | H | M | S | — | repoint 4–6 readers + solfeggio |
| Remove musicIndustry (D31) and leftover migrations (D19) | S4 | L | H | L | S | deletion approval (D19) | |
| Sensitive-field tagging, read audit, erasure workflow (D39) | S1 | H | M | M | L | D14/D16 | before the dentalClinic launch |

## P4: Frontend
| Item | Sev | Impact | Conf | Risk | Effort | Deps | Action |
|---|---|---|---|---|---|---|---|
| Lazy panel pages (D21) | S2 | H | H | L | M | — | convert the route contributions |
| UI primitive consolidation + icon library (D22) | S3 | M | H | L | M | lint | |
| A11y to WCAG 2.2 AA on public apps (D23) | S2 | H | M | L | L | lint | portal first |
| Redux counters → refs/context (D46) | S4 | L | H | L | S | — | |
| `EntityListPage` header slot + exported parts (D04) | S3 | M | H | M | M | approval | |

## P5: Module debt (launch modules first)
Order: **propertyDevelopment** (TS errors, 0 tests, hand Zod) → **propertyManagement** (emit-before-commit, console, actions)
→ **eCommerce** (model access, Zod outside armonia, fiscalization errors, posService) → **finance** (reverse imports,
SchemaDef alignment 0/5) → **carRental** → **dentalClinic** (sensitive data first) → **swissOutreach** (patterns, i18n, tests).
Per module, work through the [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) items with tests and live verification.

## Assessed but not scheduled
- Hosted CI (D08) is revisited when there are multiple contributors.
- Production compiled runtime (beyond the tsc gate) needs a design for path aliases.
- Field-level encryption is decided before the dentalClinic launch (SEC-06).
- Plugin overlap (audit timestamps vs lifeCycle, duplicate `{company,_id}` index) is a simplification candidate after P2.
