#!/usr/bin/env bash
#
# SessionStart hook — pull before Claude reads anything.
#
# The problem this exists for: `git status` reporting a clean tree says nothing
# about whether the branch is current. Work lands on this remote between
# sessions, so a session that starts reading immediately can build a whole
# diagnosis against a tree that no longer exists and only find out when the
# push is rejected at the end.
#
# --ff-only, not a plain pull: a merge pull can invent a merge commit or drop
# the session into a conflicted tree before a single question has been asked.
# --ff-only advances when that is unambiguous and refuses loudly when it is
# not, which is the right failure at t=0. A refusal is reported to both the
# user and Claude rather than swallowed.
#
# Never exits non-zero: a failed pull is information, not a reason to stop the
# session from starting.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || true

# Not a git repo (or git missing) — nothing to do, and not an error.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
out=$(git pull --ff-only 2>&1); rc=$?
head=$(git log --oneline -1 2>/dev/null || echo '?')

if [ "$rc" -eq 0 ]; then
  status="ok"
  summary="git pull --ff-only on ${branch}: ${out}"
else
  status="FAILED"
  summary="git pull --ff-only FAILED (exit ${rc}) on ${branch}: ${out}"
fi

context="Session-start pull [${status}]. ${summary} HEAD is now ${head}."

# Bash applies backslash processing to the replacement half of
# ${var//pat/repl}, so the obvious spelling silently does the wrong thing:
# ${s//\/\\} replaces a backslash with a backslash (a no-op, which left the
# Windows paths in git's error messages unescaped) and ${s//$'\t'/\t} replaces
# a tab with a bare "t", eating it. Quoting both halves makes them literal.
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

# Quiet when there was nothing to pull; surface every other outcome.
if [ "$rc" -eq 0 ] && [[ "$out" == *"Already up to date"* ]]; then
  printf '{"suppressOutput":true,"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$ctx"
else
  msg=$(json_escape "$summary")
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$msg" "$ctx"
fi
