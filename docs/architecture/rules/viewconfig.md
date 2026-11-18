<!-- Rule set VC-* · canonical · scope: maestro/**/*.views.ts, armonia viewConfig, sinfonia viewEngine/entityPage/create*/edit* · decisions: D04, D20, memory viewconfig-no-helper-functions -->
> Rule IDs: this whole file is **VC-01**. Additions from the governance interview:
> - **VC-02 · MUST NOT** helper functions in `*.views.ts` (no `perm()`/`number()` closures, no `xFormNodes(edit)`): separate typed `const xCreateFormNodes: ViewConfig["nodes"]` and `xEditFormNodes`. Create nodes carry no `permissions`; edit `#Field`s carry `permissions:{read,write}`; the outermost section wrapper carries `readAny/writeAny` of every nested field.
> - **VC-03 · APPROVAL REQUIRED** a new widget token, sheet section or `ViewMode` is a new core seam (CORE-03, D04). "Never invent" below means: never add one ad hoc; propose it.
> - Widget paths: Core `sinfonia/src/modules/core/components/viewEngine/widgetRegistry.ts`; module tokens via `*/clients/panel/widgetContribution.tsx`. (`src/modules/base` no longer exists.)


# ViewConfig — sheets and create/edit forms

ViewConfig is **layout only**. SchemaDef, Zod, and `@action` own data and behavior.

**Never add extra building blocks or new logic** to make a form or sheet work. No new widget tokens, form engines, sheet section components, view-builder factories, `ViewMode` values, client-only Zod, or hardcoded field trees in Sinfonia when a `*.views.ts` exists. If the needed widget, section, or cascade already exists on Country or one of the eight fixed property resources below, copy that node. If it does not exist in Core `widgetRegistry` or the PM `widgetContribution`, reuse a registered token — do not invent a parallel one.

Types: `armonia/src/modules/core/api/auxiliary/private/viewConfig/index.ts`. Runtime: `sinfonia/src/modules/core/components/viewEngine/`. Registration: `addModelData` in the Mongoose schema file.

## Ownership — do not mix

| Concern | Owner | Not here |
|---|---|---|
| Field presence, required, min/max, `InferCreateForm` / `InferEditForm` | Armonia `*.schema-def.ts` + Zod factories | ViewConfig |
| Layout, widgets, sections, i18n keys, `header`, `dependent` | `*.views.ts` | SchemaDef / routes |
| List columns / filters | `TableConfiguration` / `dynamicTableConfiguration` | ViewConfig (`viewType` is only `"sheet"` \| `"form"`) |
| Cancel, approve, handover, pay, email | `@action` dialogs on the sheet wrapper | Create/edit forms |

`field.name` must match SchemaDef / ACL paths so `filterViewConfig` and RHF bind correctly. There is **no** SchemaDef → view codegen. Do not add a generator. `field.required` is a UI asterisk; Zod still enforces. `widgetProps.maxLength` may copy a SchemaDef constant (Country does this) — that is a UX hint, not validation.

UI-only cascade fields (`project` / `edifice` / `floor` on unit-child forms) and form-type extensions (`polygonCoordinates`, `_addressMap`) are allowed **only** when the closest of the eight already does that.

## Copy this file — do not design a new layout

Simple CRUD starts from Country. Richer surfaces copy the closest of these **fixed** resources. They are the reference set, not a second architecture.

| Need | Copy |
|---|---|
| Simple 3-field CRUD | `maestro/modules/core/database/schemas/country/country.views.ts` |
| Root entity, media, `#FormRepeater` | `…/propertyManagement/database/schemas/project/project.views.ts` |
| Parent `#ApiSelect`, address, polygon | `…/edifice/edifice.views.ts` |
| Nested cascade + `formExtras` hide | `…/floor/floor.views.ts` or `…/unit/unit.views.ts` |
| Related-entity lists on a sheet | `…/unit/unit.views.ts` (`#ReferencesRender`) |
| Create only (immutable after create) | `…/reservation/reservation.views.ts` |
| Narrow edit; computed sheet; `@action` | `…/sale/sale.views.ts` |
| Conditional fields by status | `…/inspection/inspection.views.ts` (`#FormWhenFieldValueIn`) |
| Thin form; sheet-heavy workflow | `…/modificationRequest/modificationRequest.views.ts` |

**Never** copy `sinfonia/src/modules/core/clients/panel/private/tenancy/systemSettings/roles/center/sheetView/roleSheetView.tsx` — it bypasses `SheetViewRenderer`.

## Files, exports, registration

One views file per entity: `maestro/modules/<mod>/database/schemas/<entity>/<entity>.views.ts`.

| Export | `viewType` | `viewMode` | `method` | Registry key |
|---|---|---|---|---|
| `<entity>SheetView` | `"sheet"` | omit | — | `"sheet"` |
| `<entity>CreateFormView` | `"form"` | `"create"` | `"PUT"` | `"form:create"` |
| `<entity>EditFormView` | `"form"` | `"edit"` | `"PATCH"` | `"form:edit"` |
| `<entity>Views` | `ViewConfig[]` passed to `addModelData` | | | |

Keys come from `viewConfigKey` in the ViewConfig type file. Sinfonia loads them with `useViewConfig(model, "sheet" | "form:create" | "form:edit")`. Pages pass `model` / `collectionName` only — they do not pass a view export.

- Omit `<entity>EditFormView` when the resource is immutable after create (Reservation).
- Sale create is a **name** exception: `saleCreateCashFormView` still keys as `"form:create"`. Do not add a new `ViewMode`. `"createPaymentPlanSale"` exists on the type but no `*.views.ts` sets it — payment-plan sale uses `"form:create"` on `paymentplans`.
- Always `addModelData(Model, entityViews)` next to the Mongoose model. Already done for Country and the eight. Never attach views inside `createCrudRouter`.
- Sheet `model` is the Mongo collection (`projects`, `modificationrequests`). `accessModel` is the `useAccess` key (`projects`, `modificationRequests`). `apiUrl` is the CRUD base path.

## Form recipe

Layout: `#TitleWithCollapse` → `#FormGrid` → `#Field` + registered widget. Country may skip collapse for a single grid. Rich PM forms use one collapse per section (`generalInfo`, `address`, media blocks).

Create vs edit:

- Same node tree unless a **verified** exception (sale edit is a short grid; reservation has no edit).
- Edit adds `permissions.read` / `write` on fields and `writeAny` on sections. Create usually does not.
- Parent cascade on edit: ancestors read-only (`permissions: { read }` + `skipWriteAccessGate`); leaf parent keeps read+write. Copy floor/unit.
- Never author `field.locked`. `filterViewConfig` sets it. Create forms do not disable from missing write; edit forms do.

### Registered form widgets only

Tokens live in `sinfonia/src/modules/core/components/viewEngine/widgetRegistry.ts` and `sinfonia/src/modules/propertyManagement/clients/panel/widgetContribution.tsx`. `#Field` is the form shell — not a registry widget.

| Data | Form widget | Copy |
|---|---|---|
| Short / long text | `#Input` / `#Textarea` | Country, project |
| Boolean | `#Switch` / `#Checkbox` | Project, floor |
| Enum / static options | `#SimpleSelect` | Unit layout, inspection status |
| Single ref | `#ApiSelect` | Edifice `project`, unit cascade |
| Multi ObjectId | `#FormObjectIdChips` or multi `#ApiSelect` | Edifice constructors; unit `connectedUnits` |
| String list | `#StringArrayInput` | Edifice facilities |
| Nested object rows | `#FormRepeater` (`arrayField`, `defaultItem`, `rowTemplate`) | Project `socialLinks` |
| Pick a row of another repeater | `#Select` with `optionsFromFormArray: {arrayField, labelField}` (stores the 1-based row number, D150) | Dental quote line `phase` |
| Tabbed nested rows | `#FormTabbedRepeater` | Inspection findings |
| CRUD media | `#MediaField` | Project / edifice / floor / unit |
| Local multipart files | `#FormMultiLocalFileField` | Reservation / sale documents |
| Address | nested `address.*` + country→state→city `#ApiSelect` + `#FormMapPinPicker` | Edifice |
| Polygon on parent image | `#FormEdificePolygon` / `#FormFloorPolygon` / `#FormUnitPolygon` | Edifice / floor / unit |
| Show/hide by value | `#FormWhenFieldValueIn` (`watchField`, `whenValues`, optional `clearFields`) | Inspection |
| Discount (sale only) | `#LocalDiscountField` | Sale create — do not reuse elsewhere unless the field is the same |

An `#ApiSelect` offers "Create new '…'" under its dropdown's list for every model whose module lists its create page in `widgetContribution` `createPages` (D169). A new entity with a create page and a `/select` adds that one line; nothing goes in `*.views.ts`.

`#DatePicker` and `#FilePicker` are in the type union but **not** registered. Use `#DateInput` and `#MediaField` / `#FormMultiLocalFileField`.

### Hierarchy cascade — copy props, do not invent

Project → edifice → floor → unit on child creates (floor, unit, reservation, sale, inspection, modification request):

- Parent: `cascadeClearFormFields: ["edifice", "floor", "unit"]` (trim to remaining children).
- Child: `postBodyFromFormField: { field, paramName }`, `remountKeyFormField`, `cascadeClearFormFields` for descendants.
- Hide the block when the route already has the parent/unit: `props.skipRenderWhenFormExtraTruthy` plus page `formExtras` (`hasRouteEdificeId`, `prefilledUnitId`, `hideProjectToUnitCascade`, `hideModificationUnitCascade`). Copy the existing extra name; do not invent a synonym.

Sinfonia: `createGenericCreatePage` / `createGenericEditPage` with Armonia `model`, `apiUrl`, schema factory, and `Create*FormType` / `Edit*FormType`. They load `"form:create"` / `"form:edit"` themselves.

**Verified page exceptions — not templates for a new resource:**

- Reservation create: custom `FormViewRenderer` (multipart + inject `reservedByCompany`). No edit page.
- Sale create: `createCashSale.tsx` / `createPaymentPlanSale.tsx` with `renderChildren` for live pricing. Edit stays generic and narrow (reference / notes; discount is create-only).

## Sheet recipe

Layout: `header` (`titleField`, `subtitleKey`, `showCloseButton`) → `#SheetGroup` → `#SheetGrid` → `#DisplayCard` (or a registered sheet widget). Every sheet **ends** with `lifecycleSheetGroup` from `maestro/modules/core/database/schemas/shared/lifecycleSheetGroup.ts` (`createdAt`, `updatedAt`, `createdBy`, `deletedAt`, `deletedBy`). Do not duplicate audit fields.

| Data | Sheet display | Copy |
|---|---|---|
| Scalar | `#DisplayCard` + `icon` | Country |
| Date / datetime | `widgetProps.format: "date"` \| `"dateTime"` | Reservation dates |
| Enum | `languageKeyCategory` + `type: "enum"` | Unit status |
| Boolean | `type: "boolean"` / `valueType: "boolean"` | Project switches |
| Money | `type: "currency"` and/or `valuePath: [symbol, amount]` | Sale / reservation |
| Long text | expandable `#DisplayCard` (`maxLength: 250`) or `#ExpandableText` | Project description |
| Image / video gallery | `#GalleryCarousel` | Project / edifice / unit |
| File list | `#SheetMediaFilesStrip` | Media / contracts |
| Embedded subdocs | `#SheetEmbeddedItemsList` | Project `socialLinks`; inspection findings |
| Related collection | `#ReferencesRender` + existing `cardWidget` | Unit inspections / sale / reservation |
| Linked parent | `#DisplayCard` `linkedRefPath` + `linkedSheetModel` + `linkedSheetWidget` | Floor `edifice`; unit ancestry |
| Address block | `#SheetAddressSection` | Edifice |
| Computed stats | `#SheetGroup` + `dependentAny: ["statistics"]` + `dependentRuntimeOnly: true` | Project / edifice / floor / unit |
| Price history | `#SheetPriceHistoryChart` | Unit only |
| Approval line items | `#SheetModificationLineItems` | Modification request only |

`#ReferencesRender` needs `cardWidget` already in the PM contribution (`#InspectionCard`, `#ModificationRequestCard`, `#EdificeCard`, sale/reservation/payment-plan cards, …). Compact toggle requires `#ReferencesViewModeScope` + `compactRow` — copy unit, do not invent a list component.

Sheet-only paths (status, `statistics.*`, populated relations, remaining balance) are fine when the closest of the eight already shows them. Do not add a form field just to display a computed sheet value.

Sinfonia `*SheetView.tsx`: thin wrapper — `useViewConfig(model, "sheet")` + `SheetViewRenderer`. Custom TSX is **only** `actionMenuChildren` and existing overlays/dialogs:

| Resource | Wrapper may add |
|---|---|
| Project | View Edifices / Floors overlays |
| Edifice | View Floors; generate floors/units |
| Floor | View Units overlay |
| Unit | `UnitDomainMenuItems` |
| Reservation | Lifecycle dialogs (`ReservationRowMenuExtras`) |
| Sale | `SaleRowMenuExtras` + handover dialog |
| Inspection | Cancel dialog |
| Modification request | Approval / finance / delivery / cancel dialogs |

Never a second field layout in that TSX.

## The eight + Country — what each view set already is

- **Country:** one overview grid; create/edit share three `#Input`s; edit adds permissions.
- **Project:** media + `#FormRepeater` social links; sheet galleries / embedded links / stats. Root — no parent ref.
- **Edifice:** `project` `#ApiSelect`; address cascade + map; `#FormEdificePolygon`; chips + string array. Sheet address + linked project.
- **Floor:** project→edifice cascade hidden by `hasRouteEdificeId`; `#FormFloorPolygon`. Edit: `project` read-only.
- **Unit:** project→edifice→floor cascade; `#FormUnitPolygon`; sheet `#ReferencesRender` for inspections, costs, modification requests, sale, reservation + price history.
- **Reservation:** sheet + create only. Create cascade skipped by `prefilledUnitId`. Server injects `reservedByCompany`. Sheet shows computed financials and email timeline.
- **Sale:** create is cash fields + `#LocalDiscountField` + documents; edit is reference / notes only. Sheet shows computed pricing and `@action` handover/title.
- **Inspection:** optional cascade; `#FormWhenFieldValueIn` for scheduled/cancel; `#FormTabbedRepeater` findings. Cancel is a sheet `@action`.
- **Modification request:** form is unit + title/description/specs only. Approvals, finance, delivery live on the sheet via `@action` — never on the form.

## i18n

`withLanguage` on the page/sheet path. ViewConfig stores **keys** (`label: "form.nameLabel"`, `#SheetGroup` `title: "overview"`, header `subtitleKey: "project"`). Renderers call `resolveLanguageKey`. Enum sheet values: `languageKeyCategory` → `` `${category}.${value}` ``. Do not wrap `#FormRepeater` in a second `withLanguage` (nested `form.*` keys resolve against the wrong dictionary).

## Never

- New widgets, sheet sections, form field components or `ViewMode`s added ad hoc (a genuinely new one is an APPROVAL REQUIRED seam, VC-03); view-builder helpers; a second “form config” object besides ViewConfig
- Validation, submit handlers, or business rules in `*.views.ts`
- Hardcoded create/edit field JSX when ViewConfig exists
- Approvals / cancel / handover / pay / email as form fields (those are `@action` dialogs)
- A second client Zod schema
- New `ViewMode` or `viewType: "list"`
- Copying `roleSheetView` as the CRUD template
- Dropping unreadable sheet `#DisplayCard`s — the prune locks them
- Authoring `locked`
- Treating reservation/sale custom create pages as the default for a new resource
- Identity transforms, extra mappers, or new Core renderers to “make the layout work”
