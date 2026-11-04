# Security rules (SEC-*)

Scope: all request paths, permissions, tenant data, sensitive data, integrations, AI tools.

---

### SEC-01 · MUST · Authentication
- **Rule:**
  - Private routes use `authMW("private")` (`maestro/modules/core/utilities/middlewares/authMW.ts`), with headers `x-auth-token`, `x-device-id`, `language`, `x-company-id`.
  - After it runs, `company`, `languageCode`, `actionUserCtx` and `logger` are present (TS-01: don't re-check them).
  - Public routes use `authMW("public")` and resolve the company by origin (SEC-04).
- **Why:** verified. **Enforce:** review.

### SEC-02 · MUST · Action permissions
- **Approved target (P2 seam):**
  - Each `@action` method name becomes a model permission next to `create/delete/restore` (`ModelPermissionAction` in `maestro/modules/core/database/types/mongoose-extensions.d.ts`), with `self`/`others`.
  - It is generated from `getRegisteredActions` and synced by `createRolePermissions` into the roles UI.
  - Core checks it, then an optional declared party `guard` (e.g. `isOrderParty`), **before** the method body. A missing permission returns `user_permissions_not_sufficient`.
  - Inside the action there are no field read/write checks for the action's own effects. Tenancy, business rules and read-filtering of the response still apply.
  - Rollout: core seam → PM reservations pilot → default-role seed grants (roles that can edit a model get its actions) → per-module cleanup.
- **Interim (until shipped):** every new action calls `SchemaGuard.checkModelPermission` or a party guard explicitly at the top.
- **MUST NOT:** use a field-write check as a stand-in for "may perform action". ❌ `propertyManagement/.../reservation/reservation.actions.ts` `cancel`: write on `isActive` used as the permission, reports `reservation_not_found`, and silently drops `cancellationReason`.
- **Why:** D14. **Enforce:** review → structural once the seam lands.

### SEC-03 · MUST · Server-owned request keys can't come from the client
- **Verified risk:** middlewares write auth/session/ACL context into `req.body` (`authMW.ts:77-108`, `transactionHandler.ts:49`, `schemaSanitizerMW.ts:101`). `validateFormZod` merges the parsed data back with `Object.assign`, so raw client keys survive. Nothing strips reserved keys, and public routes overwrite almost none.
- **Approved now (P2):** a core guard runs first in every chain and strips or rejects reserved keys from client input: `company`, `user`, `userInfo`, `actionUserCtx`, `actionUserInfo`, `session`, `sanitizedWriteFields`, `sanitizedReadFields`, `parentBypass`, `logger`, `languageCode`, `singleCompanyId`, `siteCompany`, `requestSource`, `_mediaUploadGridFsIds`. The final list is derived from the middlewares.
- **Roadmap:** server context moves to `requestContext`/`res.locals`, and `asyncHandler` merges it over the Zod-validated data (server keys win, handler signatures unchanged), after a per-public-route exploitability check.
- **MUST NOT:** a handler trusting a client-supplied value for a server-owned key.
- **Why:** D13. **Enforce:** review → structural.

### SEC-04 · MUST · Public origin resolution fails closed
- **Rule:**
  - In production an unknown origin returns 404/400.
  - The `allowedDomains: "*"` wildcard fallback in `maestro/modules/core/utilities/marketing/resolveCompanyByOrigin.ts` is allowed only behind an explicit env flag (dev/single-tenant).
  - `resolveCompanyByOrigin.ts` and `utilities/company/siteHost.ts` merge into one resolver.
- **Why:** D18. With DB-02 auto-scoping, the resolved company becomes the tenant context. **Enforce:** review.

### SEC-05 · MUST · Tenant isolation
- See DB-02. A forgotten company filter is the worst failure this platform can have. **Why:** D16.

### SEC-06 · MUST · Special-category data
- **Rule:**
  1. Sensitive fields are tagged in the schema (`sensitivity: "health" | "identity" | "payment"`) and default to `read: "no-permission"` unless a role is explicitly granted. This covers dentalClinic medical history, patient folder, DICOM/STL; carRental driver licence/ID; payment references.
  2. They never appear in snippets, list columns, logs, notifications/emails or AI tool output.
  3. Reads of health records are audited.
  4. A core erasure workflow (anonymize or hard-delete a person's data, overriding soft delete) is an approved roadmap seam.
  5. Field-level encryption for health data needs a dedicated decision before the dentalClinic launch. Interim: TLS in transit + host disk encryption.
- **Why:** D39 (delegated decision). **Enforce:** review.

### SEC-07 · MUST · AI assistant and public chat
- **Rule:**
  1. Assistant tools act as the requesting user: same services, SchemaGuard read filtering, action permissions (SEC-02) and tenant scope (DB-02), with no privileged shortcuts.
  2. Write tools go through `@action`/services, never direct model writes.
  3. Sensitive fields (SEC-06) never reach prompts or tool output.
  4. Tools are registered per module through a contribution seam (CORE-01).
  5. Public chat tools are read-only over public data and rate-limited.
- **Why:** D47. **Enforce:** review; the 54 existing tools are audited on the roadmap.

### SEC-08 · MUST · Secrets and integrations
- **Rule:** Secrets come only from env/`secrets/` (gitignored), never from code or the DB. Webhooks verify signatures and are idempotent (BE-09).
- **Why:** D40.

### SEC-09 · MUST · Field ACL in custom routers
- **Rule:** Custom routers that read tenant documents still run `SchemaGuard` filtering (canonical: `.../realEstate/private/dashboard.ts`).
- **Why:** existing database rule.
