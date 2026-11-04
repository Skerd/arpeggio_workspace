// Shared helpers for the governance checks (docs/architecture/OPTIMIZATION_ROADMAP.md, P1).
// Checks are read-only. Existing debt is frozen in baselines/<check>.json so that only NEW violations fail;
// a count dropping below its baseline is reported so the baseline can be tightened with --update-baseline.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const rel = p => path.relative(ROOT, p).split(path.sep).join("/");
export const read = p => fs.readFileSync(p, "utf8");

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "_temp", "coverage", "logs"]);

export function walk(dir, accept) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) out.push(...walk(path.join(dir, entry.name), accept));
        } else if (accept(entry.name, path.join(dir, entry.name))) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
}

export const isSource = name => /\.(ts|tsx|mts|mjs)$/.test(name) && !name.endsWith(".d.ts");
export const isTestPath = p => /\/_tests?\//.test(p) || /\.test\.(ts|tsx)$/.test(p);

/** Manifest: today scripts/modules.manifest.json (D01a moves it into maestro core). */
export function loadManifest() {
    const manifest = JSON.parse(read(path.join(ROOT, "scripts/modules.manifest.json")));
    const deps = {};
    const resolve = (name, seen = new Set()) => {
        for (const dep of manifest[name]?.dependsOn ?? []) {
            if (!seen.has(dep)) {
                seen.add(dep);
                resolve(dep, seen);
            }
        }
        return seen;
    };
    for (const name of Object.keys(manifest)) deps[name] = resolve(name);
    return {modules: Object.keys(manifest), deps};
}

export const PACKAGES = {
    maestro: path.join(ROOT, "maestro/modules"),
    armonia: path.join(ROOT, "armonia/src/modules"),
    sinfonia: path.join(ROOT, "sinfonia/src/modules"),
};

/** Module that owns an absolute path, if it sits under one of the three module roots. */
export function moduleOf(absPath) {
    for (const root of Object.values(PACKAGES)) {
        const r = path.relative(root, absPath);
        if (!r.startsWith("..") && !path.isAbsolute(r)) return r.split(path.sep)[0];
    }
    return null;
}

const baselinePath = name => path.join(ROOT, "scripts/checks/baselines", `${name}.json`);

/**
 * Compare `current` ({key: count}) with the stored baseline.
 * Returns {failures: string[], improvements: string[]}.
 */
export function compareWithBaseline(name, current, {update}) {
    const file = baselinePath(name);
    const baseline = fs.existsSync(file) ? JSON.parse(read(file)) : {};
    const failures = [];
    const improvements = [];
    for (const [key, count] of Object.entries(current)) {
        const allowed = baseline[key] ?? 0;
        if (count > allowed) failures.push(allowed ? `${key}  (${count}, baseline ${allowed})` : `${key}  (${count}, new)`);
        else if (count < allowed) improvements.push(`${key}  (${count}, baseline ${allowed})`);
    }
    for (const key of Object.keys(baseline)) if (!(key in current)) improvements.push(`${key}  (0, baseline ${baseline[key]})`);
    if (update) {
        fs.mkdirSync(path.dirname(file), {recursive: true});
        const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
        fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + "\n");
    }
    return {failures, improvements};
}

export function increment(map, key, by = 1) {
    map[key] = (map[key] ?? 0) + by;
}
