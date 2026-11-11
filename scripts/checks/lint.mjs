#!/usr/bin/env node
// Root `npm run lint`: ESLint in sinfonia, maestro and armonia, with the pre-existing errors frozen per file and rule
// (baselines/lint.json), so only NEW errors fail. Warnings never fail. Shrink the baseline after fixes with --update-baseline.
import {execFileSync} from "node:child_process";
import path from "node:path";
import {ROOT, compareWithBaseline, increment} from "./lib.mjs";

const update = process.argv.includes("--update-baseline");
/** One package's ESLint JSON report. */
function lintPackage(name) {
    const cwd = path.join(ROOT, name);
    try {
        return execFileSync(path.join(cwd, "node_modules/.bin/eslint"), [".", "-f", "json"], {cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024});
    } catch (error) {
        // ESLint exits 1 when it reports errors; the JSON report is still on stdout. Anything else is a real failure.
        if (error.status !== 1 || !error.stdout) throw error;
        return error.stdout;
    }
}

const current = {};
for (const name of ["sinfonia", "maestro", "armonia"]) {
    for (const result of JSON.parse(lintPackage(name))) {
        for (const message of result.messages) {
            if (message.severity === 2) increment(current, `${path.relative(ROOT, result.filePath)} ${message.ruleId ?? "parse-error"}`);
        }
    }
}
const {failures, improvements} = compareWithBaseline("lint", current, {update});
const total = Object.values(current).reduce((a, b) => a + b, 0);
const ok = update || !failures.length;
console.log(`${ok ? "✔" : "✖"} lint: ${total} baselined error(s)${!update && failures.length ? `, ${failures.length} NEW` : ""}${improvements.length ? `, ${improvements.length} improved` : ""}${update ? " (baseline updated)" : ""}`);
if (!update) for (const f of failures) console.log(`    new: ${f}`);
if (!ok) process.exit(1);
