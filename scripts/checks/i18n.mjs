// FE-08 / BE-07 (D30): every withLanguage dictionary and every exception key exists in all 5 locales;
// no locale folder outside the 5. en-US is the reference.
import fs from "node:fs";
import path from "node:path";
import {ROOT, increment, isSource, read, rel, walk} from "./lib.mjs";

const LOCALES = ["en-US", "de-CH", "fr-FR", "it-IT", "sq-AL"];
const WITH_LANGUAGE_RE = /withLanguage\(\s*["'`](src\/modules\/([^/"'`]+)\/([^"'`]+)\.(?:tsx|ts))["'`]/g;

function flatKeys(obj, prefix = "", out = new Set()) {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) flatKeys(v, prefix ? `${prefix}.${k}` : k, out);
    } else {
        out.add(prefix);
    }
    return out;
}

const readJson = p => {
    try {
        return JSON.parse(read(p));
    } catch {
        return null;
    }
};

export function run() {
    const current = {};
    const sinfonia = path.join(ROOT, "sinfonia/src/modules");

    // 1. Every withLanguage literal resolves in all 5 locales.
    const seen = new Set();
    for (const file of walk(sinfonia, isSource)) {
        for (const m of read(file).matchAll(WITH_LANGUAGE_RE)) {
            const [, literal, pkg, stem] = m;
            if (seen.has(literal)) continue;
            seen.add(literal);
            for (const loc of LOCALES) {
                if (!fs.existsSync(path.join(sinfonia, pkg, "assets/languages", loc, `${stem}.json`))) increment(current, `${literal} missing dictionary ${loc}`);
            }
        }
    }

    // 2. Locale folders and key parity against en-US.
    for (const pkg of fs.readdirSync(sinfonia)) {
        const langRoot = path.join(sinfonia, pkg, "assets/languages");
        if (!fs.existsSync(langRoot)) continue;
        for (const entry of fs.readdirSync(langRoot, {withFileTypes: true})) {
            if (entry.isDirectory() && !LOCALES.includes(entry.name)) increment(current, `${rel(path.join(langRoot, entry.name))} unexpected locale folder`);
        }
        const enRoot = path.join(langRoot, "en-US");
        for (const enFile of walk(enRoot, name => name.endsWith(".json"))) {
            const sub = path.relative(enRoot, enFile);
            const enKeys = flatKeys(readJson(enFile) ?? {});
            for (const loc of LOCALES.slice(1)) {
                const other = path.join(langRoot, loc, sub);
                if (!fs.existsSync(other)) {
                    increment(current, `${rel(enFile)} missing file ${loc}`);
                    continue;
                }
                const otherKeys = flatKeys(readJson(other) ?? {});
                const missing = [...enKeys].filter(k => !otherKeys.has(k)).length;
                if (missing) increment(current, `${rel(enFile)} missing keys ${loc}`, missing);
            }
        }
    }

    // 3. Armonia exception keys.
    const armonia = path.join(ROOT, "armonia/src/modules");
    for (const mod of fs.readdirSync(armonia)) {
        const dir = path.join(armonia, mod, "helpers/static/exceptions");
        if (!fs.existsSync(dir)) continue;
        const en = readJson(path.join(dir, "en_US.json"));
        if (!en) {
            increment(current, `${rel(dir)} missing en_US.json`);
            continue;
        }
        const enKeys = flatKeys(en);
        for (const loc of LOCALES.slice(1).map(l => l.replace("-", "_"))) {
            const other = readJson(path.join(dir, `${loc}.json`));
            if (!other) {
                increment(current, `${rel(dir)} missing ${loc}.json`);
                continue;
            }
            const otherKeys = flatKeys(other);
            const missing = [...enKeys].filter(k => !otherKeys.has(k)).length;
            if (missing) increment(current, `${rel(dir)}/${loc}.json missing keys`, missing);
        }
    }
    return {current};
}
