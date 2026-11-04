---
name: verify
description: How to live-verify Arpeggio (maestro API + sinfonia panel) changes in this dev environment
---

# Verifying Arpeggio changes live

## Environment (usually already running)
- maestro API: `http://localhost:81` (ts-node-dev, hot-reloads on save — wait ~3s after edits; a request during respawn can 400/hang once)
- sinfonia PANEL app: `http://localhost:5173` (vite; the PUBLIC marketing app is a separate `npm run publicDev` build and is usually NOT running)
- Dev profiles (`npm run dev -- up <profile>`, see `scripts/dev/README.md`) each use their own DB, Redis DB, Kafka prefix and API port (81/91/101/111/121). Check which profile is running before assuming port 81 or a DB name.
- Mongo: sharded, TLS, router on `localhost:27117`; the DB name comes from the active profile / `MONGODB_PARAMS` in `maestro/.env` (authSource `xCloud-Pronix`); creds in `maestro/.env`. `docker exec router-01 mongosh` does NOT work (TLS certs are host-side). Use the node driver from `maestro/` (has mongodb dep):
  `tlsCAFile: solfeggio/clusters/mongo/certs/ca.crt.pem`, `tlsCertificateKeyFile: .../router-01.pem`, `tlsAllowInvalidHostnames: true`
- Start manually if down: `cd maestro && npm run api:development`; `cd sinfonia && npm run coreDev`

## Auth for API calls
Every request needs `x-device-id` header. Login: `POST /api/user/login` with `{username,password}` + `Origin: http://localhost:5173`; then send `x-auth-token` + `x-company-id`. Demo user `echo@echo.com` / `echo` (seed password from `maestro/modules/core/database/schemas/user/user.defaults.ts`) logs in directly on a freshly seeded DB. Company ids change on every reseed — look them up with `Company.find()` instead of hard-coding. Swapping a bcrypt hash is a destructive dev-data operation: **ask first** (AGT-07), back up the old hash and restore it after.

## Conventions
- Create: `PUT /api/realEstate/<resource>`; edit: `PATCH` with `_id` in body; actions: `POST /api/realEstate/<resource>/<action>` with `{_id}`; selects: `POST /<resource>/select` with `{page,limit}`.
- Public marketing APIs need only `x-device-id` + `Origin` (company resolved from origin).
- Demo record ids (projects, currencies) change on reseed — query them by name rather than hard-coding.
- authMW loads `company` with select `"allowedDomains name isActive"` — PM workflow flags live on `PropertyManagementConfig` (not Company); use `propertyManagementConfigService.getSettingsForCompany`.
- AI assistant tools live only in `assistantServer` (usually not running); test registration via `registerAllAssistantTools()` under ts-node.
- Clean up: delete test docs directly in Mongo by the distinctive titles you created.
- Governance: verify every touched layer (TST-07) — API request + DB effect, and a browser click-through incl. empty/error/permission-denied states; otherwise report "NOT live-verified". `reset` of a profile and bulk deletes need approval (AGT-07). See `docs/architecture/DEVELOPMENT_WORKFLOW.md`.
