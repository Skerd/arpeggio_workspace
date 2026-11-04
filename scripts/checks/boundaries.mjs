// CORE-01 / CORE-02 (D02, D03): imports cross modules only along manifest dependsOn edges; core names no vertical.
import path from "node:path";
import {PACKAGES, increment, isSource, loadManifest, moduleOf, read, rel, walk} from "./lib.mjs";

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;
const MODULE_ENABLED_RE = /isModuleEnabled\(\s*['"]([A-Za-z]+)['"]/g;

export function run() {
    const {modules, deps} = loadManifest();
    const known = new Set(modules);

    const targetOf = (spec, fileDir) => {
        if (spec.startsWith(".")) return moduleOf(path.resolve(fileDir, spec));
        const alias = /^@([A-Za-z]+)\//.exec(spec);
        if (alias) {
            const name = alias[1].replace(/Module$/, "");
            return known.has(name) ? name : null;
        }
        const armonia = /^armonia\/src\/modules\/([A-Za-z]+)\//.exec(spec);
        return armonia && known.has(armonia[1]) ? armonia[1] : null;
    };

    const current = {};
    for (const root of Object.values(PACKAGES)) {
        for (const file of walk(root, isSource)) {
            const source = moduleOf(file);
            if (!known.has(source)) continue;
            const text = read(file);
            const dir = path.dirname(file);
            for (const m of text.matchAll(IMPORT_RE)) {
                const target = targetOf(m[1] ?? m[2] ?? m[3] ?? m[4], dir);
                if (!target || target === source) continue;
                const allowed = source === "core" ? false : target === "core" || deps[source].has(target);
                if (!allowed) increment(current, `${rel(file)} -> ${target}`);
            }
            if (source === "core") {
                for (const m of text.matchAll(MODULE_ENABLED_RE)) {
                    if (m[1] !== "core" && known.has(m[1])) increment(current, `${rel(file)} names vertical "${m[1]}"`);
                }
            }
        }
    }
    return {current};
}
