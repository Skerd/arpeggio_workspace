// BE-06 (D11): validators build value checks from zodBuilder helpers; no Zod outside Armonia.
import path from "node:path";
import {ROOT, increment, isSource, isTestPath, read, rel, walk} from "./lib.mjs";

const RAW_VALUE_RE = /\bz\s*\.\s*(?:string|number|boolean|enum|nativeEnum|date|bigint|literal|coerce)\b|(?<!Math)\.(?:min|max|length|email|url|regex|int|positive|nonnegative|gte|lte|gt|lt)\(/g;
const ZOD_IMPORT_RE = /from\s*['"]zod(?:\/[^'"]*)?['"]/;
const ZOD_VALUE_CALL_RE = /\bz\s*\.\s*[a-zA-Z]+\s*\(/g;
// D51: AI assistant tool-parameter schemas and the Vite env validation are not client/server contracts.
const OUTSIDE_EXEMPT = [/^maestro\/modules\/[^/]+\/domain\/ai\//, /^sinfonia\/src\/modules\/core\/helpers\/environment\/env\.ts$/];

export function run() {
    const current = {};
    const validators = walk(path.join(ROOT, "armonia/src/modules"), name => /\.form\.validators?\.ts$|\.validator\.ts$/.test(name));
    for (const file of validators) {
        const n = (read(file).match(RAW_VALUE_RE) ?? []).length;
        if (n) increment(current, `${rel(file)} raw value checks`, n);
    }
    for (const root of ["maestro/modules", "maestro/xServers", "sinfonia/src"]) {
        for (const file of walk(path.join(ROOT, root), isSource)) {
            if (isTestPath(file) || OUTSIDE_EXEMPT.some(re => re.test(rel(file)))) continue;
            const text = read(file);
            if (!ZOD_IMPORT_RE.test(text)) continue;
            const n = (text.match(ZOD_VALUE_CALL_RE) ?? []).length;
            if (n) increment(current, `${rel(file)} zod outside armonia`, n);
        }
    }
    return {current};
}
