# Database rules (DB-*)

Scope: `maestro/**/database/**`, every query in maestro, Armonia SchemaDefs/DTOs. Stack: MongoDB (sharded, TLS)
with Mongoose 6; stay on mongodb 4 / Mongoose 6 (maestro README).

---

### DB-01 · MUST · Plugin stack on every schema, with listed exemptions only
- **Default:** every schema applies `ownershipPlugin`, `auditPlugin`, `softDeletePlugin` and `lifeCyclePlugin` (`maestro/modules/core/database/plugins/`). Canonical stack: `maestro/modules/core/database/schemas/country/country.ts`.
- **Allowed skips (only these reasons):**
  1. No tenant → no ownership. Users, `cronLock`, server health/performance metrics. Basis: `ownershipPlugin` makes `company` `required: true`.
  2. Mongo TTL expiry → no softDelete. `cronLock` (`expireAfterSeconds: 0`), metric rollups, `apiAccess` raw, `cronExecution`.
  3. Constant machine writes → no audit. Locks, metrics. Basis: `auditPlugin` does an extra `findById` and an audit insert per update.
- Every skip is recorded **with its reason** in `scripts/checks/plugin-exemptions.json`. An unlisted gap fails the gate (existing gaps are baselined debt).
- **Note:** `{company:1,_id:1}` comes from `lifeCyclePlugin` only, and only on a schema with a `company` path (2026-11-09). `auditPlugin` still sets `timestamps: true` next to `lifeCyclePlugin`'s own timestamp hooks; the two differ in behavior, so simplifying them is an open roadmap decision (P6). Keep applying both.
- **Why:** D12. **Enforce:** check `plugins`. Exemptions live in `scripts/checks/plugin-exemptions.json`, one fixed reason per plugin; lifeCycle has none.

### DB-02 · MUST · Tenancy
- **Rule:**
  - `company` is the only tenant key. `sellerCompany`, `buyerCompany` and `tenant` are business references, not tenancy.
  - **In force everywhere (D16, D53):** `ownershipPlugin` scopes every query, aggregation and write on a tenant model to `requestContext.tenantCompanyId`. A filter on another company is refused (`tenant_scope_violation`, 403), and so is work with no company (`tenant_context_missing`, 500).
    - The tenant is set by `authMW` (private), `resolveCompanyByOrigin` and sign-in (public), the cron job runner (per job), the Kafka consumer (the event's `companyId`, or `company`), and the WebSocket server (the connection's user or visitor-chat company). Work about one company inside another's request runs under `withTenant` (company setup and default roles, audit entries, portal-customer sessions); the cron scheduler, cron row retirement and database init are `asCrossTenant`.
    - **Events:** a Kafka event that concerns one company MUST carry its id as `companyId`. Helpers in `maestro/modules/core/utilities/endpoints/tenantScope.ts`: `setRequestTenant`, `withTenant(company, fn, module)` for one company's slice, `asCrossTenant(reason, fn)` for deliberate cross-company reads (platform-owner screens, a portal customer's records across shops, all-company sweeps).
    - `ownershipPlugin(schema, {tenantScoped: false})` only where `company` is not a tenant partition: `Company` (it names the parent company) and a platform catalog that one company maintains for all (the marketplace `ListingCategory`, owned by the operator, D144). Such a catalog's reads name its owner explicitly, and its writes check the owner themselves.
    - `ownershipPlugin(schema, {sharedWith: "<field>"})` for records an owner shares with other companies: reads and updates match "owned by the tenant OR listed in `<field>`"; creating stays owner-only (`Media`: `sharedWithCompanies`).
    - `runAfterCommit` tasks run in the context they were queued in, so they keep their tenant.
    - Shop (eCommerce): on a company's own site `resolveCompanyByOrigin` sets that company; on the portal apex core `resolveStorefrontContext` sets the platform company, and catalog views that list every seller run through `inStorefrontCatalog` (cross-tenant on the apex only; the services marketplace uses the same two, D142). The Stripe webhook matches events cross-tenant and runs each charge's handler under the ledger row's company.
    - Token portals (PD contractor `tenderPortal`) look the token up `asCrossTenant`, then `setRequestTenant` to the record's company.
    - A portal account's own records across companies (dentalClinic patient portal, carRental `/mine`) run under `asCrossTenant`; the account filter (`loadOwnInquiry`, `account: user._id`) is what isolates them.
    - Core portal (`/api/portal/*`): a company site runs under `withTenant(site company)`, the apex `asCrossTenant` (`inPortalScope`). The apex public blog and portal-zone public media are `asCrossTenant`; an anonymous API hit (no company) saves its `ApiAccess` row `asCrossTenant`. Operator scripts (`maestro/scripts/*`) run their `main` `asCrossTenant`.
    - A filter on no company (`company: null`, `company: {$in: []}`) matches nothing, so it is narrowed to the tenant, not refused.
    - Sign-up (`resolveSignupCompany`) sets the sign-up company as tenant; the notification event bus runs its handlers under the event's `payload.companyId`; the boot permission sync grants admin roles `asCrossTenant`.
    - **No switch:** enforcement is unconditional in every module, server, script and test (the `TENANT_SCOPE_ENFORCE` rollout ended 2026-11-04). Machine WebSocket connections touch no tenant data.
    - **Tests:** fixtures and direct service calls run as a company (`withTenant`), or `asCrossTenant("test fixtures span companies", …)` when a test spans companies; hooks clean up through `Model.collection.deleteMany` (no plugin). `appFor` gives every request a fresh context, so a test's own tenant never reaches the routes it calls.
- **MUST NOT:** read another company's data without `asCrossTenant` and a reason.
- **Why:** D16, D53. **Enforce:** the plugin (always); `tenantScope.test.ts`; review of every `asCrossTenant` reason.

### DB-03 · MUST · Models are touched only by services
- **Rule:** Mongoose model statics (`Model.find/findOne/updateOne/aggregate/create…`) are called only in `*.service.ts`, plugins, migrations and seeds. Routes, crud hooks, actions and workflows go through the entity's service.
- ❌ ~300 sites in `api/` (top: `dentalClinic/.../public/patientPortal.ts` 20, `eCommerce/.../cart.ts` 15, `carRental/.../rentalStorefront.ts` 14; `carRental/.../vehicleDamage.ts:110` inside `afterRestore`). These are baselined debt.
- **Why:** D17, D05. **Enforce:** check `model-access` (baselined).

### DB-04 · MUST · Soft delete
- **Rule:** Soft delete is the default (`softDeletePlugin`). Physical delete only with `hard: true` on the service.
- **Aggregations (D15, built 2026-11-05):** the plugin's `pre('aggregate')` hook adds `deletedAt: null` to the pipeline's first `$match` (or puts one first, after a stage MongoDB requires first), for every caller: admins see deleted records in find, never in a total. A `deletedAt` condition the caller writes in the leading `$match` stages is kept. To count deleted records too: `Model.aggregate(p).option({withDeleted: true})`, or `service.aggregate(p, {withDeleted: true})`.
- **MUST:** a `$lookup`/`$unionWith` into a soft-delete collection filters `deletedAt: null` in its own pipeline (the hook covers only the pipeline's collection; TD-B25). Write `deletedAt: null`, never `{$exists: false}` (restore writes `null`; TD-B26).
- **Why:** D15. **Enforce:** `softDeletePlugin`; `softDeleteAggregate.test.ts`; review for joins.

### DB-05 · MUST · Schema registration and alignment
- **Rule:**
  - Register each model with `addModelData(Model, views)` (`maestro/modules/core/database/collections/index.ts`) next to the schema.
  - Align it with the Armonia SchemaDef via `validateSchemaDefAgainstMongoose`. Every model with a create/edit form is validated (2026-11-06); system records with no form (logs, locks, metrics, catalogs, chat records) have no SchemaDef by design (TD-B12).
  - Delete safety comes from `relationsRegistry` / `assertCanDelete`.
  - Custom routers that read tenant docs still use `SchemaGuard`.
- **Why:** existing database rule (verified). **Enforce:** review.

### DB-06 · MUST · Indexes
- **Rule:** Indexes live in `<entity>.indexes.ts`, never in routes. Every new filter or sort field on a tenant collection gets a compound index starting with `company`.
- **Why:** existing rule; D33. **Enforce:** review + `explain()` evidence (OPT-01).

### DB-07 · MUST · References, embedding, snapshots
- **Reference by default:** ObjectId + snippet allowlist ([snippets.md](snippets.md)).
- **Snapshot:** commercial and legal records snapshot their inputs at transaction time. Order, sale, rental and appointment lines keep the price, tax, currency, product/unit name and the customer + billing address as they were. Later edits to the source never change past documents.
- **Embed** only parent-owned, bounded data that is never queried on its own (e.g. a location's address, a payment plan's installments).
- **Separate collection:** unbounded children (messages, audit, movements) are always their own collection.
- **Why:** D34. **Enforce:** review.

### DB-08 · MUST · Seeds carry schema changes
- **Rule:** Because there are no migrations (GLB-06), `*.defaults.ts`, demo seeds (`maestro/scripts/resetDatabase.ts` via `npm run reset:<profile>`) and default-role grants must make a fresh reset show every new field and permission working.
- **Why:** D19, D20.

### DB-09 · MUST · Money and dates at rest
- **Rule:** Money is `Decimal128` with a currency (GLB-08). Instants are UTC `Date`, and calendar values are local strings (GLB-09).
- **Why:** D35, D36.
