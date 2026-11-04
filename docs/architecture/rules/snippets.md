<!-- Rule set SNP-* · canonical · scope: **/*.snippets.ts, armonia dto, mappers · decisions: D34, D39 -->
> Rule IDs: this whole file is **SNP-01**. Addition: **SNP-02 · MUST NOT** put a field tagged `sensitivity` (SEC-06, D39) in any snippet.


# Snippets (populated refs)

Armonia owns the **wire type** under `dto/`. Maestro owns the **allowlist** under `database/schemas/` and checks it against the Mongoose document (`I*`). Never derive the wire type from the full resource DTO (`State`), never put `defineSnippet` or snippet consts in Armonia, and never place Armonia wire types under `database/schemas/` or `database/types/` (those paths leak schema layout).

Canonical: `armonia/…/dto/state.dto.ts` + `maestro/…/database/schemas/state/state.snippets.ts` + `mapSnippet` in `maestro/modules/core/utilities/mappers/common.mapper.ts`. Helpers: `maestro/modules/core/database/utilities/snippet.ts`.

## Armonia — type only

```typescript
// armonia/src/modules/core/dto/state.dto.ts
export type StateSimple = {
    _id: string;
    name: string;
    code?: string;
};
```

- Path: `armonia/src/modules/<mod>/dto/<entity>.dto.ts` (flat; not under `database/`).
- Prefer `*Simple` / `*Blank` names for projections (`StateSimple`, `CurrencySimple`, `SimpleBlankUser`). Resource DTOs stay under `api/…/*.dto.ts`.
- Hand-write JSON shapes (`string` ids, ISO dates). Do not `Pick` the resource DTO and do not import Maestro/`I*`.
- Resource DTOs and shared plugin fields (`createdBy` / `deletedBy`) reference these types. Never inline a parallel `{_id, name}` object when a snippet wire type exists.

## Maestro — schema-checked allowlist

```typescript
export const StateSimpleSnippet = defineSnippet<IState, StateSimple>()({
    keys: {_id: {}, name: {}, code: {}},
});
```

- Always `defineSnippet<IEntity, WireType>()` so keys must exist on the document **and** match the Armonia wire type (including nested `keys` / nested snippet consts on the entity side). A mismatch is a compile-time `[Snippet type error]` (missing/extra/`invalidKeys`) — not a Node runtime throw (types are erased).
- Use `import type` for `I*` when the schema file imports this snippets file (avoids cycles).
- `refAllowlist: StateSimpleSnippet` on ObjectId refs. Never a one-off inline `{keys:…}` when a shared snippet exists.
- Nested `{keys}` and arrays are element projections; leaf `{}` is the stored value (ObjectId → hex string via `mapSnippet`).
- Do not add a separate `SnippetKeysMatchWire` assert — that check is inside `defineSnippet`.

## Mapping

- Always project with `mapSnippet<WireType>()(doc, SnippetConst)`. Never hand-map the same keys the snippet already lists.
- Prefer `mapSnippet` over ad-hoc `{_id, name}` when a snippet exists for that entity.
