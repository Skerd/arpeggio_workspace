#!/usr/bin/env node
/**
 * Local dev launcher: runs one vertical (profile) with its own Mongo database, Redis
 * logical DB, Kafka topic prefix and ports, on top of the shared `maestro/.env`.
 *
 * dotenv never overrides variables that are already set and Vite lets `process.env` win
 * over `.env` files, so exporting a profile's overrides is enough: neither maestro's env
 * loader nor the sinfonia config needs to know about profiles.
 *
 *   node scripts/dev/arpeggio.mjs up <profile> [--only api,websocket,kafka,cron,panel,public]
 *   node scripts/dev/arpeggio.mjs reset <profile> [--force]
 *   node scripts/dev/arpeggio.mjs list
 *
 * See scripts/dev/README.md.
 */

import {spawn, spawnSync} from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import readline from "node:readline/promises";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const profilesDir = path.join(repoRoot, "scripts/dev/profiles");
const maestroDir = path.join(repoRoot, "maestro");
const sinfoniaDir = path.join(repoRoot, "sinfonia");
const MONGO_ROUTER = "router-01";
/** Keys the launcher reads from a profile; they are not passed on to the processes. */
const LAUNCHER_KEYS = ["KAFKA_PREFIX", "PANEL_PORT", "PUBLIC_APP", "PUBLIC_PORT"];
/** The panel origin hard-coded in maestro/.env redirect URLs (OAuth, Stripe Connect). */
const DEFAULT_PANEL_ORIGIN = "http://localhost:5173";
/** Maestro role → entry file (the `<role>:development` npm scripts' targets). */
const MAESTRO_SERVERS = {api: "apiServer.ts", websocket: "webSocketServer.ts", kafka: "kafkaServer.ts", cron: "cronServer.ts"};
const MAESTRO_ROLES = Object.keys(MAESTRO_SERVERS);
const ALL_ROLES = [...MAESTRO_ROLES, "panel", "public"];

function parseEnvFile(file) {
    const values = {};
    for (const rawLine of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
        else value = value.replace(/\s+#.*$/, "");
        values[key] = value;
    }
    return values;
}

function listProfiles() {
    return fs.readdirSync(profilesDir).filter((f) => f.endsWith(".env")).map((f) => f.slice(0, -4)).sort();
}

function loadProfile(name) {
    const file = path.join(profilesDir, `${name}.env`);
    if (!name || !fs.existsSync(file)) {
        fail(`Unknown profile "${name ?? ""}". Known profiles: ${listProfiles().join(", ")}`);
    }
    const profile = parseEnvFile(file);
    // ENABLED_MODULES may be empty (= every module) but must be present to override maestro/.env.
    if (!("ENABLED_MODULES" in profile)) fail(`${file}: ENABLED_MODULES is required (empty = all modules).`);
    for (const key of ["MONGODB_DB_NAME", "SERVER_PORT", "WEBSOCKET_PORT", "PANEL_PORT"]) {
        if (!profile[key]) fail(`${file}: ${key} is required.`);
    }
    return {name, ...profile};
}

/** The maestro env overrides for a profile (everything except the launcher-only keys). */
function maestroOverrides(profile) {
    const base = parseEnvFile(path.join(maestroDir, ".env"));
    const panelOrigin = `http://localhost:${profile.PANEL_PORT}`;
    const env = {};

    // Same rule as solfeggio/deploy.sh `prefix_maestro_kafka_names`.
    if (profile.KAFKA_PREFIX) {
        const prefix = `${profile.KAFKA_PREFIX}-`;
        for (const [key, value] of Object.entries(base)) {
            if (/^KAFKA_(TOPIC|CONSUMER_GROUP)_/.test(key) && value && !value.startsWith(prefix)) {
                env[key] = prefix + value;
            }
        }
    }
    if (panelOrigin !== DEFAULT_PANEL_ORIGIN) {
        for (const [key, value] of Object.entries(base)) {
            if (value.startsWith(DEFAULT_PANEL_ORIGIN)) env[key] = panelOrigin + value.slice(DEFAULT_PANEL_ORIGIN.length);
        }
    }
    const clientUrls = [`core=${panelOrigin}`];
    // The portal answers on its zone's apex; links to a company's site put its slug in front of that host.
    const publicHost = (profile.PUBLIC_APP === "portal" && profile.PORTAL_ROOT_DOMAIN) || "localhost";
    if (profile.PUBLIC_APP && profile.PUBLIC_PORT) clientUrls.push(`${profile.PUBLIC_APP}=http://${publicHost}:${profile.PUBLIC_PORT}`);
    env.SINFONIA_CLIENT_URLS = clientUrls.join(",");
    // Dev sends no real email (TD-B192): turn it on with `EMAIL_ENABLED=true npm run dev -- up <profile>`, or with
    // EMAIL_ENABLED=true in the profile, which the loop below applies last.
    env.EMAIL_ENABLED = process.env.EMAIL_ENABLED === "true" ? "true" : "false";

    for (const [key, value] of Object.entries(profile)) {
        if (key !== "name" && !LAUNCHER_KEYS.includes(key)) env[key] = value;
    }
    return env;
}

function viteEnv(profile, appId) {
    return {
        NODE_ENV: "development",
        VITE_ENABLED_MODULES: profile.ENABLED_MODULES,
        VITE_SINFONIA_APP: appId,
        VITE_API_BASE_URL: `http://localhost:${profile.SERVER_PORT}`,
        VITE_WS_BASE_URL: `ws://localhost:${profile.WEBSOCKET_PORT}`,
        // Vite servers sharing one deps cache corrupt each other ("504 Outdated Optimize Dep").
        VITE_CACHE_DIR: `node_modules/.vite-${profile.name}-${appId}`,
        // The portal's session cookie spans its zone: the apex and every company site.
        ...(appId === "portal" ? {VITE_PORTAL_ROOT_DOMAIN: profile.PORTAL_ROOT_DOMAIN ?? ""} : {}),
    };
}

function processSpecs(profile) {
    const maestroEnv = maestroOverrides(profile);
    // Not `npm run <role>:development`: ts-node-dev's child busy-waits for each compile while
    // its request sits unsent in a full IPC pipe, so servers started together can hang forever
    // at 100% CPU. node --watch compiles in-process and still restarts on any required file.
    const specs = MAESTRO_ROLES.map((role) => ({
        role,
        cwd: maestroDir,
        command: "node",
        args: ["--watch", "-r", "ts-node/register/transpile-only", "-r", "tsconfig-paths/register", `xServers/${MAESTRO_SERVERS[role]}`],
        env: maestroEnv,
        port: {api: profile.SERVER_PORT, websocket: profile.WEBSOCKET_PORT}[role],
    }));
    specs.push({
        role: "panel",
        cwd: sinfoniaDir,
        command: "npx",
        args: ["vite", "--host", "--port", profile.PANEL_PORT, "--strictPort"],
        env: viteEnv(profile, "core"),
        port: profile.PANEL_PORT,
    });
    if (profile.PUBLIC_APP && profile.PUBLIC_PORT) {
        specs.push({
            role: "public",
            cwd: sinfoniaDir,
            command: "npx",
            args: ["vite", "--host", "--port", profile.PUBLIC_PORT, "--strictPort"],
            env: viteEnv(profile, profile.PUBLIC_APP),
            port: profile.PUBLIC_PORT,
        });
    }
    return specs;
}

function isPortFree(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => server.close(() => resolve(true)));
        server.listen(Number(port));
    });
}

const COLORS = [36, 33, 35, 32, 34, 31];

function pipeWithPrefix(stream, label, color, logFile) {
    const lines = readline.createInterface({input: stream});
    lines.on("line", (line) => {
        process.stdout.write(`\x1b[${color}m[${label}]\x1b[0m ${line}\n`);
        logFile.write(`${line}\n`);
    });
}

async function up(profile, onlyArg) {
    const only = onlyArg ? onlyArg.split(",").map((r) => r.trim()).filter(Boolean) : ALL_ROLES;
    const unknown = only.filter((r) => !ALL_ROLES.includes(r));
    if (unknown.length) fail(`Unknown role(s) ${unknown.join(", ")}. Roles: ${ALL_ROLES.join(", ")}`);

    const specs = processSpecs(profile).filter((s) => only.includes(s.role));
    for (const spec of specs) {
        if (spec.port && !(await isPortFree(spec.port))) {
            fail(`Port ${spec.port} (${profile.name}:${spec.role}) is already in use. Find it with: lsof -nP -iTCP:${spec.port} -sTCP:LISTEN`);
        }
    }

    const logDir = path.join(repoRoot, "logs/dev", profile.name);
    fs.mkdirSync(logDir, {recursive: true});
    console.log(describe(profile));
    console.log(`Logs: ${logDir}\n`);

    const children = [];
    let stopping = false;
    // Each child leads its own process group, so npm → ts-node-dev → node all get the signal.
    const signalAll = (signal) => {
        for (const child of children) {
            try { process.kill(-child.pid, signal); } catch { /* already gone */ }
        }
    };
    const stopAll = (code) => {
        if (stopping) return;
        stopping = true;
        signalAll("SIGTERM");
        // Some servers' shutdown hooks never finish; don't leave them orphaned.
        setTimeout(() => {
            signalAll("SIGKILL");
            process.exit(code);
        }, 5000);
    };
    process.on("SIGINT", () => stopAll(0));
    process.on("SIGTERM", () => stopAll(0));

    specs.forEach((spec, index) => {
        const label = `${profile.name}:${spec.role}`;
        const logFile = fs.createWriteStream(path.join(logDir, `${spec.role}.log`), {flags: "w"});
        const child = spawn(spec.command, spec.args, {
            cwd: spec.cwd,
            env: {...process.env, ...spec.env},
            stdio: ["ignore", "pipe", "pipe"],
            detached: true,
        });
        children.push(child);
        const color = COLORS[index % COLORS.length];
        pipeWithPrefix(child.stdout, label, color, logFile);
        pipeWithPrefix(child.stderr, label, color, logFile);
        child.on("exit", (code, signal) => {
            if (stopping) return;
            console.error(`\x1b[31m[${label}] exited (${signal ?? code}). Stopping ${profile.name}.\x1b[0m`);
            stopAll(1);
        });
    });
}

function mongosh(script, env) {
    const uri = `mongodb://localhost:27017/?tls=true&tlsCAFile=/certs/ca.crt.pem&tlsCertificateKeyFile=/certs/${MONGO_ROUTER}.pem`;
    const envArgs = Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
    const result = spawnSync("docker", ["exec", ...envArgs, MONGO_ROUTER, "mongosh", uri, "--quiet", "--eval", script], {
        encoding: "utf-8",
    });
    if (result.status !== 0) fail(`mongosh in ${MONGO_ROUTER} failed:\n${result.stderr || result.stdout}`);
    return result.stdout.trim();
}

/** Gives the shared maestro user readWrite on the profile database (as solfeggio/systemUp.sh does per instance). */
function provisionDatabase(env) {
    const authSource = /authSource=([^&]+)/.exec(env.MONGODB_PARAMS ?? "")?.[1] ?? env.MONGODB_AUTH_SOURCE ?? "admin";
    console.log(mongosh(`
        const users = db.getSiblingDB(process.env.AUTH_DB);
        const user = users.getUser(process.env.DB_USER);
        if (!user) {
            print("User " + process.env.DB_USER + " not found on " + process.env.AUTH_DB + "; skipping the grant.");
        } else if (user.roles.some((r) => r.db === process.env.TARGET_DB && r.role === "readWrite")) {
            print(process.env.DB_USER + " already has readWrite on " + process.env.TARGET_DB);
        } else {
            users.grantRolesToUser(process.env.DB_USER, [{role: "readWrite", db: process.env.TARGET_DB}]);
            print("Granted readWrite on " + process.env.TARGET_DB + " to " + process.env.DB_USER);
        }
        try { sh.enableSharding(process.env.TARGET_DB); } catch (e) { print("Sharding not enabled (may already be enabled): " + e); }
    `, {AUTH_DB: authSource, DB_USER: env.MONGODB_USER, TARGET_DB: env.MONGODB_DB_NAME}));
}

async function reset(profile, force) {
    const base = parseEnvFile(path.join(maestroDir, ".env"));
    const overrides = maestroOverrides(profile);
    const env = {...base, ...overrides};
    const dbName = env.MONGODB_DB_NAME;

    if (dbName === base.MONGODB_DB_NAME && !force) {
        fail(`${dbName} is the default database in maestro/.env. Pass --force to reset it anyway.`);
    }
    if (!(await isPortFree(profile.SERVER_PORT))) {
        fail(`${profile.name} is running (port ${profile.SERVER_PORT}). Stop it before resetting its database.`);
    }

    const rl = readline.createInterface({input: process.stdin, output: process.stdout});
    const typed = await rl.question(`This DROPS every collection in "${dbName}" and re-seeds it. Type the database name to continue: `);
    rl.close();
    if (typed.trim() !== dbName) fail("Name did not match; nothing was changed.");

    provisionDatabase(env);

    const result = spawnSync(
        "npx",
        ["ts-node", "--transpile-only", "-r", "tsconfig-paths/register", "scripts/resetDatabase.ts"],
        {
            cwd: maestroDir,
            stdio: "inherit",
            env: {...process.env, ...overrides, NODE_ENV: "development", MONGODB_INIT: "true", ARPEGGIO_RESET_DB: dbName},
        },
    );
    process.exit(result.status ?? 1);
}

function describe(profile) {
    const lines = [
        `\x1b[1m${profile.name}\x1b[0m  modules=${profile.ENABLED_MODULES || "(all)"}  db=${profile.MONGODB_DB_NAME}  redis=${profile.REDIS_DATABASE ?? "0"}  kafka=${profile.KAFKA_PREFIX ? `${profile.KAFKA_PREFIX}-*` : "(unprefixed)"}`,
        `  api http://localhost:${profile.SERVER_PORT}   ws ws://localhost:${profile.WEBSOCKET_PORT}`,
        `  panel http://localhost:${profile.PANEL_PORT}`,
    ];
    if (profile.PUBLIC_APP && profile.PUBLIC_PORT) lines.push(`  ${profile.PUBLIC_APP} http://localhost:${profile.PUBLIC_PORT}`);
    return lines.join("\n");
}

async function list() {
    for (const name of listProfiles()) {
        const profile = loadProfile(name);
        const running = !(await isPortFree(profile.SERVER_PORT));
        console.log(`${describe(profile)}\n  status: ${running ? "\x1b[32mrunning\x1b[0m" : "stopped"}\n`);
    }
}

function fail(message) {
    console.error(`\x1b[31m${message}\x1b[0m`);
    process.exit(1);
}

const [command, profileName, ...rest] = process.argv.slice(2);
const flag = (name) => {
    const index = rest.indexOf(name);
    return index === -1 ? undefined : (rest[index + 1] ?? "");
};

switch (command) {
    case "up":
        await up(loadProfile(profileName), flag("--only"));
        break;
    case "reset":
        await reset(loadProfile(profileName), rest.includes("--force"));
        break;
    case "list":
        await list();
        break;
    default:
        console.log("Usage: arpeggio.mjs up <profile> [--only api,websocket,kafka,cron,panel,public]\n" +
            "       arpeggio.mjs reset <profile> [--force]\n       arpeggio.mjs list\n" +
            `Profiles: ${listProfiles().join(", ")}`);
        process.exit(command ? 1 : 0);
}
