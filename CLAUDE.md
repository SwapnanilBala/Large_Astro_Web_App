# CLAUDE.md

## Workflow Preferences

- **Start every session with `git pull`, before reading or changing anything.** A clean `git status` does not mean the branch is current — `main` here is routinely many commits behind `origin/main` at session start, because work lands between sessions. Pull first, then investigate, then commit. Reading the code before pulling produces a diagnosis of a tree that no longer exists, and the push gets rejected at the end anyway.

- **All changes should be merged to `main` and committed/pushed to GitHub by default.** When finishing work, always commit to `main` and push to the remote repository unless instructed otherwise.

- **Commit only what this session actually worked on.** Stage explicit paths rather than `git add -A`: the working tree often carries unrelated work in progress, which is not ours to push.
