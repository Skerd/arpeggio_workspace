// DB-03 (D17): Mongoose model statics are called only in *.service.ts, plugins, seeds and demo data.
// A model is any identifier imported from a database/schemas path; actions, routes, hooks, utilities are scanned.
import path from "node:path";
import {ROOT, increment, read, rel, walk} from "./lib.mjs";

const OPS = "find|findOne|findById|findOneAndUpdate|findByIdAndUpdate|findOneAndDelete|findByIdAndDelete|updateOne|updateMany|deleteOne|deleteMany|create|insertMany|aggregate|countDocuments|estimatedDocumentCount|exists|distinct|bulkWrite|replaceOne";
const IMPORT_RE = /import\s+(?!type\b)([^'";]+?)\s+from\s*['"]([^'"]*database\/schemas[^'"]*)['"]/g;

const allowed = p =>
    p.endsWith(".service.ts") || /\/database\/(plugins|seeds|demo)\//.test(p) || p.endsWith(".defaults.ts") ||
    /\/_tests?\//.test(p) || (p.includes("/database/schemas/") && !p.endsWith(".actions.ts"));

function importedNames(clause) {
    const names = [];
    const named = /\{([^}]*)\}/.exec(clause);
    if (named) {
        for (const part of named[1].split(",")) {
            const t = part.trim().replace(/^type\s+/, "");
            if (!t || part.trim().startsWith("type ")) continue;
            names.push(t.split(/\s+as\s+/).pop().trim());
        }
    }
    const def = clause.replace(/\{[^}]*\}/, "").replace(/\*\s+as\s+\w+/, "").split(",")[0].trim();
    if (/^[A-Z]\w*$/.test(def)) names.push(def);
    return names.filter(n => /^[A-Z]/.test(n));
}

export function run() {
    const current = {};
    for (const file of walk(path.join(ROOT, "maestro/modules"), name => name.endsWith(".ts") && !name.endsWith(".d.ts"))) {
        const r = rel(file);
        if (allowed(r)) continue;
        const text = read(file);
        const names = new Set();
        for (const m of text.matchAll(IMPORT_RE)) importedNames(m[1]).forEach(n => names.add(n));
        if (!names.size) continue;
        const re = new RegExp(`\\b(?:${[...names].join("|")})\\s*\\.\\s*(?:${OPS})\\s*\\(`, "g");
        const n = (text.match(re) ?? []).length;
        if (n) increment(current, `${r} direct model calls`, n);
    }
    return {current};
}
