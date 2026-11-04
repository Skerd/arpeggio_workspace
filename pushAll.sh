#!/bin/bash
#
# pushAll.sh — push every Arpeggio repo's current branch to origin.
#
# The tree is 21 independent git repos (3 cores + 18 module repos). A feature
# usually spans several of them, so it is easy to push some and forget others —
# which ships an API without its UI. This walks all of them in one pass.
#
# Dry run by default. Pass --push to actually push.
#
#   ./pushAll.sh            # report what would be pushed
#   ./pushAll.sh --push     # push it
#
# Only the CURRENT branch of each repo is pushed, never --all: several repos
# carry local merged/* branches that should stay local.

# No `set -u`: macOS ships bash 3.2, which errors on empty-array
# expansion such as "${#PUSHED[@]}" when -u is active.
set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DO_PUSH=false

for arg in "$@"; do
    case "$arg" in
        --push)
            DO_PUSH=true
            ;;
        -h|--help)
            echo "Usage: $0 [--push]"
            echo "  (no flags)  Dry run: report what would be pushed"
            echo "  --push      Actually push each repo's current branch"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: ${arg}${NC}"
            exit 1
            ;;
    esac
done

REPOS=()
for d in armonia maestro sinfonia \
         armonia/src/modules/* maestro/modules/* sinfonia/src/modules/*; do
    [ -d "${ROOT}/${d}/.git" ] && REPOS+=("$d")
done

if [ "${#REPOS[@]}" -eq 0 ]; then
    echo -e "${RED}No git repositories found under ${ROOT}${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}================================================================${NC}"
if [ "$DO_PUSH" = "true" ]; then
    echo -e "${BLUE}          Pushing ${#REPOS[@]} Arpeggio repos${NC}"
else
    echo -e "${BLUE}          Dry run — ${#REPOS[@]} Arpeggio repos (no --push)${NC}"
fi
echo -e "${BLUE}================================================================${NC}"
echo ""

PUSHED=()
BLOCKED=()
TRACKFIX=()
DIRTY=()
INSYNC=0

for repo in "${REPOS[@]}"; do
    path="${ROOT}/${repo}"

    branch="$(git -C "$path" rev-parse --abbrev-ref HEAD 2>/dev/null)"
    if [ -z "$branch" ]; then
        echo -e "${RED}[ERROR]${NC}   ${repo}: cannot read HEAD"
        BLOCKED+=("${repo} (unreadable HEAD)")
        continue
    fi
    if [ "$branch" = "HEAD" ]; then
        echo -e "${YELLOW}[SKIP]${NC}    ${repo}: detached HEAD"
        BLOCKED+=("${repo} (detached HEAD)")
        continue
    fi

    # Tracked modifications only. Untracked entries in the three core repos are
    # the nested module repos themselves, which are expected and not lost work.
    mod="$(git -C "$path" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ')"
    [ "$mod" -gt 0 ] && DIRTY+=("${repo} (${mod} uncommitted)")

    if git -C "$path" ls-remote --exit-code origin "refs/heads/${branch}" >/dev/null 2>&1; then
        git -C "$path" fetch -q origin "$branch" 2>/dev/null
        ahead="$(git -C "$path" rev-list --count "origin/${branch}..HEAD" 2>/dev/null || echo 0)"
        behind="$(git -C "$path" rev-list --count "HEAD..origin/${branch}" 2>/dev/null || echo 0)"
        new_branch=false
    else
        ahead="$(git -C "$path" rev-list --count HEAD 2>/dev/null || echo 0)"
        behind=0
        new_branch=true
    fi

    label="${repo} [${branch}]"

    if [ "$behind" -gt 0 ] && [ "$ahead" -gt 0 ]; then
        echo -e "${RED}[DIVERGED]${NC} ${label}: ahead ${ahead}, behind ${behind} — pull first, not pushing"
        BLOCKED+=("${label} diverged (ahead ${ahead}, behind ${behind})")
        continue
    fi

    if [ "$behind" -gt 0 ]; then
        echo -e "${YELLOW}[BEHIND]${NC}  ${label}: behind ${behind}, nothing to push"
        continue
    fi

    # A branch with no upstream makes `git rev-list @{u}..HEAD` fail silently,
    # which is how 10 unpushed commits once hid behind a "?" in an audit.
    # Repair it whenever origin already has the branch.
    if [ "$new_branch" != "true" ] && \
       [ -z "$(git -C "$path" config --get "branch.${branch}.remote")" ]; then
        if [ "$DO_PUSH" = "true" ]; then
            git -C "$path" branch --set-upstream-to="origin/${branch}" "$branch" >/dev/null 2>&1 \
                && echo -e "${BLUE}[TRACK]${NC}   ${label}: set upstream to origin/${branch}"
        else
            echo -e "${BLUE}[TRACK]${NC}   ${label}: no upstream set — would fix"
        fi
        TRACKFIX+=("${label}")
    fi

    if [ "$ahead" -eq 0 ]; then
        INSYNC=$((INSYNC + 1))
        continue
    fi

    if [ "$new_branch" = "true" ]; then
        echo -e "${YELLOW}[NEW]${NC}     ${label}: branch does not exist on origin (${ahead} commits)"
    else
        echo -e "${GREEN}[AHEAD]${NC}   ${label}: ${ahead} commit(s) to push"
    fi
    git -C "$path" log --oneline "--max-count=5" \
        $([ "$new_branch" = "true" ] && echo HEAD || echo "origin/${branch}..HEAD") \
        2>/dev/null | sed 's/^/             /'
    [ "$ahead" -gt 5 ] && echo "             ... and $((ahead - 5)) more"

    if [ "$DO_PUSH" = "true" ]; then
        # -u when the branch has no tracking config, so future ahead/behind
        # checks resolve instead of silently reporting nothing.
        if [ -z "$(git -C "$path" config --get "branch.${branch}.remote")" ]; then
            push_output="$(git -C "$path" push --set-upstream origin "$branch" 2>&1)"
            push_status=$?
        else
            push_output="$(git -C "$path" push origin "$branch" 2>&1)"
            push_status=$?
        fi

        if [ "$push_status" -eq 0 ]; then
            echo -e "             ${GREEN}pushed${NC}"
            PUSHED+=("${label} (${ahead})")
        else
            echo -e "             ${RED}push failed:${NC}"
            echo "$push_output" | sed 's/^/             /'
            BLOCKED+=("${label} push failed")
        fi
    else
        PUSHED+=("${label} (${ahead})")
    fi
    echo ""
done

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}                          Summary${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo -e "  Already in sync: ${INSYNC}"

if [ "${#PUSHED[@]}" -gt 0 ]; then
    if [ "$DO_PUSH" = "true" ]; then
        echo -e "  ${GREEN}Pushed: ${#PUSHED[@]}${NC}"
    else
        echo -e "  ${GREEN}Would push: ${#PUSHED[@]}${NC}"
    fi
    for r in "${PUSHED[@]}"; do echo "    - $r"; done
fi

if [ "${#DIRTY[@]}" -gt 0 ]; then
    echo ""
    echo -e "  ${YELLOW}Uncommitted changes (NOT pushed — review before committing):${NC}"
    for r in "${DIRTY[@]}"; do echo "    - $r"; done
fi

if [ "${#TRACKFIX[@]}" -gt 0 ]; then
    echo ""
    if [ "$DO_PUSH" = "true" ]; then
        echo -e "  ${BLUE}Upstream tracking repaired: ${#TRACKFIX[@]}${NC}"
    else
        echo -e "  ${BLUE}Missing upstream tracking (hides unpushed commits): ${#TRACKFIX[@]}${NC}"
    fi
    for r in "${TRACKFIX[@]}"; do echo "    - $r"; done
fi

if [ "${#BLOCKED[@]}" -gt 0 ]; then
    echo ""
    echo -e "  ${RED}Needs attention: ${#BLOCKED[@]}${NC}"
    for r in "${BLOCKED[@]}"; do echo "    - $r"; done
fi

echo ""
if [ "$DO_PUSH" != "true" ] && [ "${#PUSHED[@]}" -gt 0 ]; then
    echo -e "  Re-run with ${GREEN}--push${NC} to push."
    echo ""
fi

[ "${#BLOCKED[@]}" -gt 0 ] && exit 1
exit 0
