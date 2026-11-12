# Local dev profiles

Run one vertical (car rental, dental clinic, eCommerce, property management) with all of its features. Each profile gets its own MongoDB database, Redis logical DB, Kafka topics and ports, so several can run side by side. It works the same way as a Solfeggio instance, but runs maestro under `node --watch` + ts-node (not ts-node-dev, which can deadlock when several servers start together) and Vite, both with hot reload.

```bash
npm run dev -- list                       # profiles, ports, which are running
npm run dev -- reset carRental            # once: create + seed its database (asks you to type the DB name)
npm run dev:carRental                     # = npm run dev -- up carRental
npm run dev -- up dentalClinic --only api,panel   # just some processes
```

Every profile also has npm scripts:

| where | scripts | what runs |
|---|---|---|
| repo root | `dev:<profile>`, `reset:<profile>`, `dev:list` | everything / reset / list |
| `maestro/` | `dev:<profile>`, `reset:<profile>` | backend only (`--only api,websocket,kafka,cron`) |
| `sinfonia/` | `dev:<profile>` | frontend only (`--only panel,public`) |

The maestro and sinfonia halves of one profile can run in separate terminals, e.g. `npm run dev:carRental` in `maestro/` and again in `sinfonia/`.

`up` starts maestro `api`, `websocket`, `kafka` and `cron`, plus two Vite servers: the panel and the profile's public app.
- Every line is prefixed with `[profile:role]`.
- Each process also writes to `logs/dev/<profile>/<role>.log`.
- Ctrl-C stops them all.

| profile | modules | database | Redis DB | Kafka prefix | API / WS | panel | public app |
|---|---|---|---|---|---|---|---|
| ecommerce | core, eCommerce, marketplace | xCloud-eCommerce | 0 | — | 81 / 82 | 5173 | portal `ecommerce.localhost:5174` |
| carRental | core, carRental | xCloud-carRental | 2 | `carRental-` | 91 / 92 | 5181 | portal `carrental.localhost:5182` |
| dentalClinic | core, dentalClinic | xCloud-dentalClinic | 3 | `dentalClinic-` | 101 / 102 | 5191 | portal `dentalclinic.localhost:5192` |
| propertyManagement | core, propertyManagement, propertyDevelopment | xCloud-propertyManagement | 4 | `propertyManagement-` | 111 / 112 | 5201 | public :5202 |
| marketplace | core, marketplace | xCloud-marketplace | 6 | `marketplace-` | 131 / 132 | 5221 | portal `marketplace.localhost:5222` |
| all | every module (`ENABLED_MODULES=` empty) | xCloud-all | 5 | `all-` | 121 / 122 | 5211 | portal `portal.localhost:5212` |

`dependsOn` modules (e.g. finance) are added automatically. Log in to any panel as `echo@echo.com` / `echo`.

`all` runs every module on one database, the way a single production instance does. The modules a company sees come from `Company.modules`, which only admins of the platform-owner company change. The seed creates nine companies: **Platform** (owner, core only, protected), **Arpeggio Services** (the services marketplace's operator, protected, sells nothing, keeps the shared service categories; D143, D144), **Adria Home Fix** (on-site home services around Durrës and Tirana, `fix`) and one demo company per vertical: eCommerce (site slug `store`), the services marketplace (Tirana Pros, `pros`), Dental Clinic (`clinic`), Car Rental (`rental`), Estates (PM + PD, `estates`) and Alpine Reach (swissOutreach, `reach`). Each vertical's demo data lands only in its own company, and `echo@echo.com` is admin of all nine. The public app is the portal, the only public app of every profile. Its apex `http://portal.localhost:5212` (`PORTAL_ROOT_DOMAIN=portal.localhost`) lists every company that opted in, with their pages under `/shop`, `/services`, `/car-rental/<slug>`, `/dentists/<slug>` and `/properties/<slug>`; each company's own site is `http://<slug>.portal.localhost:5212` (e.g. `/dentists/book` on `clinic.portal.localhost`). One sign-in covers the apex and every company site.

The dyeus app (`npm run dyeus` in `sinfonia/`) is not a launcher role. Serve it on an Estates host, e.g. `http://estates.localhost:5214`: on plain `localhost` the host resolves to another company, and the residences read fails with `module_not_enabled`.

## How it works

`profiles/<name>.env` holds only what differs from `maestro/.env`. The launcher exports those values on top of the shared file. dotenv never overrides a variable that is already set, and Vite lets `process.env` win over `.env` files, so maestro and sinfonia need no profile logic of their own.

The launcher also derives some values:
- **Kafka:** every `KAFKA_TOPIC_*` / `KAFKA_CONSUMER_GROUP_*` in `maestro/.env` gets `<KAFKA_PREFIX>-`. This is the same rule as `solfeggio/deploy.sh`. Consumers create missing topics on start.
- **URLs:** values in `maestro/.env` that start with `http://localhost:5173` (OAuth and Stripe Connect redirects) are moved to the profile's panel port. `SINFONIA_CLIENT_URLS` becomes `core=<panel>,<app>=<public>` unless the profile sets it.
- **Vite:**
  - `VITE_ENABLED_MODULES`, `VITE_SINFONIA_APP`;
  - `VITE_API_BASE_URL` / `VITE_WS_BASE_URL`, which point at the profile's API;
  - a private `VITE_CACHE_DIR`, because dev servers that share `node_modules/.vite` corrupt each other.

Launcher-only keys: `KAFKA_PREFIX`, `PANEL_PORT`, `PUBLIC_APP`, `PUBLIC_PORT`.

## reset

`reset <profile>`:
1. Gives the maestro Mongo user `readWrite` on the profile database (like `solfeggio/systemUp.sh`).
2. Runs `maestro/scripts/resetDatabase.ts`, which **drops every collection** and re-seeds through the normal init chain: roles, users, company, and each enabled module's `database/companyDemoSeed.ts`.

It refuses while the profile's API is running, and it refuses the default database in `maestro/.env` unless you pass `--force`. Never put `MONGODB_INIT=true` in a profile, because every server would drop the database on start.

## Adding a profile

1. Copy a file in `profiles/`.
2. Pick an unused database name, Redis DB (0-15), Kafka prefix and ports.
3. Optionally add a `dev:<name>` script to the root `package.json`.
4. Run `npm run dev -- reset <name>`.
