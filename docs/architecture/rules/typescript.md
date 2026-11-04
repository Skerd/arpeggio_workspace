<!-- Rule set TS-* · canonical · scope: {armonia,maestro,sinfonia}/**/*.{ts,tsx} · decisions: D07, D11, GLB-04 -->
> Rule IDs: this whole file is **TS-01** (type minimalism). Enforcement: `tsc --noEmit` in all three packages with one TypeScript version (D07, planned P1); until then run `sinfonia/node_modules/.bin/tsc` against maestro manually. Assertions/`any` are agent review.


# TypeScript Minimalism

**Trust the architecture. Trust validated boundaries. Let TypeScript infer what it can. Fix incorrect types at their source. Don't cast uncertainty away.**

This is the cornerstone. Every section below is an application of it. When a local convenience (an `as`, a `?.`, a duplicate type, a re-check) conflicts with this, follow this.

Write new code as if `noImplicitAny` and `strictNullChecks` apply in all three packages (Armonia has `strict`; Sinfonia has both flags; Maestro does not — still follow them).

Do not “fix” Core’s factory-edge `any` (`form: any = null`, `asyncHandler`, `createCrudRouter` config) in a feature PR. Match those signatures when plugging in. Type the handler body.

## Prefer inference

Allow TypeScript to infer types whenever the inferred type is clear and correct.

Do not add explicit type annotations for local variables, callback parameters, or return values solely for documentation or perceived safety.

Prefer existing domain and Core types over recreating equivalent types.

- Persistence: Maestro `interface I*` on the Mongoose document (`ICountry`).
- API/UI: Armonia `*.dto.ts` (`Country`) and SchemaDef inference (`InferCreateForm` / `InferEditForm`). SchemaDef must be `as const`. Canonical: `armonia/src/modules/core/api/auxiliary/private/country/country.schema-def.ts`.
- Lists/selects/delete: `armonia/src/modules/core/types/shared.types.ts`.
- After `authMW("private")`: `AuthenticatedMWType`. Intersect with the Armonia form type (`AuthenticatedMWType & DashboardFormType`). Canonical: `maestro/modules/propertyManagement/api/realEstate/private/dashboard.ts`.
- Pages: `EntityListPage<Country>`, `createGenericCreatePage<CreateCountryFormType>`, `createGenericEditPage<Country, EditCountryFormType>`.

Never invent a ViewModel, local DTO, or `FooFormValues` that duplicates an Armonia type. Never use `ICountry` in Sinfonia. Never use Armonia `Country` as a Mongoose document. Prefer `import type`. Prefer `satisfies` for object literals that must match an existing type (`FilterGroup`, `ChartConfig`) instead of `as`.

## Type assertions are exceptional

Do not use `as`, double assertions (`as unknown as`), or type assertions to silence TypeScript errors unless there is a verified reason the type system cannot express.

Before adding a type assertion:
1. Check whether the source type can be corrected.
2. Check whether an existing type or API provides the correct type.
3. Check whether the assertion is actually required by a known external boundary.

Never use a type assertion merely to make code compile.

A TypeScript error must not be fixed with a type assertion unless the agent can explain why the runtime value is known to satisfy the asserted type and why the type system cannot represent that fact correctly.

Verified boundaries in this repo: HOC `compose` return, Zod preprocess that Core already casts, `unknown` JSON/locale payloads, react-hook-form path names on a generic form. `as const` on SchemaDefs and literal unions is required, not an assertion smell.

Never `as any` / `as unknown as T` to silence a mismatch. Narrow, type the value, or use the Core mapper (`mapSnippet`, `nestedEntityToRef` in `maestro/modules/core/utilities/mappers/common.mapper.ts`). Never `(doc as any)._id` when the service already returns `I*`. Never `params as any` in a route that already ran `authMW` + `validateFormZod`.

## Trust established invariants

Runtime validation and explicit type narrowing belong primarily at untrusted system boundaries. Once data has passed a validated boundary, downstream application code should rely on the established types and invariants rather than repeatedly validating the same data.

Untrusted boundaries in this repo: Zod factories via `validateFormZod`, `authMW`, public/unauthenticated input, JSON/locale payloads, and unpopulated-or-unknown mapper input. Downstream route handlers, services, and UI that consume those results must not re-validate the same fields.

Do not add runtime checks for conditions already guaranteed by:
- TypeScript types
- validated input
- Core APIs
- database constraints
- authenticated request context
- established application invariants

Do not turn required values into optional values through unnecessary defensive programming.

| After | Treat as present |
|---|---|
| `authMW("private")` | `company`, `languageCode`, `actionUserCtx`, `logger` |
| `validateFormZod` | required schema fields |
| `findOneOrThrow` | the document (`Promise<T>`) |
| SchemaDef `required: true` | the form field |
| `useAccess` + existing Forbidden/HiddenElement | proceed; do not re-check the same flag later |

`findOne` can be null — check it. Validate **business rules** after a lookup (`foundUnit.status !== UnitStatus.AVAILABLE`). That is not defensive typing. Canonical: `maestro/modules/propertyManagement/api/realEstate/private/unit/reservation.ts`.

## Avoid unnecessary defensive code

Do not add `?.`, `??`, `if (!value)`, or fallback values unless the value can realistically be absent at that point.

When a value is unexpectedly nullable, investigate why instead of propagating optionality through the codebase.

Do not `company?._id` on `AuthenticatedMWType.company`. Do not `if (!doc)` after `findOneOrThrow`. Do not `typeof x === "string"` on an `InferCreateForm` required string. Do not re-run Zod/`isObjectIdZod` on a field the middleware already validated.

Optional chaining is for actually optional data (populated refs, permission maps `read?.keys`, Redux session before hydrate). Prefer one Core mapper (`mapSnippet` with `SimpleBlankUserSnippet`) over `(x as any)?._id ?? (x as any)`.

## Keep types local and purposeful

Do not create interfaces, type aliases, generic wrappers, or utility types for one trivial use.

Do not introduce generics unless they provide meaningful reuse or improve correctness.

Prefer simple concrete types when the code has a single concrete use case.

Do not add `export type X = TableForm & {}` or `export type X = TableForm` — use `TableForm`. Do not hand-write a create/edit form type when SchemaDef exists — export `InferCreateForm<typeof Def>`. Do not add `z.infer<ReturnType<typeof schema>>` in Sinfonia when Armonia already exported that form type. Do not add an interface used in a single destructure.

Armonia uses `type`. Maestro Mongoose documents use `interface I*`. Do not export both for the same shape.

Use Core generics: `BaseCrudService<ICountry, typeof Country>`, `EntityListPage<Country>`, `InferCreateForm<typeof SchemaDef>`, `TableResponse<T>`. Do not add a type parameter to a function used once. Do not wrap Core in another generic factory.

Exception: copy the Core Zod factory arity (`languageCode: string, form: any = null`; edit also takes `permissions` / `readPermissions`). Do not invent a generic `FormDict<T>` unless Core already exports one. Catch clauses: `unknown`, then narrow — do not add `catch (e: any)`. New feature code: no `any`, no `{[key: string]: any}`, no `Function`. Use `unknown` and narrow, or `Record<string, unknown>` for untyped objects.

## Fix the source of type problems

When TypeScript reports a type mismatch, prefer fixing the underlying type or data flow over casting at the point of use.

A compiling cast is not evidence of correctness.
