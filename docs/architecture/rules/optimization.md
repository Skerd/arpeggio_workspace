# Optimization rules (OPT-*)

Optimize from evidence, keep each change small, and never let an optimization weaken an invariant (CORE-04).
Prioritized work is in [../OPTIMIZATION_ROADMAP.md](../OPTIMIZATION_ROADMAP.md).

---

### OPT-01 · MUST · Query performance (structural)
1. Every list/select endpoint is paginated with a hard max limit.
2. No unbounded `find` or `aggregate` in a request path.
3. A new filter or sort field on a tenant collection gets a compound index starting with `company` (DB-06).
4. Aggregations start with a `$match` on indexed fields, company first.
5. No N+1: batch with `$in`, or populate through snippets.
6. When adding a query on a large collection, run `explain()` against dev data and report whether an index is used.
- Numeric SLOs are deferred until there is real traffic. **Why:** D33. **Enforce:** review + `explain()` evidence.

### OPT-02 · MUST · Caching
1. A new cache needs measured evidence (timing or `explain()`), stated in the report.
2. Cache keys include `company`, plus the user when permissions shape the result.
3. Invalidation is explicit on write, after commit. A TTL is only a backstop.
4. Redis is used only through core circuit-breaker wrappers.
5. Correctness never depends on the cache: with Redis down, the request still succeeds uncached.
- **Why:** D42.

### OPT-03 · SHOULD · Complexity triggers
- **Rule:** No hard size gate. When adding to a file over ~600 lines or a function over ~80 lines, first place the addition in a separate file of the right layer (another action file, a helper, a seam consumer). Splits that need restructuring are reported as debt, not done unasked. Planned: `verify` prints a top-20 file-size report (informational).
- **Why:** D43.

### OPT-04 · MUST · Debt fixed during a task
- **Rule:** Only debt that is **catalogued** in `TECHNICAL_DEBT.md` with a defined fix, and only inside the functions or blocks the task already changes. Report it on a separate "debt fixed" line. Everything else gets reported, not fixed.
- **Why:** D10 (reconciles "fix when touched" with the minimal-change rule).

### OPT-05 · MUST · Bundle
- **Rule:** Panel pages are lazy (FE-06). New heavy dependencies (pdf, office, maps, charts) need approval (AGT-04) and must load behind a lazy boundary.
- **Why:** D21, D26.

### OPT-06 · MUST · Large optimizations need approval
- **Rule:** An optimization that changes a core seam, a data shape, or behavior across modules is a roadmap item with its own approval, pilot module and tests.
- **Why:** D48.
