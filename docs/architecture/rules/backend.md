# Backend rules (BE-*)

Scope: `maestro/**` and Armonia validators/exceptions. Database rules are in [database.md](database.md) and security
rules in [security.md](security.md).

---

### BE-01 · MUST · Layer placement
| Code | Lives in | Contains |
|---|---|---|
| DB operations on one model's collection (find, update, aggregate, counts) | `database/schemas/<e>/<e>.service.ts` (extends `BaseCrudService`) | persistence only |
| Everything a user or actor does to one record (publish, cancel, change status) | `database/schemas/<e>/<e>.actions.ts` (`@action`) | one entity's transitions, which may orchestrate other entities **through their services** |
| Flows spanning entities that no single model owns (checkout, POS session) | `<module>/workflows/` | the flow, called by thin entry points |
| Adapters to external systems (Stripe, Odoo, fiscalization, ZEFIX, SMTP, AI) | `<module>/integrations/` | typed adapter (BE-09) |
| Generic reusable helpers (money→decimal, formatting, pure computations) | `utilities/` | **pure: no DB, no side effects** |
| HTTP wiring | `api/**` route files + crud hooks | validation, auth and delegation only, no business rules inline |
- **Current state:** `utilities/services/*` holds full multi-trigger logic: `eCommerce/.../posService.ts` 1,493 lines, `carRental/.../rentalLifecycle.ts` 851, `checkoutPlacementService.ts` 550. This is catalogued debt. New code follows the table, and existing files migrate only under AGT-06 scope.
- **Why:** D05, D49, D55. **Enforce:** review.

### BE-02 · MUST · One transition, one function; every trigger wraps it with its own checks
- **Rule:** A transition that several triggers start lives in **one** function: a service function next to the entity, or a `workflows/` flow when it spans entities. Each trigger is a thin wrapper that adds only its own access check and input:
  - **staff:** the `@action` (permission SEC-02, Zod `schema`, `transaction: true`). Exception (D97): an action that must call an external service with the transaction's result (POS `pay` → CIS) owns its transaction with `runInTransaction` and makes the external call after it commits;
  - **customer:** the `my*` or storefront route (`authMW`, `validateFormZod`, `transactionHandler`, plus an ownership or manage-token check);
  - **system:** the cron handler or webhook, through `runInTransaction`, which carries the tenant and after-commit timing (D16, D06).
- ✅ `cancelRentalReservation` (`maestro/modules/carRental/workflows/rentalLifecycle.ts`): staff `cancel` action, `myRentalReservation` route and storefront manage route; `expireRentalHold` from the hold-expiry cron.
- **MUST NOT:** call `new XActions().method(...)` from another trigger: that skips auth, Zod and the transaction (the decorator only records metadata, `maestro/modules/core/api/actionDecorator.ts`). Nothing does today. **MUST NOT** run a non-request transaction with a bare `session.withTransaction` that queues after-commit work without flushing it (use `runInTransaction`).
- **Deferred (D55):** the `invokeAction(action, payload, actor)` seam is built only when a trigger first needs to run an action's own body; none does.
- **Why:** D49, D55. **Enforce:** review.

### BE-03 · MUST · Routes
- `createCrudRouter` (`maestro/modules/core/api/crudRouterFactory.ts`) provides the seven verbs: POST `/select`, POST `""` (list), POST `/single`, PUT (create), PATCH (edit), DELETE, PATCH `/restore`. Never hand-write them.
- A manual `Router` is allowed only for aggregations/dashboards, public catalogs and webhooks. It still uses `authMW`, `validateFormZod` and `asyncHandler` (`maestro/modules/core/utilities/middlewares/`).
- Lifecycle transitions are `@action` methods exposed as `POST /<methodName>`. **MUST NOT** use PATCH as a state machine. ✅ `core/database/schemas/user/user.actions.ts` (`unlockActivation`, `resendActivationEmail`, … as `@action`s with `_id` in the body, D65; the old PATCH routes were removed, D74).
- List filters compile through `dslFilterMW` from the Armonia `FilterGroup`; no second query language.
- Uploads go through `mediaUploadMW`. Payloads are built with `buildCreateDataFromSchemaDef` / `buildUpdateDataFromSchemaDef`.
- **Why:** existing maestro-api rule (verified). **Enforce:** review.

### BE-04 · MUST · Transactions
- **Rule:** Writes run inside the session owned by `transactionHandler` + `asyncHandler` (the factory does this already). Never commit or abort ad hoc, and never `startSession()` in feature code. Outside requests, use `runInTransaction`.
- **Why:** verified (`asyncHandler.ts` retries `TransientTransactionError`, ends the session; a middleware that fails before the handler is rolled back by `failedRequestCleanup`, mounted after every router, D176). **Enforce:** review.

### BE-05 · MUST · Validation contract
- **Rule:** Every body is validated by `validateFormZod` with an Armonia `(languageCode, form) => ZodObject` factory, the same factory sinfonia's form imports. Never write ad-hoc `req.body` checks. For list/select/single/delete/restore, reuse `armonia/src/modules/core/utilities/zod/shared.validator.ts`.
- **Why:** existing contracts rule. **Enforce:** review.

### BE-06 · Zod construction
| Payload | Rule |
|---|---|
| Create/edit of an entity with a SchemaDef | **MUST** `buildCreateZodSchema` / `buildEditZodSchema` (`armonia/src/modules/core/helpers/schemaDefBuilder.ts`) |
| Action, query or other non-entity payload | **MAY** hand-write it in an Armonia `*.form.validator.ts` |
| Any value check (length, number range, enum, id, date, url, boolean) | **MUST** use a `zodBuilder.ts` helper (`stringMaxLengthZod`, `isNumberZod`, `inBetweenRangeZod`, `isEnumZod`, `isObjectIdZod`, `isBooleanZod`, `parsableDateStringZod`, `isUrlZod`, …) so the message is localized and stays correct if the rule changes |
| Raw `z.string()`, `z.number()`, `z.coerce`, `.min(`, `.max(` in validators | **MUST NOT**. Raw Zod is for structure only: `z.object`, `.optional()`, `.refine` with an exception key |
| No helper fits | **MAY** add a generic helper + its locale key to `zodBuilder.ts` (no approval) |
| Zod defined in maestro or sinfonia | **MUST NOT**, except AI assistant tool-parameter schemas under `maestro/modules/*/domain/ai/` and sinfonia's Vite env validation (D51). Debt: 6 maestro eCommerce files (`fiscal.ts`, `productOrder.ts`, `checked/posSession.ts`, `posOrder.ts`, `inventoryMovement.ts`, `public/shopProductReviews.ts`) and sinfonia `listingCategories/editCategory.tsx` |
- Form types **SHOULD** be inferred (`z.infer<ReturnType<typeof schema>>`), not hand-written next to the schema.
- ✅ `reason: stringMaxLengthZod("reason", 2000, languageCode).optional()` ❌ `reason: z.string().max(2000).optional()`
- **Why:** D11. **Enforce:** check `zod` (baselined; D51 exemptions built in).

### BE-07 · MUST · Errors
- **Rule:** Every API failure throws `apiValidationException(code, …)` (`armonia/src/modules/core/helpers/exceptions.ts`) with a key in `armonia/src/modules/<mod>/helpers/static/exceptions/*.json`, present in all 5 locales. Module keys add; they never override core keys.
- **MUST NOT:** `throw new Error("…")` for business rules or provider failures; those become 500s. ❌ `eCommerce/utilities/fiscalization/fiscalizationService.ts` (~15 sites), `propertyManagement/api/realEstate/public/marketingAvailability.ts:41` (debt).
- **Why:** existing rule; D40. **Enforce:** review.

### BE-08 · MUST · Side effects never depend on, or outlive, the transaction
- (a) A side-effect failure never fails or rolls back the business operation: log and fall back. This already holds via `flushAfterCommitTasks`.
- (b) Notifications, email, WS pushes, Kafka publishes and external HTTP made during a transaction run **after commit** via `runAfterCommit(session, task)` (`maestro/modules/core/utilities/middlewares/transactionUtils.ts`). A failed request, and every attempt `asyncHandler` replays after a write conflict, drops its queued tasks.
- (c) **Built (D06, 2026-11-05):** `transactionHandler` and `runInTransaction` put their session in `requestContext`, so:
  - `emitNotificationEvent` always waits for the open transaction (no call-site change needed);
  - `runAfterCommit(undefined, task)` waits for the request's transaction too.
  - Email and Kafka sends are **not** deferred by core: their callers use the outcome (Kafka producers fall back to SMTP); core account emails (invitation, activation, password reset, MFA deactivation) go out after the commit through `sendAccountEmailAfterCommit` and a failure is logged, not answered (D58). A send that follows a write goes in `runAfterCommit` at the call site; a send that *is* the operation (a manual "send email" action that reports `client_has_no_email`) stays in the request.
  - Code running its own `session.withTransaction` puts nothing in the context: it calls `flushAfterCommitTasks` itself and passes its `session` to `runAfterCommit`.
- **MUST NOT:** a second after-commit mechanism (propertyManagement's `session.once("ended")` helper was removed: it fired once per retried attempt).
- **Why:** D06. **Enforce:** `afterCommit.test.ts`; review.

### BE-09 · MUST · External integrations
- **Outbound:** calls go through a typed adapter with a timeout and the core circuit breaker (`executeWithCircuitBreaker`).
- **Company-supplied addresses (D189):** a URL or host a company enters (an Odoo server, a card terminal, a fiscal endpoint or proxy) is checked by the core guard `maestro/modules/core/utilities/security/publicUrl.ts` before every request and every redirect hop: `assertPublicUrl` refuses a private, local or internal address, or a name that does not resolve, with `url_not_public`. Where the client can take a resolver (node `http`/`https`, axios agents), it also connects through `publicOnlyLookup`, so a name cannot switch to a private address between the check and the connect.
- **Inbound webhooks:** verify the signature, are idempotent (stored event id, duplicates ignored), and do their work after commit.
- **Errors:** provider errors map to exception keys.
- **Secrets:** come from env/secrets only.
- **Tests:** use fake adapters, never live providers.
- **Why:** D40. **Enforce:** review.

### BE-10 · MUST · Background work tiers
- **Rule:**
  - Short side effects run as after-commit tasks.
  - Scheduled or sweep work runs as cron handlers (`register*CronHandlers`, in-process leader runner).
  - Kafka is only for work that must survive a crash or run in another server (assistant, rollups, and every client or staff email, one topic per email kind, D188).
  - Kafka is **optional**: every producer has an in-process fallback (`publishEvent` returns `false` → the caller handles it), and the API never requires Kafka to serve requests.
- **Why:** D41, D188. **Enforce:** review.

### BE-11 · MUST · Logging
- **Rule:**
  - Log through `params.logger` (request) or `getLogger(name)` (`maestro/modules/core/loggers/serverLog.ts`).
  - Levels: error = needs attention; warn = degraded but handled; info = business events; debug = dev detail.
  - Request logs carry the request-id.
  - **MUST NOT:** `console.*` outside `scripts/` and tests (143 existing calls in 84 files are debt, frozen in the lint baseline: TD-B08), or logging secrets, tokens, passwords, or full payment/medical payloads.
- **Why:** D38. **Enforce:** maestro ESLint `no-console` (root `npm run lint`, existing calls baselined).

### BE-12 · MUST · Notifications
- **Rule:** Domain notifications go through `emitNotificationEvent` (`maestro/modules/core/domain/notifications/notificationEventBus.ts`). Never a parallel event bus.
- **Why:** existing rule (verified, 85 call sites).
