// D162: a record shared in chat opens in its own sheet, found through the sheet view's `sheetWidget` token. So every sheet
// view of a collection served by `createCrudRouter` (the records chat can share) names a `sheetWidget`, and that token is
// registered by a widget contribution. NO_SHEET lists the shareable collections that have no panel sheet, with the reason.
import path from "node:path";
import {ROOT, increment, read, rel, walk} from "./lib.mjs";

const NO_SHEET = {
    marketingpreferences: "a person's own consent settings, edited in their account settings; no panel sheet",
};

/** The object literal around `index`: from its `{` to the matching `}` (strings are not parsed; views hold no braces in text). */
function enclosingObject(text, index) {
    let depth = 0;
    let start = index;
    for (; start >= 0; start--) {
        const ch = text[start];
        if (ch === "}") depth++;
        else if (ch === "{") {
            if (depth === 0) break;
            depth--;
        }
    }
    depth = 0;
    let end = start;
    for (; end < text.length; end++) {
        const ch = text[end];
        if (ch === "{") depth++;
        else if (ch === "}" && --depth === 0) break;
    }
    return text.slice(start, end + 1);
}

/** The object's own `key: "value"`, not a nested object's. */
function topLevelString(object, key) {
    let depth = 0;
    const re = new RegExp(`(?<![\\w$])${key}\\s*:\\s*"([^"]+)"`, "y");
    for (let i = 0; i < object.length; i++) {
        const ch = object[i];
        if (ch === "{" || ch === "[") depth++;
        else if (ch === "}" || ch === "]") depth--;
        else if (depth === 1) {
            re.lastIndex = i;
            const match = re.exec(object);
            if (match) return match[1];
        }
    }
    return undefined;
}

export function run() {
    const errors = [];
    const current = {};

    const crudCollections = new Set();
    const apiFiles = walk(path.join(ROOT, "maestro/modules"), (name, p) => name.endsWith(".ts") && p.includes(`${path.sep}api${path.sep}`) && !/_tests?/.test(p));
    for (const file of apiFiles) {
        const text = read(file);
        if (!text.includes("createCrudRouter(") && !text.includes("createCrudRouter<")) continue;
        for (const match of text.matchAll(/collectionName:\s*"([A-Za-z0-9_]+)"/g)) crudCollections.add(match[1].toLowerCase());
    }

    const tokens = new Set();
    const contributions = [
        ...walk(path.join(ROOT, "sinfonia/src/modules"), (name, p) => /^widgetContribution\.tsx?$/.test(name) && p.includes(`${path.sep}clients${path.sep}panel${path.sep}`)),
        path.join(ROOT, "sinfonia/src/modules/core/components/viewEngine/registry/coreContribution.ts"),
    ];
    for (const file of contributions) {
        for (const match of read(file).matchAll(/"(#\w+)"\s*:/g)) tokens.add(match[1]);
    }

    for (const key of Object.keys(NO_SHEET)) {
        if (!crudCollections.has(key)) errors.push(`sheetWidgets.mjs NO_SHEET names "${key}", which no createCrudRouter serves: remove it`);
    }

    const viewFiles = walk(path.join(ROOT, "maestro/modules"), (name) => name.endsWith(".views.ts"));
    for (const file of viewFiles) {
        const text = read(file);
        for (const match of text.matchAll(/viewType\s*:\s*"sheet"/g)) {
            const view = enclosingObject(text, match.index);
            const model = topLevelString(view, "model")?.toLowerCase();
            if (!model || !crudCollections.has(model) || NO_SHEET[model]) continue;
            const widget = topLevelString(view, "sheetWidget");
            if (!widget) increment(current, `${rel(file)} sheet view "${model}" names no sheetWidget`);
            else if (!tokens.has(widget)) increment(current, `${rel(file)} sheet view "${model}" names ${widget}, which no widget contribution registers`);
        }
    }
    return {current, errors};
}
