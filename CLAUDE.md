# Arpeggio workspace

This is a multi-repo platform:
- **armonia:** shared contracts (SchemaDef, Zod, DTOs, ViewConfig types).
- **maestro:** API (Express + Mongoose 6, servers in `xServers/`).
- **sinfonia:** React/Vite apps (panel, portal, studio, public, dyeus).
- **solfeggio:** Docker deployment.

Each vertical module folder is its own nested git repo (25 repos in total).

The canonical engineering governance lives in `docs/architecture/`. The rules below always apply. For each area you touch,
open the matching file from the routing table in `docs/architecture/README.md` before writing code.

@docs/architecture/README.md
@docs/architecture/AI_AGENT_RULES.md
@docs/architecture/rules/global.md

Live verification of the dev environment: `.claude/skills/verify/SKILL.md`.
