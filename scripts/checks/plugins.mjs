// DB-01 (D12): every model applies ownership, audit, softDelete and lifeCycle plugins. plugin-exemptions.json may skip a
// plugin only with a reason D12 ties to it: ownership ← no-tenant, softDelete ← ttl-expiry, idempotency-claim (D69) or
// by-design-hard-delete (D73),
// audit ← machine-writes.
import path from "node:path";
import {ROOT, increment, read, rel, walk} from "./lib.mjs";

const PLUGINS = ["ownership", "audit", "softDelete", "lifeCycle"];
const REASONS_FOR = {ownership: ["no-tenant"], softDelete: ["ttl-expiry", "idempotency-claim", "by-design-hard-delete"], audit: ["machine-writes"]};
// A model definition passes a schema as second argument; `mongoose.model(name)` lookups are ignored. Every definition in
// a file is checked against its own schema variable, so a second model in the file cannot borrow the first one's plugins.
const MODEL_RE = /(?:mongoose\.model|(?<![\w.])model)\s*(?:<[^>]*>)?\s*\(\s*(["'])(\w+)\1\s*,\s*(\w+)/g;

export function run() {
    const exemptions = JSON.parse(read(path.join(ROOT, "scripts/checks/plugin-exemptions.json")));
    const errors = [];
    for (const [file, entry] of Object.entries(exemptions)) {
        if (file.startsWith("_")) continue;
        for (const [plugin, reason] of Object.entries(entry.skip ?? {})) {
            const allowed = REASONS_FOR[plugin] ?? [];
            if (!allowed.includes(reason)) errors.push(`plugin-exemptions.json: ${file} skips ${plugin} with "${reason}"; only ${allowed.length ? allowed.map((r) => `"${r}"`).join(" or ") : "no reason"} can exempt ${plugin}`);
        }
    }

    const current = {};
    const files = walk(path.join(ROOT, "maestro/modules"), (name, p) => name.endsWith(".ts") && p.includes(`${path.sep}database${path.sep}schemas${path.sep}`) && !/_tests?/.test(p));
    for (const file of files) {
        const text = read(file);
        const models = [...text.matchAll(MODEL_RE)].map((match) => ({name: match[2], schema: match[3]}));
        const fileKey = rel(file);
        for (const {name, schema} of models) {
            // A file with several models names each one: `<file>#<Model>` in the exemptions and the baseline.
            const key = models.length > 1 ? `${fileKey}#${name}` : fileKey;
            const skip = new Set(Object.keys(exemptions[key]?.skip ?? {}));
            for (const plugin of PLUGINS) {
                const applied = new RegExp(`\\b${plugin}Plugin\\s*\\(\\s*${schema}\\b|\\b${schema}\\s*\\.plugin\\(\\s*${plugin}Plugin\\b`).test(text);
                if (!applied && !skip.has(plugin)) increment(current, `${key} missing ${plugin}Plugin`);
            }
        }
    }
    return {current, errors};
}
