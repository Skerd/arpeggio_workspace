#!/usr/bin/env node
// Builds the data files behind the governance tracker dashboard from the canonical docs and git history.
// The docs stay the single source (D29): this only reads them.
//
//   node scripts/status/trackerData.mjs <outDir> [--since=YYYY-MM-DD]
//
// Writes roadmap.json, tenantScope.json, debt.json and commits.json into <outDir>.
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const [outDir, ...flags] = process.argv.slice(2);
if (!outDir) {
    console.error("usage: node scripts/status/trackerData.mjs <outDir> [--since=YYYY-MM-DD]");
    process.exit(2);
}
const since = flags.find((flag) => flag.startsWith("--since="))?.slice(8) ?? "2026-11-01";
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

/** Markdown table cells to plain text: no links, code ticks, bold or strike marks. */
const plain = (cell) => cell
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const rowsOf = (line) => line.split("|").slice(1, -1).map((cell) => cell.trim());
const isTableRow = (line) => line.startsWith("| ") && !/^\|\s*-/.test(line) && !/^\| (Item|ID) \|/.test(line);

/** The roadmap: one row per item, with its phase and a status read from its Action cell. */
function roadmap() {
    const rows = [];
    let phase = "";
    for (const line of read("docs/architecture/OPTIMIZATION_ROADMAP.md").split("\n")) {
        const heading = line.match(/^## (P\d+)[: ]\s*(.*)$/);
        if (heading) phase = `${heading[1]} ${heading[2]}`.trim();
        else if (line.startsWith("## ")) phase = "";
        if (!phase || !isTableRow(line)) continue;
        const [item, sev, , , , effort, , action = ""] = rowsOf(line);
        const text = plain(action);
        const status = /^Done\b/.test(text) ? "done"
            : /\b(built|enforced|started)\b/i.test(text) ? "in progress"
            : "planned";
        rows.push({
            phase,
            item: plain(item),
            decisions: [...new Set(item.match(/D\d{2}a?/g) ?? [])].join(" "),
            severity: sev,
            effort,
            status,
            action: text,
        });
    }
    return rows;
}

/** Tenant scoping (D16): enforced unconditionally in every module since 2026-11-04 (D53). Launch modules per D32. */
function tenantScope() {
    const launch = new Set(["propertyManagement", "propertyDevelopment", "eCommerce", "finance", "carRental", "dentalClinic"]);
    const modules = ["carRental", "dentalClinic", "eCommerce", "finance", "propertyManagement", "propertyDevelopment", "swissOutreach"];
    return modules.map((module) => ({module, launch: launch.has(module) ? "launch" : "later", status: "enforced"}));
}

/** Catalogued debt: open unless struck through or marked fixed/removed/done; "future" when its fix column starts with Future (postponed). */
function debt() {
    const rows = [];
    let area = "";
    for (const line of read("docs/architecture/TECHNICAL_DEBT.md").split("\n")) {
        const heading = line.match(/^## (.*)$/);
        if (heading) area = heading[1].trim();
        if (!line.startsWith("| TD-")) continue;
        const [id, what, where = "", fix = ""] = rowsOf(line);
        const closed = /~~|\b(FIXED|REMOVED)\b/.test(what);
        const status = closed ? "fixed" : /^Future\b/.test(fix.trim()) ? "future" : "open";
        rows.push({id, area, debt: plain(what).replace(/^(FIXED|REMOVED) \S+:?\s*/, ""), where: plain(where), status});
    }
    return rows;
}

/** Commits since `since` in the workspace and every nested repo (25 + the workspace). */
function commits() {
    const repos = [""];
    for (const pkg of ["armonia", "maestro", "sinfonia", "solfeggio"]) {
        repos.push(pkg);
        const modulesDir = pkg === "armonia" ? `${pkg}/src/modules` : pkg === "maestro" ? `${pkg}/modules` : `${pkg}/src/modules`;
        const abs = path.join(root, modulesDir);
        if (!fs.existsSync(abs)) continue;
        for (const name of fs.readdirSync(abs)) {
            if (fs.existsSync(path.join(abs, name, ".git"))) repos.push(`${modulesDir}/${name}`);
        }
    }
    const rows = [];
    for (const repo of repos) {
        const cwd = path.join(root, repo);
        if (!fs.existsSync(path.join(cwd, ".git"))) continue;
        let log = "";
        try {
            log = execFileSync("git", ["log", `--since=${since}`, "--format=%h%x09%cI%x09%s"], {cwd, encoding: "utf8"});
        } catch {
            continue;
        }
        for (const entry of log.split("\n").filter(Boolean)) {
            const [hash, at, message] = entry.split("\t");
            rows.push({repo: repo || "workspace", hash, day: at.slice(0, 10), at, message});
        }
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at));
}

fs.mkdirSync(outDir, {recursive: true});
for (const [name, rows] of Object.entries({roadmap: roadmap(), tenantScope: tenantScope(), debt: debt(), commits: commits()})) {
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(rows, null, 1));
    console.log(`${name}.json: ${rows.length} rows`);
}
