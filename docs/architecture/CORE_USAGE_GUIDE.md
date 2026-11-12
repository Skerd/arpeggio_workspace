# Core usage guide

How to consume and extend the core in each package. Rules: [rules/core.md](rules/core.md). Everything here was
verified in source on 2026-11-04. If a symbol is not listed here or findable under `*/modules/core`, it does not exist (GLB-02).

## Canonical implementations: copy these
| Need | Backend (maestro) | Contract (armonia) | UI (sinfonia) |
|---|---|---|---|
| Simple CRUD | `maestro/modules/core/api/auxiliary/private/country.ts`, `maestro/modules/core/database/schemas/country/` (`country.ts`, `country.service.ts`, `country.views.ts`) | `armonia/src/modules/core/api/auxiliary/private/country/` (`country.schema-def.ts`, `createCountry.form.validator.ts`) | `sinfonia/src/modules/core/clients/panel/private/tenancy/systemSettings/countries/` |
| Lifecycle (`@action`) | `maestro/modules/propertyManagement/api/realEstate/private/unit/reservation.ts` + `maestro/modules/propertyManagement/database/schemas/reservation/reservation.actions.ts` | `armonia/src/modules/propertyManagement/api/realEstate/private/unit/reservation/reservation.schema-def.ts` | `sinfonia/src/modules/propertyManagement/clients/panel/private/reservations/` |
| Non-CRUD router | `maestro/modules/propertyManagement/api/realEstate/private/dashboard.ts` | `AuthenticatedMWType & DashboardFormType` | n/a |
| Rich ViewConfig | the eight PM resources, see [rules/viewconfig.md](rules/viewconfig.md) | | |
| Snippets | `maestro/modules/core/database/schemas/state/state.snippets.ts` + `mapSnippet` | `armonia/src/modules/core/dto/state.dto.ts` | |

Known non-templates: `roleSheetView.tsx` (bypasses `SheetViewRenderer`), the custom reservation create page, and `createCashSale`/`createPaymentPlanSale`.

## maestro core: what to use
| Concern | Use | Path (`maestro/modules/core/…`) |
|---|---|---|
| CRUD routes | `createCrudRouter` (7 verbs + hooks `afterCreate`, `afterUpdate`, `beforeDelete`*, `afterDelete`, `afterRestore`, `enrichList`, `enrichSingle`, `createMiddleware`, `editMiddleware`) | `api/crudRouterFactory.ts` |
| Lifecycle | `@action({transaction, schema, rateLimit, middleware})`, `getRegisteredActions` | `api/actionDecorator.ts` |
| Payload building | `buildCreateDataFromSchemaDef` / `buildUpdateDataFromSchemaDef` | `api/buildUpdateDataFromSchemaDef.ts` |
| Middleware | `authMW`, `validateFormZod`, `asyncHandler`, `transactionHandler`, `dslFilterMW`, `schemaSanitizerMW`, `mediaUploadMW`, `rateLimiter`, `runInTransaction` | `utilities/middlewares/` |
| After commit | `runAfterCommit(session, task)` (failures are logged, never thrown) | `utilities/middlewares/transactionUtils.ts` |
| Request context | `requestContext` (AsyncLocalStorage) | `utilities/endpoints/requestContext.ts` |
| Persistence | `BaseCrudService<I, typeof Model>` (`findOneOrThrow`, `updateByIdOrThrow`, …; **does not add the company filter**) | `database/services/baseCrudService.ts` |
| Plugins | ownership, audit (sets timestamps), softDelete (not on `aggregate` yet), lifeCycle, publicMedia | `database/plugins/` |
| Registration | `addModelData(Model, views)` | `database/collections/index.ts` |
| Field/model ACL | `SchemaGuard.sanitizeFields`, `SchemaGuard.checkModelPermission(model, "create"\|"delete"\|"restore", ctx)` | `database/security/schemaGuard.ts` |
| Delete safety | `relationsRegistry`, `assertCanDelete` | `database/relationsRegistry.ts` |
| Mapping | `mapSnippet`, `nestedEntityToRef`, `decimalToNumber` | `utilities/mappers/common.mapper.ts` |
| Notifications | `emitNotificationEvent` | `domain/notifications/notificationEventBus.ts` |
| Logging | `getLogger(name, parent)` with `start/finish/fail`; `params.logger` in requests | `loggers/serverLog.ts` |
| Resilience | `executeWithCircuitBreaker`, `redisIncrWithExpiry`, `closeConnections` | `utilities/circuitBreaker.ts`, `connections/` |
| Modules | `isModuleEnabled`, manifest loader | `utilities/modules/enabledModules.ts` |
| Company timezone | `companyTimeZone(company)` / `companyTimeZoneOf(companyId, {session})`: the company's `timezone`, else `SERVER_TIMEZONE`, else UTC (D91); day/month bounds with `localDayInterval`, `localDateOf`, `addLocalDays` | `utilities/time/companyTimeZone.ts`, `utilities/time/timeWindows.ts` |
| Company-timezone validation (D116) | Zod factories get a `ValidationContext` (`{timeZone?}`, armonia `core/helpers/zodBuilder.ts`) as their **5th argument** `(languageCode, form, permissions, readPermissions, context)`. maestro: authMW writes the `companyTimeZone` server key (in `SERVER_KEYS`, clients cannot send it); `validateFormZod`, CRUD create/edit and `@action` schemas pass `{timeZone}` (instance zone on public routes). A factory with a day check declares `context: ValidationContext = {}` and calls `notInTheFutureZod(label, context.timeZone, lang)` / `notInThePastZod(...)`, or passes it to `buildCreateZodSchema(def, lang, form, context)` / `buildEditZodSchema(def, lang, form, perms, readPerms, context)` (SchemaDef `validation` uses `def.timezone ?? context.timeZone`, UTC when neither). sinfonia: `useCompanyTimeZone()` (session company `timezone`, from validateToken) as the factory's 5th argument (generic create/edit pages already do); count calendar days with `calendarDaysUntil(day, timeZone)`. Never hard-code `"UTC"` for a business day | `armonia/src/modules/core/helpers/zodBuilder.ts`, `armonia/src/modules/core/helpers/schemaDefBuilder.ts`, `maestro/modules/core/utilities/middlewares/validateFormZod.ts`, `maestro/modules/core/utilities/middlewares/authMW.ts`, `sinfonia/src/modules/core/helpers/hooks/useCompanyTimeZone.ts`, `sinfonia/src/modules/core/helpers/general/dateTime.ts` |
| Calendar days in the panel | `companyToday(timeZone)`, `addCalendarDays(day, n)`, `calendarMonthOf(day)`, `calendarDaysUntil(day, timeZone)` on `YYYY-MM-DD` days (D115); a create page's day default uses `defaultValues: (params, {timeZone}) => ({day: companyToday(timeZone)})`. A moment field uses `#DateInput` `widgetProps: {valueFormat: "YYYY-MM-DD HH:mm"}` (an ISO instant; there is no `withTime` prop) | `sinfonia/src/modules/core/helpers/general/dateTime.ts`, `sinfonia/src/modules/core/components/entityPage/pages/createGenericCreatePage.tsx` |
| AI tool calendar days | `calendarDayArg` for a day argument, `calendarDayRange` for the query, `companyToday(ctx)` and `calendarDaysPast(day, today)` for overdue on `YYYY-MM-DD` fields; `dateRange`/`daysOverdue` stay for instants | `maestro/modules/core/domain/ai/tools/assistantToolKit.ts` |
| Translated notifications + opt-out (D117, D128) | Emit with `params` (`CreateNotificationInput.params`, `variant` picks a message variant); texts live in armonia `<module>/helpers/static/notificationTypes/<xx_YY>.json` (`{<module>: {title, codes: {<CODE>: {title, message}}}}`), read by the panel (`notificationTitle`, `notificationMessage`, `getNotificationTypeGroups`) and the server (`notificationText(code, params, locale)`, `receiverLanguage(user)`); module emails filter receivers with `filterUnmutedReceivers(receiverIds, companyId, code)`; security notices are never muted | `armonia/src/modules/core/helpers/notificationTypes.ts`, `maestro/modules/core/domain/notifications/notificationTexts.ts`, `maestro/modules/core/domain/notifications/notificationDomainService.ts`, `sinfonia/src/modules/core/helpers/moduleContributions/loadNotificationTypesContributions.ts` |
| User language (D128) | `User.preferredLanguage` (5 locales), written by the user with `PATCH /api/user/data/language`; the panel keeps it in step (`usePreferredLanguageSync`); server-rendered notices use `receiverLanguage(user)` | `sinfonia/src/modules/core/helpers/hooks/usePreferredLanguageSync.ts`, `maestro/modules/core/domain/notifications/notificationTexts.ts` |
| Permission holders | `companyMemberIdsWithPermission(companyId, tag)` for "who can act on this" receivers | `maestro/modules/core/domain/roles/companyPermissionHolders.ts` |
| Default role labels (D118, D129) | `translateDefaultRole(role, locale)` / `translateRoleParams(params, locale)`; labels `{<definition slug>: {name, description}}` in `armonia/src/modules/<module>/helpers/static/defaultRoles/<xx_YY>.json` (en-US = the maestro definition word for word) | `armonia/src/modules/core/helpers/defaultRoleLabels.ts`; panel wrapper `sinfonia/src/modules/core/helpers/moduleContributions/loadRolesPermissionsContributions.ts`; server `maestro/modules/core/domain/notifications/notificationTexts.ts` |
| Studio pages (D124) | A module exports `StudioRouteContribution {pages: StudioPage[]}` from `clients/studio/routeConfigContribution.tsx`; English-only internal pages | `sinfonia/src/modules/core/helpers/types/studioRouteContribution.types.ts`, `sinfonia/src/modules/core/helpers/moduleContributions/loadStudioRouteContributions.ts` |
| Default roles | `DefaultRoleDefinition` packs (`permissionGroups`, `readPermissionGroups`, `sensitivePermissionGroups`, `excludedPermissions` for exact tags a role leaves out, D99), registered per module | `database/schemas/role/role.defaults.ts` |
| Platform owner | `assertPlatformCompany` / `assertPlatformAdmin` | `utilities/security/platformAccess.ts` |
| Stored references (D104) | Automatic on every tenant model (`ownershipPlugin`): a create or update storing a `ref` to a tenant-owned row of another company (not shared with it) is refused with `reference_outside_tenant` (403), on save/create, insertMany, update queries, literal ids in update pipelines (a computed reference is a developer error) and the model's `bulkWrite`. Company's references must be its own rows; a User membership (`roles[]`) holds only roles of its company, so write a membership whole (`$push: {roles: {company, roles}}`) or with `save()`, never `roles.$.roles`. A core plugin that must see `bulkWrite` adds a hook with `preBulkWrite` (`database/plugins/bulkWriteHooks.ts`), never its own `bulkWrite` static. Seam for flows that legitimately span companies: `allowForeignReferences({reason, fields: ["<Model>.<path>"]}, fn)`, naming each field (consumer: eCommerce `inShopPurchase`, through core `inPortalPurchase`) | `database/plugins/tenantReferences.ts`, `database/plugins/bulkWriteHooks.ts`, `utilities/endpoints/tenantScope.ts` |
| Portal storefront (D142) | A module selling on the portal resolves a public request with `resolveStorefrontContext(origin, lang)` (apex = platform, any other host = that company) and runs catalog reads through `inStorefrontCatalog` (cross-tenant on the apex only). Purchases from the portal zone (`isPortalPurchase(origin)`) run through `inPortalPurchase(spansSellers, work, allowance?)` or a route wrapped in `portalPurchaseRoute(handler, allowance?)`; pass an allowance only for references the module's records store across companies (D104). Storefront cards map sellers and prices with `toPortalSeller` / `toPortalCurrency` (populate with `PORTAL_CURRENCY_SELECT`); catalog queries take a `CatalogPage`. Slugs: `generateUniqueSlug(base, model, companyId, existingId?)`. Demo seed identity: `demoSeedTag` / `demoSeedName` / `withDemoSeedMarker`. Address forms read the host company's places from the public `/api/portal/places/{countries,states,cities}` (`portalPlaces.ts`) | `utilities/marketing/portalStorefront.ts`, `utilities/mappers/portal/portalStorefrontMapper.dto.ts`, `database/services/baseCrudService.ts`, `utilities/helpers/uniqueSlug.ts`, `database/demo/demoSeed.ts`, `api/portal/public/portalPlaces.ts`; contracts `PortalSeller` / `PortalCurrency` in armonia `core/api/portal/public/portal/portal.dto.ts` |
| Portal buyer module gate (D143) | A buyer route a portal account calls declares where its record lives: `authMW("private", {portalBuyer: target})`, or `portalBuyer: target` on an `@action`. For a portal-zone request whose session company (the platform) lacks the route's module, the module is checked on the company `target` names (active + module), else `module_not_enabled`. `target({body, params})` reads only the record's company, across companies with its reason; the route still checks the buyer is a party | `utilities/security/portalBuyer.ts` (`PortalBuyerTarget`, `portalBuyerTargetHasModule`), `utilities/middlewares/authMW.ts` (`AuthMWOptions`), `api/actionDecorator.ts` |
| Reference data across companies (D143) | Every company holds its own copy of currencies, countries, states and cities. A flow that writes a record into another company maps its references with `sameCurrencyIn(targetCompanyId, currency)` (ISO code) and `samePlacesIn(targetCompanyId, {country, state, city})` (country code, state code, city name; a part the target lacks comes back undefined). Both read cross-tenant | `utilities/helpers/referenceData.ts` |
| Protected companies (D143) | `Company.isProtected` (seed-only): the platform owner and the marketplace operator. Any path that deactivates, hides from the portal or changes a company's modules calls `assertCompanyChangeAllowed(company, {deactivate?, hideFromPortal?, removedModules?}, lang)` (`company_is_protected`); the panel hides those controls for it | `utilities/security/platformAccess.ts`, `database/schemas/company/company.defaults.ts` |
| Health data at rest (D102) | Mark the top-level field `sensitivity: "health"`: `auditPlugin` seals it on `save` and opens it on load (write it only with `save`). Health files: `mediaUploadMW({healthData: true})`; read bytes server-side with `readMediaBytes`; copy a file with `readMediaStream` → `sealMediaFileStream` → GridFS `uploadFile` (streamed, never whole). Keys: `HEALTH_DATA_MASTER_KEY` (+ `_PREVIOUS` during a rotation); a module storing health data requires it in its `environment.validator.ts` | `database/plugins/healthEncryption.ts`, `utilities/security/healthDataCrypto.ts`, `utilities/media/serveMedia.ts` |
| Cron / Kafka | `register*CronHandlers` (scanned in `cronjobs/bootstrap/loadAllHandlers.ts`), `start*KafkaConsumer(s)` (`kafka/startAllKafkaConsumers.ts`), `publishEvent` (returns `false` → handle in-process) | |
| Tests | `_tests/httpHarness.ts` | |

*`beforeDelete` currently replaces `assertCanDelete`, which violates CORE-04 (debt). Don't rely on it to *skip* safety.

### Health-data master-key rotation (D102)
Each company's data key is stored wrapped by the master key; the data itself is sealed with the data keys, so a rotation
only rewraps keys:
1. Generate a new key (`openssl rand -base64 32`). Set it as `HEALTH_DATA_MASTER_KEY`, move the old one to
   `HEALTH_DATA_MASTER_KEY_PREVIOUS`, restart every server (they read keys wrapped by either).
2. From `maestro/`, run `npm run health:rewrap-keys` with the same two values. It rewraps every key still under the old
   master key; a second run reports 0.
3. Remove `HEALTH_DATA_MASTER_KEY_PREVIOUS` and restart. Keep the old key in the secrets backup until a backup taken
   after step 2 exists: older database backups still need it.

Losing the master key makes every company's health data unreadable: back it up with the other server secrets.

## armonia core: what to use
| Concern | Use | Path (`armonia/src/modules/core/…`) |
|---|---|---|
| Entity contract | SchemaDef (`as const`) + `buildCreateZodSchema` / `buildEditZodSchema`, `InferCreateForm` / `InferEditForm` | `helpers/schemaDefBuilder.ts` |
| Value validators | ~50 helpers with localized messages (`stringMaxLengthZod`, `isNumberZod`, `isEnumZod`, `isObjectIdZod`, `isLocalDateZod`, `isTimeOfDayZod`, `isTimeOfDayEndZod` (window ends only, takes `24:00`), …); add new generic ones here | `helpers/zodBuilder.ts` |
| List/select/delete payloads | shared validators | `utilities/zod/shared.validator.ts` |
| Shared list types | `TableResponse<T>`, select/delete payloads | `types/shared.types.ts` |
| Errors | `apiValidationException` + keys in `helpers/static/exceptions/*.json` | `helpers/exceptions.ts` |
| Filter DSL | `FilterGroup` and friends | `database/filter/` |
| ViewConfig types | `ViewConfig`, `viewConfigKey` | `api/auxiliary/private/viewConfig/index.ts` |

Armonia runs in both runtimes (D37): it never imports Node built-ins or server-only packages. Core API error messages are built in; a vertical's messages live in `armonia/src/modules/<module>/helpers/static/exceptions/*.json` and maestro registers them at start-up (`loadModuleExceptionLocales` in `maestro/modules/core/utilities/helpers/exceptionLocales.ts`, called by every server and the test setup).

## sinfonia core: what to use
| Concern | Use | Path (`sinfonia/src/modules/core/…`) |
|---|---|---|
| Mount UI | `<kind>Contribution.tsx` (12 kinds) | `helpers/moduleContributions/` |
| Lists | `EntityListPage<T>` (seams: `renderCard`, `renderSheet`, `renderActionMenuChildren`, `header` slot composed from `EntityListHeader` + `EntityListCreateButton` (D60); refs `EntityListRefs`) | `components/entityPage/pages/entityListPage.tsx` |
| Forms | `createGenericCreatePage<CreateForm>`, `createGenericEditPage<Entity, EditForm>` | `components/entityPage/` |
| ViewConfig | `useViewConfig(model, "sheet"\|"form:create"\|"form:edit")`, `FormViewRenderer`, `SheetViewRenderer`, `widgetRegistry` | `components/viewEngine/`, `helpers/context/viewConfigContext.tsx` |
| HTTP | `withAxios` (components), `useHttpRequest` (hooks), `apiClient` (core helpers only) | `helpers/hocs/`, `helpers/hooks/`, `helpers/apiClient/apiClient.ts` |
| Access | `useAccess` + `Forbidden`; `useActionAccess(collection, action, scope?)` for `@action` permissions, scoped and loose models alike (D95) | `helpers/context/accessContext.tsx`, `helpers/hooks/useActionAccess.ts` |
| i18n | `withLanguage("<own path>")`, `useSelectedLanguage` | `helpers/hocs/`, `helpers/hooks/useSelectedLanguage.ts` |
| Portal section pages (D142) | `PortalSellerCard` (apex only, links to the seller's own site at `sectionPath`), `PortalInlineSignIn` (the caller passes its message), `PortalStatusPill` (tone by status word, the caller's label), `StarRow`, `formatRecordMoney` (the record's own currency, never a borrowed one), `resolvePublicMediaUrl`, `uniqueBySlug` | `clients/portal/shared/` (`portalSellerCard.tsx`, `portalInlineSignIn.tsx`, `portalStatusPill.tsx`, `starRow.tsx`, `portalMoney.ts`, `portalMedia.ts`, `catalogFilters.tsx`) |
| Primitives | shadcn `components/ui/*`, tabler icons | `components/ui/` |

## Extending core (decision table)
1. An existing seam fits → use it (CORE-03, MAY).
2. Existing parts compose → compose them in the vertical (MAY).
3. A generic helper is missing from a helper module → add it with a test (MAY).
4. Something truly new is needed → propose a seam: generic, one typed context object, a real consumer, a fixture test (APPROVAL REQUIRED).
5. A feature flag on a core component → never (MUST NOT).
