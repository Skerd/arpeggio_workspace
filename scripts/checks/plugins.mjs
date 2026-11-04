// DB-01 (D12): every model applies ownership, audit, softDelete and lifeCycle plugins. plugin-exemptions.json may skip a
// plugin only with the reason D12 ties to it: ownership ← no-tenant, softDelete ← ttl-expiry, audit ← machine-writes.
import path from "node:path";
import {ROOT, increment, read, rel, walk} from "./lib.mjs";

const PLUGINS = ["ownership", "audit", "softDelete", "lifeCycle"];
const REASON_FOR = {ownership: "no-tenant", softDelete: "ttl-expiry", audit: "machine-writes"};
// A model definition passes a schema as second argument; `mongoose.model(name)` lookups are ignored.
const MODEL_RE = /(?:mongoose\.model|(?<![\w.])model)\s*(?:<[^>]*>)?\s*\(\s*[^,()]+,/;

export function run() {
    const exemptions = JSON.parse(read(path.join(ROOT, "scripts/checks/plugin-exemptions.json")));
    const errors = [];
    for (const [file, entry] of Object.entries(exemptions)) {
        if (file.startsWith("_")) continue;
        for (const [plugin, reason] of Object.entries(entry.skip ?? {})) {
            if (REASON_FOR[plugin] !== reason) errors.push(`plugin-exemptions.json: ${file} skips ${plugin} with "${reason}"; only ${REASON_FOR[plugin] ? `"${REASON_FOR[plugin]}"` : "no reason"} can exempt ${plugin}`);
        }
    }

    const current = {};
    const files = walk(path.join(ROOT, "maestro/modules"), (name, p) => name.endsWith(".ts") && p.includes(`${path.sep}database${path.sep}schemas${path.sep}`) && !/_tests?/.test(p));
    for (const file of files) {
        const text = read(file);
        if (!MODEL_RE.test(text)) continue;
        const key = rel(file);
        const skip = new Set(Object.keys(exemptions[key]?.skip ?? {}));
        for (const plugin of PLUGINS) {
            const applied = new RegExp(`\\b${plugin}Plugin\\s*\\(|\\.plugin\\(\\s*${plugin}Plugin\\b`).test(text);
            if (!applied && !skip.has(plugin)) increment(current, `${key} missing ${plugin}Plugin`);
        }
    }
    return {current, errors};
}
