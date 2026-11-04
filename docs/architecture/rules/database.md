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
- **Note:** `auditPlugin` sets `timestamps: true` and duplicates `lifeCyclePlugin`'s timestamps, and `lifeCycle` and `ownership` both add `{company:1,_id:1}`. Simplifying that overlap is a roadmap item; keep applying both until then.
- **Why:** D12. **Enforce:** check `plugins`. Exemptions live in `scripts/checks/plugin-exemptions.json`, one fixed reason per plugin; lifeCycle has none.

### DB-02 · MUST · Tenancy
- **Rule:**
  - `company` is the only tenant key. `sellerCompany`, `buyerCompany` and `tenant` are business references, not tenancy.
  - **Today:** `BaseCrudService` does **not** add the company filter, so every tenant query passes `{company: company._id}` explicitly.
  - **Approved target (P2):** `ownershipPlugin` auto-scopes every query to the `requestContext` company and fails closed. Cross-tenant queries (platform-owner screens, public multi-seller marketplace, all-company cron sweeps) opt out explicitly with `crossTenant` + a reason. Cron/Kafka/WS set a tenant context or opt out.
- **Why:** D16. **Enforce:** review (auto-scope makes it structural).

### DB-03 · MUST · Models are touched only by services
- **Rule:** Mongoose model statics (`Model.find/findOne/updateOne/aggregate/create…`) are called only in `*.service.ts`, plugins, migrations and seeds. Routes, crud hooks, actions and workflows go through the entity's service.
- ❌ ~300 sites in `api/` (top: `dentalClinic/.../public/patientPortal.ts` 20, `eCommerce/.../cart.ts` 15, `carRental/.../rentalStorefront.ts` 14; `carRental/.../vehicleDamage.ts:110` inside `afterRestore`). These are baselined debt.
- **Why:** D17, D05. **Enforce:** check `model-access` (baselined).

### DB-04 · MUST · Soft delete
- **Rule:** Soft delete is the default (`softDeletePlugin`). Physical delete only with `hard: true` on the service. **Approved (P2):** the plugin adds a `pre('aggregate')` hook that prepends `{deletedAt: null}`, with an explicit opt-out.
- **Until then:** every aggregate on a soft-delete collection includes `deletedAt: null` in its first `$match`. 12 existing files lack it (e.g. `finance/.../escrowTransaction.ts`, `core/api/auxiliary/private/stats.ts`, the edifice/project/floor services).
- **Why:** D15. **Enforce:** review.

### DB-05 · MUST · Schema registration and alignment
- **Rule:**
  - Register each model with `addModelData(Model, views)` (`maestro/modules/core/database/collections/index.ts`) next to the schema.
  - Align it with the Armonia SchemaDef via `validateSchemaDefAgainstMongoose`. Coverage today is incomplete in most modules (validated/total schema files: core 11/32, finance 0/5, dentalClinic 8/11, eCommerce 43/50), which is debt.
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
