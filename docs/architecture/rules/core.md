# Core rules (CORE-*)

Scope: `maestro/modules/core/**`, `armonia/src/modules/core/**`, `sinfonia/src/modules/core/**`, plus every
vertical's use of core. Read [../CORE_USAGE_GUIDE.md](../CORE_USAGE_GUIDE.md) for the inventory of seams and canonicals.

---

### CORE-01 · MUST NOT · Core knows no vertical
- **Rule:** Core (all three packages, core tests included) never imports, string-references (`isModuleEnabled("eCommerce")`) or fixtures a vertical. Verticals plug in only through core extension points. The **only** exception is the core-owned module manifest (CORE-06).
- ✅ A vertical registers an env-validator contribution. ❌ `maestro/modules/core/environment/validator.ts:176,185` checking `"propertyManagement"`/`"eCommerce"` (debt). ❌ sinfonia core viewEngine tests importing `@propertyManagementModule` (debt → core fixtures).
- **Why:** D03. **Enforce:** check `boundaries`. **Exception:** none.

### CORE-02 · MUST · Cross-module imports follow declared edges only
- **Rule:** Any import from module A into module B (runtime, `import type`, seed/demo, test) requires `A dependsOn B` in the manifest. This holds in all three packages. A reverse need goes through a core seam, or the code moves to the dependent module.
- Declared today: `finance, propertyManagement, swissOutreach, carRental(+finance), dentalClinic(+finance), eCommerce(+finance), propertyDevelopment(+propertyManagement)` → core.
- ❌ maestro `finance/database/schemas/{paymentTransaction,escrowTransaction,giftCard}/*.defaults.ts` importing eCommerce (debt). ❌ sinfonia PM `constructionProgressSection.tsx:11`, `deliveryReadinessCard.tsx:13` importing PD types (debt).
- **Why:** D02. A core+finance+carRental deploy does not clone eCommerce. **Enforce:** check `boundaries`.

### CORE-03 · Seams, not switches
| Action | Class |
|---|---|
| Plug into an existing seam (slot/render prop, `before*`/`after*` hook, registry token, contribution kind, `@action`, notification event) | **MAY** |
| Compose exported core parts inside the vertical | **MAY** |
| Add a **new** seam to core. It must be generic, take **one typed context object**, have a real consumer when added, and come with a core fixture test | **APPROVAL REQUIRED** |
| Add a feature-specific flag, param or branch to a core component | **MUST NOT** |
| Add a generic helper to an existing helper module (e.g. a `zodBuilder.ts` validator + locale key) | **MAY** (BE-06) |
- ✅ `EntityListPage`'s ~10 header switches were replaced by one `header` slot that takes a context object, plus the exported parts `EntityListHeader` and `EntityListCreateButton` (D60, 2026-11-06). ✅ `renderCard`, `renderSheet`, `afterCreate`, `enrichList` are seams.
- **Why:** D04. **Enforce:** review.

### CORE-04 · MUST NOT · A seam never replaces a core invariant
- **Rule:** Core always runs auth, ACL, tenancy, relation-safety, transaction and soft-delete steps. Hooks run **in addition**. Replace-style seams are forbidden.
- ❌ `createCrudRouter.beforeDelete` currently *replaces* `assertCanDelete`. ❌ `overrideRestoreHandler` makes the override call `SchemaGuard.checkModelPermission` itself. Both are debt.
- **Why:** D04. **Enforce:** review.

### CORE-05 · MUST · Consolidate before the second override
- **Rule:** When a task would add a second override to the same area of a core component (header, row actions, empty state), consolidate that area into one slot first. Treat that consolidation as a new seam (approval).
- **Why:** D04. **Enforce:** review.

### CORE-06 · MUST · Module registration
- **Manifest:**
  - Module dependencies live in **one** manifest.
  - It is `maestro/modules/core/modules.manifest.json`, versioned with maestro core (D01a, moved 2026-11-05). Readers: `maestro/modules/core/utilities/modules/enabledModules.ts` (`MODULE_MANIFEST_PATH`), `sinfonia/scripts/enabledModules.ts` (`../maestro/…` in the workspace; the sinfonia image copies the file to the same place), and the root checks (`scripts/checks/lib.mjs`). `solfeggio/systemUp.sh` only checks that maestro core carries it.
  - Do **not** create per-module `module.json` (a reverted idea), and never add a second manifest.
- **Folders:** use the same folder name under `armonia/src/modules/<m>/`, `maestro/modules/<m>/`, `sinfonia/src/modules/<m>/`.
- **Maestro:**
  - `database/moduleBootstrap.ts` exports `moduleBootstrap` (models, optional `defaultRoles`, optional `platformOnlyUses`: platform-only models its companies may keep their own rows of, D161). Never hardcode models in `maestro/initializer/index.ts`.
  - HTTP files live under `api/` and export `basePath` + `router`. They are discovered by `routeRegistry.ts`; never `app.use` them in `apiServer.ts`.
  - Cron: `utilities/cron/` exports `register*CronHandlers`. Kafka: `kafka/` exports `start*KafkaConsumer(s)`.
  - Discovery loaders match files with `isModuleCodeFile` / `moduleCodeFile` / `withoutModuleExtension` (`modules/core/utilities/modules/moduleCodeFiles.ts`) and never hard-code `.ts` (D106).
- **Sinfonia:**
  - Panel UI mounts only through `clients/panel/<kind>Contribution.tsx`. There are 12 kinds: sidebar, routeConfig, widget, tenancySettings, siteRoom, accountNav, accountSettings, authPanel, panelLayout, menuLanguage, rolesPermissions, plus portal (`clients/portal/portalContribution.tsx`).
  - Never edit core `routeConfig.tsx` or the core sidebar to mount a feature.
  - After adding a module folder, run `npm run sync:module-aliases`.
- **Gating:** `ENABLED_MODULES` (maestro) / `VITE_ENABLED_MODULES` (sinfonia). `core` is always on.
- **Why:** verified discovery; D01a; existing modules rule (module.json clause retired). **Enforce:** review + check `boundaries`.

### CORE-07 · MUST · Core changes carry tests
- **Rule:** Every change to a core component, helper or seam adds or updates a core test. That test uses core fixtures, never vertical code (CORE-01).
- **Why:** D24, D04. **Enforce:** review.

### CORE-08 · MUST NOT · Delete core on "looks unused"
- **Rule:** Core is not a cleanup target just because no vertical imports it. Deletion follows AGT-05.
- **Why:** existing deletion rule; D26.
