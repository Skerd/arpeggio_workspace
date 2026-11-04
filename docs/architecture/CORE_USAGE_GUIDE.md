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
| Platform owner | `assertPlatformCompany` / `assertPlatformAdmin` | `utilities/security/platformAccess.ts` |
| Cron / Kafka | `register*CronHandlers` (scanned in `cronjobs/bootstrap/loadAllHandlers.ts`), `start*KafkaConsumer(s)` (`kafka/startAllKafkaConsumers.ts`), `publishEvent` (returns `false` → handle in-process) | |
| Tests | `_tests/httpHarness.ts` | |

*`beforeDelete` currently replaces `assertCanDelete`, which violates CORE-04 (debt). Don't rely on it to *skip* safety.

## armonia core: what to use
| Concern | Use | Path (`armonia/src/modules/core/…`) |
|---|---|---|
| Entity contract | SchemaDef (`as const`) + `buildCreateZodSchema` / `buildEditZodSchema`, `InferCreateForm` / `InferEditForm` | `helpers/schemaDefBuilder.ts` |
| Value validators | ~50 helpers with localized messages (`stringMaxLengthZod`, `isNumberZod`, `isEnumZod`, `isObjectIdZod`, `isLocalDateZod`, `isTimeOfDayZod`, …); add new generic ones here | `helpers/zodBuilder.ts` |
| List/select/delete payloads | shared validators | `utilities/zod/shared.validator.ts` |
| Shared list types | `TableResponse<T>`, select/delete payloads | `types/shared.types.ts` |
| Errors | `apiValidationException` + keys in `helpers/static/exceptions/*.json` | `helpers/exceptions.ts` |
| Filter DSL | `FilterGroup` and friends | `database/filter/` |
| ViewConfig types | `ViewConfig`, `viewConfigKey` | `api/auxiliary/private/viewConfig/index.ts` |

⚠ `helpers/exceptions.ts` and `discoverModuleLocales.ts` use `fs` at module load. Never value-import validators that reach them into sinfonia until D37 is fixed. Type-only imports are fine.

## sinfonia core: what to use
| Concern | Use | Path (`sinfonia/src/modules/core/…`) |
|---|---|---|
| Mount UI | `<kind>Contribution.tsx` (12 kinds) | `helpers/moduleContributions/` |
| Lists | `EntityListPage<T>` (seams: `renderCard`, `renderSheet`, `renderActionMenuChildren`, `headerActions`; refs `EntityListRefs`) | `components/entityPage/pages/entityListPage.tsx` |
| Forms | `createGenericCreatePage<CreateForm>`, `createGenericEditPage<Entity, EditForm>` | `components/entityPage/` |
| ViewConfig | `useViewConfig(model, "sheet"\|"form:create"\|"form:edit")`, `FormViewRenderer`, `SheetViewRenderer`, `widgetRegistry` | `components/viewEngine/`, `helpers/context/viewConfigContext.tsx` |
| HTTP | `withAxios` (components), `useHttpRequest` (hooks), `apiClient` (core helpers only) | `helpers/hocs/`, `helpers/hooks/`, `helpers/apiClient/apiClient.ts` |
| Access | `useAccess` + `Forbidden` | `helpers/context/accessContext.tsx` |
| i18n | `withLanguage("<own path>")`, `useSelectedLanguage` | `helpers/hocs/`, `helpers/hooks/useSelectedLanguage.ts` |
| Primitives | shadcn `components/ui/*`, tabler icons | `components/ui/` |

## Extending core (decision table)
1. An existing seam fits → use it (CORE-03, MAY).
2. Existing parts compose → compose them in the vertical (MAY).
3. A generic helper is missing from a helper module → add it with a test (MAY).
4. Something truly new is needed → propose a seam: generic, one typed context object, a real consumer, a fixture test (APPROVAL REQUIRED).
5. A feature flag on a core component → never (MUST NOT).
