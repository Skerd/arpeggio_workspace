// FE-08 / BE-07 (D30): every withLanguage dictionary, every exception key and every notification text exists in all 5 locales;
// no locale folder outside the 5; no value left as the en-US text. en-US is the reference.
import fs from "node:fs";
import path from "node:path";
import {ROOT, increment, isSource, read, rel, walk} from "./lib.mjs";

const LOCALES = ["en-US", "de-CH", "fr-FR", "it-IT", "sq-AL"];
const WITH_LANGUAGE_RE = /withLanguage\(\s*["'`](src\/modules\/([^/"'`]+)\/([^"'`]+)\.(?:tsx|ts))["'`]/g;

/** Every leaf key path; array items count too, so a help list shorter than en-US shows as missing keys. */
function flatKeys(obj, prefix = "", out = new Set()) {
    if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) flatKeys(v, prefix ? `${prefix}.${k}` : k, out);
    } else {
        out.add(prefix);
    }
    return out;
}

// Values legitimately identical to English in a locale ("*" = every locale): brands, codes, shared words.
const SAME_AS_ENGLISH_FILE = path.join(ROOT, "scripts/checks/i18n-same-as-english.json");
// Keys whose values are identifiers, not UI text.
const NON_TEXT_KEYS = new Set(["path", "error_code", "key", "logo", "icon", "slug", "code"]);

/** The words of a UI string, ignoring placeholders, tags, URLs and e-mail addresses. */
const textWords = s =>
    /^(https?:|\/|[\w.-]+@)/.test(s)
        ? []
        : s
              .replace(/\{\{[^}]*\}\}|\{[^}]*\}|<[^>]*>/g, " ")
              .split(/\s+/)
              .filter(w => /^[A-Za-z][A-Za-z'’-]*[.,:;!?…)]*$/.test(w));

/** Whether a string is translatable text: a phrase, or one word of at least 3 letters. */
const isText = s => {
    const words = textWords(s);
    return words.length >= 2 || (words.length === 1 && /^[A-Za-z]{3,}/.test(s.trim()));
};

/** [keyPath, value] for every leaf, array items included (help bullets); key paths are arrays because keys may contain dots. */
function leaves(obj, prefix = [], out = []) {
    if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) leaves(v, [...prefix, k], out);
    } else {
        out.push([prefix, obj]);
    }
    return out;
}

/** Case and spacing do not make English text a translation ("Created At" for "Created at"). */
const normalized = v => (typeof v === "string" ? v.toLowerCase().replace(/\s+/g, " ").trim() : v);

/** Count of values in `other` still equal to the en-US text and not allowed for `loc`. */
function untranslatedCount(en, other, loc, sameAsEnglish) {
    const otherValues = new Map(leaves(other).map(([k, v]) => [JSON.stringify(k), v]));
    const allowed = new Set([...(sameAsEnglish["*"] ?? []), ...(sameAsEnglish[loc] ?? [])].map(normalized));
    return leaves(en).filter(([k, v]) => {
        if (typeof v !== "string" || NON_TEXT_KEYS.has(k[k.length - 1]) || !isText(v)) return false;
        const value = otherValues.get(JSON.stringify(k));
        return normalized(value) === normalized(v) && !allowed.has(normalized(value));
    }).length;
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
    const sameAsEnglish = readJson(SAME_AS_ENGLISH_FILE) ?? {};
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
            const en = readJson(enFile) ?? {};
            const enKeys = flatKeys(en);
            for (const loc of LOCALES.slice(1)) {
                const other = path.join(langRoot, loc, sub);
                if (!fs.existsSync(other)) {
                    increment(current, `${rel(enFile)} missing file ${loc}`);
                    continue;
                }
                const otherJson = readJson(other) ?? {};
                const otherKeys = flatKeys(otherJson);
                const missing = [...enKeys].filter(k => !otherKeys.has(k)).length;
                if (missing) increment(current, `${rel(enFile)} missing keys ${loc}`, missing);
                const untranslated = untranslatedCount(en, otherJson, loc, sameAsEnglish);
                if (untranslated) increment(current, `${rel(other)} untranslated`, untranslated);
            }
        }
    }

    // 3. Armonia exception keys, notification texts (D128) and default-role labels (D129), one `<xx_YY>.json` per locale.
    const armonia = path.join(ROOT, "armonia/src/modules");
    for (const mod of fs.readdirSync(armonia)) {
        for (const folder of ["exceptions", "notificationTypes", "defaultRoles"]) {
            const dir = path.join(armonia, mod, "helpers/static", folder);
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
                const untranslated = untranslatedCount(en, other, loc.replace("_", "-"), sameAsEnglish);
                if (untranslated) increment(current, `${rel(dir)}/${loc}.json untranslated`, untranslated);
            }
        }
    }
    return {current};
}
