// D29: the governance docs stay consistent: every cited rule ID is defined, every D-id exists, every markdown link,
// @-import and backticked repo path resolves. No baseline: this check must always be clean.
import fs from "node:fs";
import path from "node:path";
import {ROOT, read, rel, walk} from "./lib.mjs";

const PATH_PREFIXES = ["maestro/", "sinfonia/", "armonia/", "solfeggio/", "scripts/", "docs/", ".claude/", ".cursor/"];
// The interview record quotes target paths that do not exist yet (e.g. the D01a manifest location).
const PATH_CHECK_EXEMPT = new Set(["docs/architecture/ARCHITECTURE_INTERVIEW.md"]);

export function run() {
    const files = [
        ...walk(path.join(ROOT, "docs/architecture"), n => n.endsWith(".md")),
        ...walk(path.join(ROOT, ".cursor/rules"), n => n.endsWith(".mdc")),
        path.join(ROOT, "CLAUDE.md"),
        path.join(ROOT, "AGENTS.md"),
        path.join(ROOT, ".claude/skills/verify/SKILL.md"),
    ].filter(f => fs.existsSync(f));
    const texts = Object.fromEntries(files.map(f => [f, read(f)]));
    const errors = [];

    const defined = new Set();
    for (const t of Object.values(texts)) {
        for (const m of t.matchAll(/^###\s+([A-Z]{2,4}-\d{2})\b/gm)) defined.add(m[1]);
        for (const m of t.matchAll(/\*\*([A-Z]{2,4}-\d{2})\s*·/g)) defined.add(m[1]);
        for (const m of t.matchAll(/\*\*((?:TS|VC|SNP)-\d{2})\*\*/g)) defined.add(m[1]);
    }
    const decisions = new Set([...read(path.join(ROOT, "docs/architecture/ARCHITECTURAL_DECISIONS.md")).matchAll(/^\| (D\d{2}a?) \|/gm)].map(m => m[1]));

    for (const [file, t] of Object.entries(texts)) {
        const r = rel(file);
        for (const m of t.matchAll(/\b(GLB|CORE|BE|DB|SEC|FE|TST|OPT|AGT|TS|VC|SNP)-(\d{2})\b/g)) {
            if (!defined.has(`${m[1]}-${m[2]}`)) errors.push(`${r}: rule ${m[1]}-${m[2]} is not defined`);
        }
        for (const m of t.matchAll(/\b(D\d{2}a?)\b/g)) {
            if (!decisions.has(m[1])) errors.push(`${r}: decision ${m[1]} is not in ARCHITECTURAL_DECISIONS.md`);
        }
        for (const m of t.matchAll(/\]\(([^)#\s]+)\)/g)) {
            if (/^https?:/.test(m[1])) continue;
            if (!fs.existsSync(path.resolve(path.dirname(file), m[1]))) errors.push(`${r}: broken link ${m[1]}`);
        }
        for (const m of t.matchAll(/^@(\S+)/gm)) {
            if (!fs.existsSync(path.join(ROOT, m[1]))) errors.push(`${r}: broken @import ${m[1]}`);
        }
        if (PATH_CHECK_EXEMPT.has(r)) continue;
        for (const m of t.matchAll(/`([^`\s]+)`/g)) {
            const tok = m[1].replace(/[.,;:]+$/, "").replace(/:\d+(-\d+)?(,\d+)*$/, "");
            if (/[<>*{}…|]/.test(tok) || tok.endsWith("(")) continue;
            if (PATH_PREFIXES.some(p => tok.startsWith(p)) && !fs.existsSync(path.join(ROOT, tok))) errors.push(`${r}: missing path ${tok}`);
        }
    }
    return {current: {}, errors: [...new Set(errors)]};
}
