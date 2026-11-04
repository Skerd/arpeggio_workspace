# Frontend rules (FE-*)

Scope: `sinfonia/**`. Stack: React + Vite (one app per build via `VITE_SINFONIA_APP`: `core` panel, `portal`,
`studio` (dev), PM `public`, `dyeus`), react-router-dom v7, Redux, react-hook-form 7 + zod 4, shadcn on Tailwind v4,
vitest + Testing Library. Forms and sheets: [viewconfig.md](viewconfig.md).

---

### FE-01 · MUST · Mount panel UI through contributions
- **Rule:**
  - Feature UI mounts only through `src/modules/<m>/clients/panel/<kind>Contribution.tsx`. The loaders live in `src/modules/core/helpers/moduleContributions/` and use eager globs, filtered by company modules. For route contributions, the first non-`undefined` result wins.
  - Never edit core `clients/panel/entryPoint/routeConfig.tsx` or the core sidebar.
  - Portal sites plug in via `clients/portal/portalContribution.tsx`. Public/dyeus apps are self-contained and never use panel contributions.
- **Why:** verified; CORE-06. **Enforce:** review.

### FE-02 · MUST · Pages use the core page factories
- **Rule:**
  - Lists use `EntityListPage` (`src/modules/core/components/entityPage/pages/entityListPage.tsx`). Forms use `createGenericCreatePage` / `createGenericEditPage`.
  - When a factory doesn't fit, compose exported core parts or propose a seam (CORE-03). Never write a one-off page that reimplements submit, access or ViewConfig.
  - **Verified exceptions, not templates:** reservation create (custom `FormViewRenderer`), `createCashSale.tsx` / `createPaymentPlanSale.tsx`.
  - Debt: `core/.../roles/{createRole,editRole}.tsx`, swissOutreach `campaigns`/`prospects`/`createCampaign`, eCommerce `{categories,listingCategories}/{create,edit}Category.tsx`.
- **Why:** existing sinfonia rule; D04, D31. **Enforce:** review.

### FE-03 · MUST · API calls
- **Rule:**
  - Components call the API through the `withAxios` HOC. Where a HOC doesn't fit (custom hooks), use `useHttpRequest`. Direct `apiClient` (`src/modules/core/helpers/apiClient/apiClient.ts`) only inside core helpers/hooks.
  - **MUST NOT:** add another axios instance or raw `fetch`. The only allowed exceptions are `core/helpers/media/fetchMediaBytes.ts`, `clients/studio/source/sourceClient.ts` (dev) and `publicChatClient.ts` (pending review).
  - Session expiry is handled by `apiClient` dispatching `markSessionExpired`. Never `window.location` on 401/403.
- **Current state:** 138 files call `apiClient` directly (44 inside `useEffect`). This is debt, fixed under AGT-06 scope.
- **Why:** D09. **Enforce:** lint restricted-imports (axios) ★ + review.

### FE-04 · MUST · Access gating
- **Rule:** Gate UI with `useAccess` (`src/modules/core/helpers/context/accessContext.tsx`). Missing create shows the existing `Forbidden` pattern. Don't re-check the same flag later.
- **Why:** verified (534 files).

### FE-05 · MUST · Redux allowlist and refresh
- **Rule:** Redux slices (`src/modules/core/helpers/redux/store/generalStore.ts`) are limited to session, language, notifications, chat, UI chrome and server health (`serverResources`).
- **MUST NOT:** keep entity data or "please refetch" counters in Redux. Refresh lists via `EntityListRefs` (`replaceRow`/refresh) or `tableUpdateContext`, or a websocket event for cross-tab changes.
- Debt: `uiSlice` `newCompanyCreated`, `newUserCreated`, `editUser`.
- **Why:** D46. **Enforce:** review.

### FE-06 · MUST · Lazy pages
- **Rule:** Every panel page is loaded with `React.lazy` from its route contribution, with one Suspense boundary in the core shell. The contribution files themselves stay eagerly globbed.
- **Current state:** route contributions statically import every page (eCommerce 112, propertyDevelopment 136, propertyManagement 81, carRental 58), so the whole panel ships as one chunk. New pages are lazy now; conversion of existing ones is P4.
- **Why:** D21. **Enforce:** review.

### FE-07 · MUST · One UI primitive layer
- **Rule:**
  - `src/modules/core/components/ui` (shadcn, `components.json`) is the only primitive layer. animate-ui is used only wrapped inside a `components/ui` primitive; features never import it directly.
  - **MUST NOT:** raw interactive HTML in feature code (`<button>`, `<select>`, `<table>`, `<input>`).
  - Icons: tabler only, plus simple-icons for brand logos. Toasts via `ui/sonner` in every app.
- **Current state:** duplicate Tooltip/Button/Select, raw `<button>` in 153 files, 4 extra icon libraries (debt).
- **Why:** D22. **Enforce:** lint `no-restricted-imports`/`no-restricted-syntax` ★.

### FE-08 · MUST · Translations
- **Rule:**
  - `withLanguage("src/modules/<pkg>/<path>.tsx")` resolves `src/modules/<pkg>/assets/languages/<locale>/<path>.json`. The literal must equal the file's own path (guard test `core/helpers/hocs/_tests/withLanguagePaths.test.ts`) unless whitelisted in `SHARED_DICTIONARIES`.
  - Every new key is written with real translations in all **5** locales (en-US, de-CH, fr-FR, it-IT, sq-AL) in the same change. de-CH uses Swiss conventions (ß→ss). No English placeholders. en-US is the reference.
  - Exception keys (BE-07) follow the same rule.
  - Moving a component means moving its JSON in 5 locales and its literal. Prefer flattening over relocating.
- **Current state:** swissOutreach `fr-CH`/`it-CH` folders never match (debt), and missing dictionaries render `---key---` silently.
- **Why:** D30; memory sinfonia-i18n-path-coupling. **Enforce:** guard test + check `i18n` (dictionary existence and key parity across 5 locales, baselined).

### FE-09 · MUST · Accessibility
- **Rule:** Public apps (portal shop/clinic/rental, PM public, dyeus) meet WCAG 2.2 AA. The panel meets a baseline: keyboard-operable, labelled controls, visible focus. The jsx-a11y recommended set is `error` in all apps (today 6 rules at `warn`).
- **Why:** D23. **Enforce:** sinfonia ESLint ★ + review.

### FE-10 · MUST · Forms
- **Rule:** react-hook-form + `zodResolver` with the **Armonia** schema factory. Never a client-only Zod schema (BE-06). Forms render from ViewConfig whenever a `*.views.ts` exists ([viewconfig.md](viewconfig.md)).
- **Why:** existing rules; D11.
