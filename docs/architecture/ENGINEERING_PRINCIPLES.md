# Engineering principles

These are the confirmed principles behind the rules. Where a rule is ambiguous, these decide. Each principle cites its source.

1. **Code is the current truth; decisions are the target.** Verified implementation describes today. Approved decisions (D01–D50) describe where we're going. A doc that disagrees with both is stale. *(D50)*

2. **Core first, one way to do each thing.** A feature is an Armonia contract + Maestro runtime + Sinfonia UI built from existing core pieces. No parallel framework, ORM wrapper, state library, form engine, query language or test runner. *(existing philosophy, GLB-04)*

3. **Copy the closest canonical; make the smallest correct change.** New work should look like it always belonged here. Conventions are changed platform-wide or not at all. No speculative abstractions. *(system-loyalty feedback, GLB-03)*

4. **Seams, not switches.** Core grows by exposing a few typed extension points (slots, hooks, registries, contributions, actions, events) that verticals plug into. It never grows by accumulating flags and branches for individual features. A new seam is an architectural decision. *(D04)*

5. **Invariants live in core and always run.** Auth, permissions, tenant scope, relation safety, transactions, soft delete and after-commit timing are enforced by core, not remembered by callers. A hook can add to an invariant, never replace it. The roadmap moves today's "remember to" rules (tenant filter, action permission check, after-commit emit, soft-delete in aggregates) into core. *(D04, D06, D14, D15, D16)*

6. **Core knows nothing about verticals, and modules depend only along declared edges.** Each deployment combination must load on its own. *(D02, D03)*

7. **Each layer has one job.** A service touches one collection. Actions are what an actor does to a record. Workflows span entities. Integrations talk to the outside. Utilities are pure helpers. Routes only wire. *(D05, D49)*

8. **Trust validated boundaries, fix types at the source.** Validate at untrusted edges (Zod via `validateFormZod`, `authMW`, public input, JSON payloads). Rely on the established types downstream. Never cast uncertainty away. *(TS-01)*

9. **Claimed behavior must be real.** Done means the effect has been proven at every layer touched, not that it compiles or renders. *(senior-companion rule, D25)*

10. **Mechanical where possible, review where not.** A rule that a script can check belongs in `npm run verify`. Agent instructions cover only what can't be automated. *(D08, Phase 6)*

11. **Fresh start, so seeds are the migration.** Until the architect says otherwise, schema evolution is carried by defaults, seeds and role grants, not migration scripts. *(D19)*

12. **Correct money, correct time, correct language.** Money uses exact scaled integers, time is UTC instants plus local calendar values in the company timezone, and every string exists in five real translations. *(D35, D36, D30)*

13. **Sensitive data is opt-in visible.** Health, identity and payment data are hidden unless explicitly granted, and they never leak through snippets, lists, logs, emails or AI. *(D39)*
