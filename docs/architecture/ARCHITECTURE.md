# Arpeggio architecture

**Status:** verified against source on 2026-11-04. Only facts are listed here; approved changes are in [OPTIMIZATION_ROADMAP.md](OPTIMIZATION_ROADMAP.md) and marked *(target)*.

## 1. System shape
```
               ┌──────────────── armonia (contracts, isomorphic*) ────────────────┐
               │ SchemaDef · Zod factories · DTOs · ViewConfig types · exceptions │
               └───────────────▲─────────────────────────────────▲────────────────┘
          path alias armonia/* │                                 │ vite alias armonia/
┌──────────── maestro (API, Node, Express, Mongoose 6) ───────┐  │  ┌──── sinfonia (React + Vite) ────┐
│ xServers: api · cron · kafka · websocket · assistant · tg   │  └──│ apps: core panel · portal ·     │
│ modules/core + verticals (route discovery, plugins, ACL)    │◀────│ studio(dev) · PM public · dyeus │
└────────────────┬────────────────────────────────────────────┘ HTTP└─────────────────────────────────┘
                 │ MongoDB (sharded, TLS) · Redis (sentinel) · Kafka (optional) · Nginx · ClamAV · Ollama
           solfeggio: Docker Compose, single host, named multi-instance (own DB / Redis DB / Kafka prefix)
```
*Armonia is used in both runtimes, but `helpers/exceptions.ts` / `discoverModuleLocales.ts` currently use `fs` (D37, debt).

**Repositories (25):** the roots `armonia`, `maestro`, `sinfonia`, `solfeggio`, plus seven nested module repos in each of the three packages (carRental, dentalClinic, eCommerce, finance, propertyDevelopment, propertyManagement, swissOutreach). `core` lives inside each root repo. The workspace root holds governance + dev tooling and becomes its own repo *(target, D28)*.

## 2. Modules and dependencies
Module manifest: `scripts/modules.manifest.json` *(target: maestro core, D01a)*.
```
core (required)
├── finance ─────────┬── eCommerce
│                    ├── carRental
│                    └── dentalClinic
├── propertyManagement ── propertyDevelopment
├── swissOutreach
└── musicIndustry (empty; removal approved, D31)
```
- Rules: imports only along these edges (CORE-02); core knows no vertical (CORE-01).
- Violations today: maestro finance→eCommerce (5), sinfonia PM→PD (2), plus core string references.
- Gating: `ENABLED_MODULES` / `VITE_ENABLED_MODULES` (dependencies resolved transitively; core always on).
- Launch modules: PM, PD, eCommerce, finance, carRental, dentalClinic (D32).

## 3. Maestro (backend)
- **Servers** (`maestro/xServers/`):
  - `apiServer`: env validation → body parser → Mongo → module bootstraps → Redis → request-id/metrics/header validation (`x-device-id`, `User-Agent`) → route discovery → role permission sync → error handler.
  - `cronServer`: in-process leader runner, company-scoped handlers.
  - `kafkaServer`: consumers, rollups, DLQ.
  - `webSocketServer`: rooms, health aggregation.
  - `assistantServer`: AI channel tools.
  - `telegramServer`: long polling.
- **Request pipeline:** `authMW` → (`schemaSanitizerMW`) → `validateFormZod` → `transactionHandler` → `asyncHandler(fn(req.body, …))`. The server context is carried in `req.body` (SEC-03 risk). `asyncHandler` retries transient transactions, commits, flushes after-commit tasks and cleans up uploaded GridFS files on failure.
- **Routes:** every `.ts` under `modules/<enabled>/api/` exports `basePath` + `router`. `/private/` and `/public/` are stripped from paths. `createCrudRouter` gives the 7 verbs; `@action` gives `POST /<method>`.
- **Layers:** service (one collection) · actions (record transitions) · utilities. Target layers: `workflows/`, `integrations/`, pure `utilities/` (D49).
- **Data:**
  - Plugins (ownership/audit/softDelete/lifeCycle). `company` is the tenant key, filtered manually today *(target: auto-scope, D16)*.
  - Schema ACL via SchemaGuard (field `self/others` read/write, model `create/delete/restore`) *(target: + action permissions, D14)*.
  - Snippets for populated refs; `relationsRegistry` for delete safety; money as Decimal128; indexes in `*.indexes.ts`.
- **Errors:** `apiValidationException` → localized `ServerError` (400 by default). Any other `Error` → 500.
- **Logging:** Winston with daily rotation, hierarchical loggers.
- **Side effects:** the notification bus is a synchronous in-process EventEmitter; `runAfterCommit` handles post-commit work. PM still emits before commit (debt).
- **Public:** company resolved by origin (portal slug → platform → allowedDomains → wildcard fallback *(target: fail closed, D18)*).

## 4. Sinfonia (frontend)
- **Builds:** one app per build; `VITE_SINFONIA_APP` selects `src/modules/<m>/apps/<app>/index.html`. Disabled modules are stubbed by a Vite plugin. Path aliases are recomputed on each dev/build/test run, which rewrites `tsconfig.json`.
- **Panel shell:** one catch-all route `/:menu?/:subview?/:id?/*`. `renderCenterPanelContent` asks the route contributions in order, then falls back to core. Pages are eagerly imported *(target: lazy, D21)*.
- **Pages:** `EntityListPage` and the generic create/edit factories. Forms and sheets render from ViewConfig, fetched once from `GET /api/auxiliary/viewConfigs`.
- **Data:** `withAxios` HOC → `apiClient` (session expiry handled centrally). No client entity cache. Redux holds session/language/notifications/chat/ui/serverResources.
- **UI:** shadcn (radix-nova) on Tailwind v4, tabler icons.
- **i18n:** `withLanguage(<literal source path>)` → `assets/languages/<locale>/<path>.json`, 5 locales, guard test.

## 5. Armonia (contracts)
`src/modules/<m>/api/**` holds `*.schema-def.ts`, `*.form.validator.ts` and `*.dto.ts`; `dto/` holds snippet wire types; `helpers/static/exceptions/*.json` holds exception keys. Core also provides `schemaDefBuilder`, `zodBuilder`, `exceptions`, the filter DSL, `shared.types` and the ViewConfig types. There are no imports from maestro or sinfonia.

## 6. Deployment and environments
- `solfeggio/deploy.sh` clones the core and module repos by branch per instance, then generates the manifest, env and clusters.
- `systemUp.sh` builds the images. The maestro image runs `ts-node-dev --transpile-only --watch` *(target: tsc gate, then compiled runtime, D07)*, and its Dockerfile patches armonia's `zodBuilder.ts` with `sed`.
- There is no CI and there are no git hooks.
- Dev profiles: `scripts/dev/arpeggio.mjs`.

## 7. Architectural invariants
| Invariant | Enforced today by | Target |
|---|---|---|
| Tenant isolation | manual `company` filters | ownershipPlugin auto-scope, fail closed (D16) |
| Field ACL | SchemaGuard + schemaSanitizer | unchanged |
| Action authorization | per-action manual checks | core-enforced action permissions (D14) |
| Soft delete | plugin on find/update | + aggregate hook (D15) |
| No side effects from rolled-back work | `runAfterCommit` where used | auto-defer in core (D06) |
| Contract parity client/server | shared Armonia factories | + Zod construction check (D11) |
| Module isolation | convention | boundary check (D02/D03) |
| Types | sinfonia tsc only | tsc ×3 in verify + deploy gate (D07/D08) |
