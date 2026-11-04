# AI agent rules (AGT-*)

Mandatory for every coding agent (Claude Code, Cursor, others) in this workspace. Workflow steps are in
[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md); engineering rules are in [rules/](rules/).

---

### AGT-01 · MUST · Ask vs act
**Stop and ask** before implementing when:
- **(a)** the request is ambiguous about behavior a user will see (not wording or styling);
- **(b)** the change needs an APPROVAL REQUIRED item (new core seam CORE-03, deletion beyond confirmed AGT-05, dependency AGT-04, commit AGT-03, destructive dev data AGT-07);
- **(c)** it hits an unresolved conflict or open decision ([ARCHITECTURAL_CONFLICTS.md](ARCHITECTURAL_CONFLICTS.md));
- **(d)** no canonical pattern fits and a new pattern would be needed.

**Otherwise proceed**, and list every assumption in the report: naming, placement that follows convention, UI copy, choosing between equivalent existing helpers. *(D27)*

### AGT-02 · MUST NOT · The never-list
- Invent core APIs, middleware names, contribution kinds or file conventions (GLB-02).
- Duplicate existing functionality, or build a parallel stack (GLB-03, GLB-04).
- Introduce a pattern, layer or abstraction without a current consumer and justification.
- Make speculative changes or uncontrolled refactors unrelated to the task.
- Weaken type safety: `as any`, `as unknown as`, `@ts-ignore`, needless `?.` (TS-01).
- Suppress errors or checks so things *look* successful. Claim tests or checks passed without running them.
- Modify architectural foundations (core seams, manifest, plugins, auth) without approval.
- Hide uncertainty, or present incomplete context as verified.
- Leave a visible control, field, branch or API that cannot do what it appears to do. If something can't work on a surface, leave it off and say so. *(existing senior-companion rule)*

### AGT-03 · APPROVAL REQUIRED · Git
- **Approval required:** every commit and every push, in any of the 25 repos.
- **Repo layout:** the four roots are `armonia`, `maestro`, `sinfonia`, `solfeggio`. Each vertical (carRental, dentalClinic, eCommerce, finance, propertyDevelopment, propertyManagement, swissOutreach) is its **own nested repo** under each package. Commit vertical work inside its own repo; never `git add` a vertical from the parent. Check status with `find . -maxdepth 6 -name .git`.
- **Never commit** the commented-out Redis/Kafka/WS connects in `maestro/xServers/apiServer.ts` (the architect's local debugging).
- **Never add** `Co-Authored-By` or any AI attribution line. Commit messages are plain sentences. *(D26, memory)*

### AGT-04 · APPROVAL REQUIRED · Dependencies
- **Rule:** Adding, removing or upgrading any npm package in any `package.json` requires approval. Name the package, version and reason. *(D26)*

### AGT-05 · Deletion requires evidence
- **Rule:** Before deleting a file, export or feature, search every discovery path:
  - static imports across armonia/maestro/sinfonia/scripts, re-exports;
  - route discovery (`routeRegistry.ts`) and `moduleBootstrap`;
  - contribution globs, `ENABLED_MODULES`;
  - cron `register*CronHandlers`, Kafka `start*KafkaConsumer(s)`, `@action`/`getRegisteredActions`;
  - ViewConfig keys, exception JSON keys, locale files, string lookups (collection names, permission keys, notification codes).
- Classify the result as **confirmed / probable / indirect-uncertain / unknown**.
- **Confirmed** dead code **MAY** be removed without asking. Everything else is **APPROVAL REQUIRED**. Core is never a cleanup target because a feature doesn't import it. *(existing deletion rule, kept in D26)*

### AGT-06 · MUST · Debt scope during a task
- **Rule:** Same as OPT-04: fix only catalogued debt, and only inside the code you are already changing. Report it separately. *(D10)*

### AGT-07 · APPROVAL REQUIRED · Destructive dev-data operations
- **Rule:** Dev profile `reset`, dropping collections, bulk deletes, and temporarily swapping a user's password hash to log in all need approval. When approved: back up first, restore after, and delete test docs by distinctive titles. *(D26)*

### AGT-08 · MUST · Verification
1. Run root `npm run verify` and report its output (GLB-11).
2. Verify live at every touched layer (TST-07). If you can't, write **"NOT live-verified"** with the reason, and report the task as unfinished.
3. Review the final diff for unintended changes: debug code, formatting churn, unrelated files. *(D08, D25)*

### AGT-09 · MUST · Report shape
Final report sections (omit empty ones, keep prose short):
1. **Outcome:** what now works, in 1–2 sentences.
2. **Changes:** files grouped by repo, with the nested repo named.
3. **Reused:** existing helpers, seams and canonical files followed.
4. **Decisions & assumptions:** made without asking.
5. **Verification:** exact commands + pass/fail counts; the live check per layer, or "NOT live-verified" + reason.
6. **Debt:** fixed (catalogued) / found (added to TECHNICAL_DEBT.md).
7. **Open:** risks, unfinished parts, approvals needed. *(D45)*

### AGT-10 · MUST · Claimed behavior must be real
- **Rule:** A change is done only when the effect it claims is proven: rows change, dependent fields change, the form saves, and the empty and cleared cases hold. Compiling, rendering or matching a requested shape is not done. *(existing senior-companion rule)*

### AGT-11 · SHOULD · Presenting choices to the architect
- **Rule:** Lead with your recommendation, marked "(Recommended)", plus the concrete evidence from the code, then the alternatives. On "you decide", decide, give the reason in one line, and record it as delegated. *(interview meta-preference M1)*

### AGT-12 · MUST · Load the governance before working
- **Rule:** Start every task from [README.md](README.md): pick the rule files for the areas you touch, and read the canonical implementation before writing.
