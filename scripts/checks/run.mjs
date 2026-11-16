#!/usr/bin/env node
// Governance checks runner (part of root `npm run verify`).
//   node scripts/checks/run.mjs                    run all checks
//   node scripts/checks/run.mjs boundaries zod     run selected checks
//   node scripts/checks/run.mjs --update-baseline  re-freeze baselines (only after an approved fix or decision)
// Exit code 1 when any check has a new violation or a hard error.
import * as boundaries from "./boundaries.mjs";
import * as plugins from "./plugins.mjs";
import * as zod from "./zod.mjs";
import * as modelAccess from "./modelAccess.mjs";
import * as i18n from "./i18n.mjs";
import * as governance from "./governance.mjs";
import * as sheetWidgets from "./sheetWidgets.mjs";
import {compareWithBaseline} from "./lib.mjs";

const CHECKS = {boundaries, plugins, zod, "model-access": modelAccess, i18n, governance, "sheet-widgets": sheetWidgets};
const args = process.argv.slice(2);
const update = args.includes("--update-baseline");
const verbose = args.includes("--verbose");
const selected = args.filter(a => !a.startsWith("--"));
const unknown = selected.filter(n => !CHECKS[n]);
if (unknown.length) {
    console.error(`Unknown check(s): ${unknown.join(", ")}. Available: ${Object.keys(CHECKS).join(", ")}`);
    process.exit(2);
}

let failed = false;
for (const name of selected.length ? selected : Object.keys(CHECKS)) {
    const {current, errors = []} = CHECKS[name].run();
    const {failures, improvements} = name === "governance" ? {failures: [], improvements: []} : compareWithBaseline(name, current, {update});
    const total = Object.values(current).reduce((a, b) => a + b, 0);
    const ok = !errors.length && (update || !failures.length);
    console.log(`${ok ? "✔" : "✖"} ${name}: ${total} baselined violation(s)${errors.length ? `, ${errors.length} error(s)` : ""}${!update && failures.length ? `, ${failures.length} NEW` : ""}${improvements.length ? `, ${improvements.length} improved` : ""}${update ? " (baseline updated)" : ""}`);
    for (const e of errors) console.log(`    error: ${e}`);
    if (!update) for (const f of failures) console.log(`    new: ${f}`);
    if (verbose) for (const i of improvements) console.log(`    improved: ${i}`);
    if (!ok) failed = true;
}
if (failed) {
    console.log("\nFix the new violations, or (only with architect approval) record an exemption / re-freeze with --update-baseline.");
    process.exit(1);
}
