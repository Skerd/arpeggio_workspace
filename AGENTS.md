# Arpeggio: instructions for coding agents

This is a multi-repo platform:
- **armonia:** shared contracts.
- **maestro:** Express + Mongoose API.
- **sinfonia:** React/Vite apps.
- **solfeggio:** Docker deployment.

Each vertical module folder (carRental, dentalClinic, eCommerce, finance, propertyDevelopment, propertyManagement,
swissOutreach) under each package is its own nested git repo.

**Before any task:**
1. Read `docs/architecture/README.md`, the index and routing table.
2. Read `docs/architecture/AI_AGENT_RULES.md` (AGT-*), which is mandatory.
3. Read `docs/architecture/rules/global.md` (GLB-*), which is mandatory.
4. Read the rule file for every area you touch (`rules/core|backend|database|security|frontend|viewconfig|snippets|typescript|testing|optimization.md`).
5. Follow `docs/architecture/DEVELOPMENT_WORKFLOW.md` and report in the AGT-09 shape.

These need explicit approval: commits/pushes, dependency changes, destructive dev-data operations, deleting anything not
confirmed dead, new core seams. Never add AI attribution to commit messages.
