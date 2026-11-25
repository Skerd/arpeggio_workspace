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
- **Built, enforced everywhere (D14, D54):**
  - `mountActions` (`maestro/modules/core/api/crudRouterFactory.ts`, used by `createCrudRouter` and the chat channels router) registers every authenticated `@action` as a permission of the router's model and runs `actionPermissionMW` right after `authMW` (`maestro/modules/core/utilities/security/actionPermissions.ts`). Public (`auth: false`) actions have no permission.
  - Tag: `<collection>[action:self:<method>]` and `[action:others:<method>]` (impersonation); a `loose` model has one `[action:<method>]`. `createRolePermissions` syncs them in the model's group, so admin roles and every default role that owns the model's group get its actions; read-only groups do not.
  - A missing permission returns `user_permissions_not_sufficient` (403) before the body. Inside the action there are no field read/write checks for the action's own effects; tenancy, business rules and read-filtering of the response still apply.
  - Roles UI: a **Perform** column; each action row is labelled from the module's `rolesPermissions.json` `permissions.<Group>.<method>`, in all 5 locales (a new action MUST add its label).
  - Enforced in every module and core, with no switch (D54: rolled out module by module, then `ACTION_PERMISSION_ENFORCE` was removed 2026-11-05). A refusal logs `Action permission refused …`.
  - **Self-service** actions (`@action({selfService: true})`) are decided by the caller's own relation to the record, not by a role: their own record (PM marketing preferences `me`/`updateMe`, eCommerce address `setDefault`) or one they are a party to (marketplace buyer side: order `createFromListing`/`cancel`/`acceptDelivery`/`releaseMilestone`/`requestRevision`, bid `accept`/`reject`, task request `close`/`reopen`). Any signed-in user may call them and they are no permission; the action MUST check that relation itself (owner or party check on `actionUserCtx`, e.g. `isOrderParty`, `loadOwnTaskRequest`). Provider and staff actions stay role permissions. Public (`auth: "public"`/`false`) actions are no permission either.
  - Still open: the declared party `guard` option (no consumer yet).
- **MUST NOT:** use a field-write check as a stand-in for "may perform action". The PM reservation actions dropped theirs in the pilot (`cancel` wrote `isActive` as the permission, answered `reservation_not_found`, and silently dropped `cancellationReason`); every module's stand-ins were removed in its enforcement step.
- **Why:** D14, D54. **Enforce:** `actionPermissionMW`; `actionPermissions.test.ts`; review for self-service relation checks.

### SEC-03 · MUST · Server-owned request keys can't come from the client
- **Built (D13, D52):** `stripServerKeys` (`maestro/modules/core/utilities/middlewares/serverKeys.ts`) runs first on every route (mounted in `routeRegistry.ts` and the test harness). It removes the keys in `SERVER_KEYS` from the client body and keeps the client's values aside. Raw-body webhook routes are skipped. A multipart body is parsed later, by `mediaUploadMW`, which moves server keys out of the form's fields and its `data` JSON the same way (`quarantineServerKeys`, TD-B250).
- `validateFormZod` validates the client's own values. When merging, a value a middleware wrote wins, otherwise the validated client value is used. The validated form is kept as `validatedForm`, and `buildCreate/UpdateDataFromSchemaDef` read SchemaDef fields named like server keys from it. That fixes collisions like a campaign recipient's `languageCode`.
- **MUST:** a middleware that writes a new key into `req.body` adds it to `SERVER_KEYS`. **MUST NOT:** a handler reads a server-owned key from anywhere but its params.
- **Why:** D13, D52. **Enforce:** `serverKeys.test.ts`; every HTTP test runs through the guard.

### SEC-04 · MUST · Public origin resolution fails closed
- **Built (D18):** `resolveCompanyByOrigin` (`maestro/modules/core/utilities/marketing/resolveCompanyByOrigin.ts`) resolves:
  - the portal apex → the platform company;
  - `{siteSlug}.{root}` → that company's site;
  - any other host → the company whose `allowedDomains` lists it. Only the platform sets a company's own domains (`PUT /api/platform/companies/domains/:id`, D189; the field is write-locked for everyone else), and a host belongs to one company, except hosts the platform serves itself (`isPlatformHost` in `maestro/modules/core/utilities/company/companyDomains.ts`);
  - anything else → 404 `company_not_found_for_origin`.
- The `allowedDomains: "*"` fallback applies only to local development origins (`isLocalDevOrigin` in `portalOrigin.ts`: `localhost`, `*.localhost`, loopback).
- **MUST NOT:** add another host→company lookup. `utilities/company/siteHost.ts` only *builds* `{slug}.{root}` hosts for site provisioning; it is not a resolver.
- **Why:** D18. With DB-02 auto-scoping, the resolved company becomes the tenant context. **Enforce:** `resolveCompanyByOrigin.test.ts`.

### SEC-05 · MUST · Tenant isolation
- See DB-02. A forgotten company filter is the worst failure this platform can have. **Why:** D16.
- The platform company is not one team: its members are portal accounts that do not know each other. Its records that belong to one person stay that person's (D163 addresses, saved searches, favourites), and a file it holds that is not public opens only for the person who uploaded it and the companies it was shared with; a refusal answers `media_not_found` (D189, `companyOwnsMedia` in `maestro/modules/core/api/auxiliary/private/media.ts`).
- Stored ids too (D104): a tenant record's references to tenant-owned rows must be its company's own (or shared with it); `ownershipPlugin` refuses others (`reference_outside_tenant`), and a cross-company flow names its fields with `allowForeignReferences` and a reason.

### SEC-06 · MUST · Special-category data
- **Rule:**
  1. Sensitive fields are tagged in the schema (`sensitivity: "health" | "identity" | "payment"` on the field; everything under it inherits). Their permission tags carry the same `sensitivity` in the RolePermission catalog, and default roles get them only for the groups listed in `sensitivePermissionGroups` (`role.defaults.ts`); company admin roles get every tag (D56). Tagged today: dentalClinic medical history (patient and request) and request X-rays/photos (`health`); carRental reservation `drivers` (licences, IDs, scans) and deny-list `licenseNumber` (`identity`). Mark a whole field: a mark on a sub-field of an array or embedded document is not enforced, because SchemaGuard grants those together with their parent. No payment credentials are stored (cards and bank data stay with Stripe; only its IDs are kept), so nothing is marked `payment` (architect's choice, 2026-11-05).
  2. They never appear in snippets, list columns, logs, notifications/emails or AI tool output. Snippets are checked mechanically: the API refuses to start when one exposes a sensitive field (`findSensitiveSnippetFields`, `maestro/modules/core/utilities/security/sensitiveFields.ts`). The core CRUD list route leaves sensitive fields out of every row (`withoutSensitiveFields`); a record's own `/single` read returns them, and a custom list endpoint must do the same.
  3. Reads of health records are audited: when a signed-in user's request selects a sensitive field and gets a value, `auditPlugin` writes a `READ` AuditLog entry (who, record, field names, never values; once per record per request). Whole-document loads by code (no projection) are not reads by a person. The activity timeline shows "opened · <fields>". Change diffs keep their values and are shown only to users who may read the field; a health field's values are stored sealed (step 5) and opened for those readers by the timeline; erasure (step 4) must clear them too.
  4. Person erasure (D57): a company admin erases one person, found by email, from that company's records (Company page → "Erase a person's data", `POST /api/privacy/erasePerson`, with a preview; offered only to admins of a company that has a module with an eraser, session flag `canErasePeople`, and the route checks the same). Core runs every module's eraser (`register<Module>PersonErasers` in `<module>/utilities/erasure/`, seam in `maestro/modules/core/utilities/erasure/personErasure.ts`) in one transaction, deletes the files they hand back after commit and blanks the erased fields' values in old audit diffs. An eraser anonymises records the business must keep and hard-deletes special-category data; it finds records by the person's account and email and always filters by company. Every module that stores people findable by email or account needs an eraser, plus a sentence for the screen saying what it erases (sinfonia `src/modules/<module>/assets/languages/<locale>/personErasure.json`, `{"modules": {"<module>": "…"}}`, 5 locales; the screen lists the company's modules' sentences) (core's covers website chats; core's does not by itself offer the screen, since every company has core); free-text names cannot be found and are a known limit; each erased record gets an `ERASE` audit entry (who, when, nothing about the person).
  5. Health data is encrypted at rest in the application (D102, built 2026-11-09), on top of TLS in transit and host disk encryption:
     - **Fields:** every top-level field marked `sensitivity: "health"` whose value is data is stored as one AES-256-GCM ciphertext string, bound (AAD) to company, collection, record and field. `auditPlugin` applies it (`maestro/modules/core/database/plugins/healthEncryption.ts`): validation and the audit diff see the plaintext, `save` writes the ciphertext, a load opens it before the read audit and every reader (hydrated and lean; a projection of part of the field loads all of it). Readers with the permission get the same values and response shape as before. Values stored before D102 still read and are sealed on the record's next `save`, or by the next operator update of the record (`updateOne`, `updateMany`, `findOneAndUpdate`), in its session. Only `save` can set a health value: update queries, update pipelines, `insertMany` and `bulkWrite` that set one are refused (`$unset`, as erasure does, is allowed). A value that cannot be sealed refuses the write with `health_data_unsealable` (503). A mark below the top level is refused at start. A reference field (request X-rays) keeps its ids; its files are sealed at the media layer.
     - **Files:** an upload route that takes health files sets `mediaUploadMW({healthData: true})` (dentalClinic: every attachment in a patient conversation, both ways, and request files: patient-portal uploads and clinic-sent message attachments, D103). The bytes are sealed for that Media record under the owner company's key before they reach GridFS (`Media.encrypted`); `serveMedia` streams them to a reader the media ACL lets in, with `Cache-Control: no-store`: files are sealed in 64 KiB chunks (`HFE2`, TD-B101), each bound to the record, its position and whether it is last, so byte ranges open only the chunks they cover and each chunk is sent only after it verifies (a failure before the headers answers `health_data_unreadable`, after them the connection is cut short); files sealed whole before (`HFE1`) still open whole, without ranges. Server code that needs the bytes uses `readMediaBytes`; a copy streams them (`readMediaStream`) and is sealed again for its own record as it goes (`sealMediaFileStream`, TD-B111). No thumbnails or previews are stored server-side.
     - **Audit diffs:** a health field's `from`/`to` are sealed the same way, before the write; a change whose diff cannot be sealed is refused with `health_data_unsealable`, never saved without its history (D103). The document timeline opens them only for fields the reader may read.
     - **Keys:** `HEALTH_DATA_MASTER_KEY` (base64, 32 bytes; a module that stores health data requires it at start, core checks the format) wraps one data key per company (`CompanyDataKey`: company, version, wrapped key, master-key fingerprint), created on the company's first encryption; unwrapped keys stay in memory. Rotation: see [../CORE_USAGE_GUIDE.md](../CORE_USAGE_GUIDE.md). A tampered value, a moved one or a missing key answers `health_data_unreadable` (409), never a 500 or an empty value; logs name the record and field, never the value.
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
- **Exception (D100):** the company switcher's basic-info endpoints return name, description and logo of the caller's own active companies without the Company field permissions, so every member can switch.
