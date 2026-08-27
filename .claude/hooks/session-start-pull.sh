#!/usr/bin/env bash
#
# SessionStart hook — get the true git state before Claude reads anything.
#
# The problem this exists for: `git status` reporting a clean tree says nothing
# about whether the branch is current. Work lands on this remote between
# sessions, so a session that starts reading immediately can build a whole
# diagnosis against a tree that no longer exists and only find out when the
# push is rejected at the end.
#
# Three things happen here, in order of how much they matter:
#
#   1. `git fetch` always. This is the part that makes the rest true, and it
#      is the only step that works regardless of which branch is checked out.
#   2. `git pull --ff-only`, but only when the branch actually has an upstream.
#      Under a branch-per-change workflow most sessions start on a local-only
#      branch, where `git pull` fails with "no tracking information" — a real
#      error message for a completely normal state. Reporting that as a failure
#      every single session is how a hook earns itself a trip to /hooks.
#   3. How far the branch has drifted from the integration branch. A feature
#      branch cut from a stale main is the same failure this hook exists to
#      prevent, one level up, and nothing else surfaces it.
#
# --ff-only rather than a plain pull: a merge pull can invent a merge commit or
# drop the session into a conflicted tree before a single question has been
# asked. --ff-only advances when that is unambiguous and refuses loudly when it
# is not.
#
# Never exits non-zero: a failed fetch or pull is information, not a reason to
# stop the session from starting.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || true

# Not a git repo (or git missing) — nothing to do, and not an error.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')

fetch_out=$(git fetch --prune origin 2>&1); fetch_rc=$?

# The integration branch, asked rather than assumed; origin/HEAD is only set if
# the clone recorded it, so fall back to main.
base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
[ -n "$base" ] || base="origin/main"
git rev-parse --verify --quiet "$base" >/dev/null 2>&1 || base=""

noisy=0
parts=()

if [ "$fetch_rc" -ne 0 ]; then
  noisy=1
  parts+=("git fetch FAILED (exit ${fetch_rc}): ${fetch_out}")
fi

if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  pull_out=$(git pull --ff-only 2>&1); pull_rc=$?
  if [ "$pull_rc" -ne 0 ]; then
    noisy=1
    parts+=("git pull --ff-only FAILED (exit ${pull_rc}): ${pull_out}")
  else
    parts+=("pull: ${pull_out}")
    case "$pull_out" in *"Already up to date"*) ;; *) noisy=1 ;; esac
  fi
else
  parts+=("no upstream — ${branch} is local-only, nothing to pull")
fi

if [ -n "$base" ] && [ "$branch" != "HEAD" ]; then
  behind=$(git rev-list --count "HEAD..${base}" 2>/dev/null || echo 0)
  ahead=$(git rev-list --count "${base}..HEAD" 2>/dev/null || echo 0)
  parts+=("vs ${base}: ${ahead} ahead, ${behind} behind")
  [ "${behind:-0}" -gt 0 ] && noisy=1
fi

head=$(git log --oneline -1 2>/dev/null || echo '?')
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

# Not ${parts[*]} with IFS="; " — that joins on the first character of IFS
# only, so the separator comes out as ";" with no space.
summary="[${branch}] ${parts[0]:-}"
for p in "${parts[@]:1}"; do summary+="; $p"; done
context="Session-start git check. ${summary}. HEAD ${head}. Uncommitted paths: ${dirty}."

# Bash applies backslash processing to the replacement half of
# ${var//pat/repl}, so the obvious spelling is silently wrong: ${s//\/\\}
# replaces a backslash with a backslash (a no-op that leaves the Windows paths
# in git's errors unescaped) and ${s//$'\t'/\t} replaces a tab with a bare "t",
# eating it. Quoting both halves makes them literal.
json_escape() {
  local s=$1
  local bs='\' q='"' cr=$'\r' nl=$'\n' tab=$'\t'
  s=${s//"$bs"/"$bs$bs"}   # first, or it re-escapes the backslashes it adds
  s=${s//"$q"/"$bs$q"}
  s=${s//"$cr"/}
  s=${s//"$nl"/"${bs}n"}
  s=${s//"$tab"/"${bs}t"}
  printf '%s' "$s"
}

ctx=$(json_escape "$context")

if [ "$noisy" -eq 0 ]; then
  printf '{"suppressOutput":true,"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$ctx"
else
  msg=$(json_escape "$summary")
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$msg" "$ctx"
fi
