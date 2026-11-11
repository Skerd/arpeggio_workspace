#!/usr/bin/env node
// Root `npm run verify` (D08, GLB-11): the governance checks, lint, the three test suites and the three typechecks.
// They are independent, so they run side by side (at most VERIFY_JOBS at once, longest first) instead of one after
// another. Each step's output is kept in a log file; a step's summary lines are printed when it ends, and its whole
// output when it fails. Exits non-zero if any step fails.
//
// `npm run verify -- --changed` (D135) scopes the run to the uncommitted changes of the 25 repos: the governance checks
// and lint always, the typecheck of each touched package, and the tests of each touched module plus the modules that
// import it. A change to armonia, a `core` folder, locale or static files, the checks and baselines, a package's
// dependencies or test/typecheck/lint scripts, or any file outside a module falls back to the full run. Add `--plan` to
// print the steps without running them.
import {spawn, spawnSync} from "node:child_process";
import {existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Longest first, so the slowest step never starts last. Each is a root package.json script.
const FULL_STEPS = ["test:maestro", "typecheck:maestro", "test:sinfonia", "lint", "typecheck:sinfonia", "test:armonia", "typecheck:armonia", "check"];

// ── --changed: which steps the uncommitted changes need ─────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", "graphify-out"]);
/** Where each package keeps its modules, as seen from the workspace root. */
const MODULE_ROOTS = {maestro: "maestro/modules", sinfonia: "sinfonia/src/modules"};
/**
 * Changes no step exercises: prose, OS litter, the status tracker, editor and agent rules, git and push helpers, and the
 * deploy files (the deploy image runs its own typecheck and tests, D08).
 */
const IGNORED = [
    /\.(md|mdc)$/, /(^|\/)\.DS_Store$/, /(^|\/)__pycache__\//, /(^|\/)\.gitignore$/,
    /^docs\//, /^scripts\/status\//, /^\.cursor\//, /^\.claude\//, /^pushAll\.sh$/, /^solfeggio\//,
];
/** Changes whose reach a module-scoped run cannot bound. */
const FULL_RUN = [
    [/^armonia\//, "armonia is shared by every package"],
    [/\/modules\/core\//, "core is used by every module"],
    [/\/assets\/languages\/|\/helpers\/static\//, "locale and static files are read across modules and by the i18n check"],
    [/^scripts\/(checks\/|verify\.mjs)/, "the checks, baselines or verify itself changed"],
    [/(^|\/)package-lock\.json$|(^|\/)tsconfig[^/]*\.json$|(^|\/)(vite|vitest)\.config\.|(^|\/)eslint\.config\./, "a build, test or lint configuration changed"],
];
/** package.json fields that change what the steps run against; a change to any other script (a dev profile) does not. */
const PACKAGE_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "overrides", "type"];
const PACKAGE_SCRIPTS = ["test", "typecheck", "lint"];

/** Every git repo of the workspace: the root, the four packages and the module repos nested in them. */
function findRepos(dir = ROOT, depth = 0, found = []) {
    if (existsSync(path.join(dir, ".git"))) found.push(dir);
    if (depth >= 6) return found;
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) findRepos(path.join(dir, entry.name), depth + 1, found);
    }
    return found;
}

/** Uncommitted (staged, unstaged and untracked) files of every repo, as paths from the workspace root. */
function changedFiles() {
    const files = [];
    for (const repo of findRepos()) {
        const status = spawnSync("git", ["-C", repo, "status", "--porcelain=v1", "-uall"], {encoding: "utf8"});
        for (const line of status.stdout.split("\n").filter(Boolean)) {
            const file = line.slice(3).split(" -> ").pop().replace(/^"|"$/g, "");
            // A nested repo shows in its parent as one untracked folder; its own status lists its files.
            if (existsSync(path.join(repo, file, ".git"))) continue;
            files.push(path.relative(ROOT, path.join(repo, file)));
        }
    }
    return [...new Set(files)];
}

/** Whether a changed package.json changes what the steps run against (compared with its committed version). */
function packageJsonMatters(file) {
    const repoDir = path.dirname(path.join(ROOT, file));
    const committed = spawnSync("git", ["-C", repoDir, "show", "HEAD:./package.json"], {encoding: "utf8"});
    if (committed.status !== 0) return true;
    const before = JSON.parse(committed.stdout);
    const after = JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));
    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    return PACKAGE_FIELDS.some((field) => !same(before[field], after[field]))
        || PACKAGE_SCRIPTS.some((script) => !same(before.scripts?.[script], after.scripts?.[script]));
}

/** Files under `dir` (recursively) whose text matches `pattern`. */
function anyFileMatches(dir, pattern) {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name) && anyFileMatches(full, pattern)) return true;
        } else if (/\.(ts|tsx)$/.test(entry.name) && pattern.test(readFileSync(full, "utf8"))) {
            return true;
        }
    }
    return false;
}

/** The touched modules plus every module of the same package that imports one of them (`@<module>[Module]/…`). */
function withDependents(pkg, modules) {
    const root = path.join(ROOT, MODULE_ROOTS[pkg]);
    const all = readdirSync(root, {withFileTypes: true}).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const result = new Set(modules);
    for (const changed of modules) {
        const imports = new RegExp(`@${changed}(Module)?/|modules/${changed}/`);
        for (const other of all) {
            if (!result.has(other) && other !== "core" && anyFileMatches(path.join(root, other), imports)) result.add(other);
        }
    }
    return [...result].sort();
}

/** The steps for the uncommitted changes, or the full list with the reason a scoped run cannot be trusted. */
function planChanged() {
    const files = changedFiles().filter((file) => !IGNORED.some((pattern) => pattern.test(file)));
    const touched = {maestro: new Set(), sinfonia: new Set()};
    for (const file of files) {
        if (/(^|\/)package\.json$/.test(file)) {
            if (packageJsonMatters(file)) return {steps: FULL_STEPS, note: `full run: ${file} changes dependencies or a test/typecheck/lint script`};
            continue;
        }
        const full = FULL_RUN.find(([pattern]) => pattern.test(file));
        if (full) return {steps: FULL_STEPS, note: `full run: ${file} (${full[1]})`};
        const pkg = Object.keys(MODULE_ROOTS).find((name) => file.startsWith(`${MODULE_ROOTS[name]}/`));
        if (!pkg) return {steps: FULL_STEPS, note: `full run: ${file} is outside a module`};
        touched[pkg].add(file.slice(MODULE_ROOTS[pkg].length + 1).split("/")[0]);
    }
    const steps = ["check", "lint"];
    const scope = [];
    for (const pkg of Object.keys(MODULE_ROOTS)) {
        if (touched[pkg].size === 0) continue;
        const modules = withDependents(pkg, [...touched[pkg]]);
        const dirs = modules.map((module) => path.relative(path.join(ROOT, pkg), path.join(ROOT, MODULE_ROOTS[pkg], module)));
        steps.unshift({name: `test:${pkg}[${modules.join(",")}]`, cmd: "npx", args: ["vitest", "run", ...dirs], cwd: path.join(ROOT, pkg)});
        steps.splice(1, 0, `typecheck:${pkg}`);
        scope.push(`${pkg}: ${[...touched[pkg]].join(", ")}${modules.length > touched[pkg].size ? ` (+ importers: ${modules.filter((m) => !touched[pkg].has(m)).join(", ")})` : ""}`);
    }
    return {steps, note: scope.length === 0 ? "no module code changed: governance checks and lint only" : `scoped to ${files.length} changed file(s); ${scope.join("; ")}`};
}

const changedMode = process.argv.includes("--changed");
const plan = changedMode ? planChanged() : {steps: FULL_STEPS};
const STEPS = plan.steps;
if (plan.note) console.log(`verify --changed: ${plan.note}\n`);
// `--plan`: print the steps and stop.
if (process.argv.includes("--plan")) {
    for (const step of STEPS) console.log(`  ${typeof step === "string" ? step : `${step.name}: ${step.cmd} ${step.args.join(" ")}`}`);
    process.exit(0);
}
// Four at once keeps the maestro suite's own workers and the typecheckers from starving each other.
const JOBS = Number(process.env.VERIFY_JOBS) || 4;
// Lines worth showing for a passing step: test counts, check results, lint totals.
const SUMMARY = /Test Files|^\s*Tests\s|✔|✖|baselined|NEW|error TS|errors?\b.*\bbaselined/;

const logDir = mkdtempSync(path.join(os.tmpdir(), "arpeggio-verify-"));
const startedAt = Date.now();
const seconds = (since) => `${Math.round((Date.now() - since) / 1000)}s`;

/** Runs one step (a root script name, or `{name, cmd, args, cwd}`) to completion; resolves with its exit code and output. */
function run(spec) {
    const step = typeof spec === "string" ? spec : spec.name;
    const [cmd, args, cwd] = typeof spec === "string" ? ["npm", ["run", "--silent", spec], ROOT] : [spec.cmd, spec.args, spec.cwd];
    return new Promise((resolve) => {
        const began = Date.now();
        const child = spawn(cmd, args, {cwd, env: {...process.env, FORCE_COLOR: "0"}});
        let output = "";
        child.stdout.on("data", (chunk) => (output += chunk));
        child.stderr.on("data", (chunk) => (output += chunk));
        child.on("close", (code) => {
            const log = path.join(logDir, `${step.replace(/[^\w.-]+/g, "-")}.log`);
            writeFileSync(log, output);
            resolve({step, code: code ?? 1, output, log, took: seconds(began)});
        });
    });
}

const results = [];
const queue = [...STEPS];
async function worker() {
    while (queue.length > 0) {
        const result = await run(queue.shift());
        results.push(result);
        const ok = result.code === 0;
        console.log(`${ok ? "✔" : "✖"} ${result.step} (${result.took})`);
        // Vitest colours its summary even with FORCE_COLOR=0; strip the codes so `Tests  N passed` matches and reads cleanly.
        const lines = result.output.replace(/\x1b\[[0-9;]*m/g, "").split("\n");
        const shown = ok ? lines.filter((line) => SUMMARY.test(line)).slice(-12) : lines.slice(-80);
        for (const line of shown) console.log(`    ${line}`);
    }
}
await Promise.all(Array.from({length: Math.min(JOBS, STEPS.length)}, worker));

const failed = results.filter((result) => result.code !== 0);
console.log(`\nverify${changedMode ? " --changed" : ""}: ${results.length - failed.length}/${results.length} steps passed in ${seconds(startedAt)}; logs in ${logDir}`);
if (failed.length > 0) {
    console.log(`failed: ${failed.map((result) => result.step).join(", ")}`);
    process.exit(1);
}
