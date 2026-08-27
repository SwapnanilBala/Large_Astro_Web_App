# CLAUDE.md

## Workflow Preferences

- **Start every session with `git pull`, before reading or changing anything.** A clean `git status` does not mean the branch is current — `main` here is routinely many commits behind `origin/main` at session start, because work lands between sessions. Pull first, then investigate, then commit. Reading the code before pulling produces a diagnosis of a tree that no longer exists, and the push gets rejected at the end anyway.

- **Work on a branch, then merge to `main` at the end.** Cut it from an up-to-date `main` (`git checkout -b <type>/<short-name>` — `fix/`, `chore/`, `feat/`), commit there, and merge into `main` and push once the work is done and verified. Do not commit directly to `main`. The end state is unchanged — the work lands on `main` and is pushed to GitHub by default, unless instructed otherwise — but it gets there through a branch, so an unfinished or wrong change is a branch to abandon rather than a commit to revert.

- **Cut the branch from a current `main`, not just any `main`.** A feature branch taken from a stale `main` reproduces the staleness problem one level up, and it stays invisible until the merge. The session-start hook reports "N behind origin/main" for exactly this; if it says so, rebase or re-cut before going further.

- **Commit only what this session actually worked on.** Stage explicit paths rather than `git add -A`: the working tree often carries unrelated work in progress, which is not ours to push.
