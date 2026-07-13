#!/bin/sh
# The whole PR loop of this repo, as one command:
#
#   sh tools/pr.sh [--title "…"] [--body <file>] [--no-merge] [--keep-branch]
#                  [--allow-deletions]
#
# push the current branch → open (or reuse) its PR → wait for CI → squash-merge
# → watch the deploy that follows on main → report the live version → prune the
# merged branch. Run from the feature branch with everything committed.
#
# Defaults come from the branch's last commit: its subject is the PR title, its
# body the PR body — write the commit message properly and the PR writes
# itself. `--no-merge` stops after CI (open the PR for review instead);
# `--keep-branch` skips the final cleanup.
#
# Why it exists: this exact sequence was hand-rolled a dozen times in one
# session — each time with the same 15-second polling boilerplate, twice with a
# typo in the hand-pasted PR body. The guards encode the repo's burnt fingers
# (CLAUDE.md): never PR from main, never with uncommitted work, and never
# without reading what the diff DELETES — an unexpected deletion here has
# nearly undone a neighbour's merge before.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

title=""
bodyfile=""
merge=1
tidy=1
allow_deletions=0
while [ $# -gt 0 ]; do
  case "$1" in
    --title) title=$2; shift 2 ;;
    --body) bodyfile=$2; shift 2 ;;
    --no-merge) merge=0; shift ;;
    --keep-branch) tidy=0; shift ;;
    --allow-deletions) allow_deletions=1; shift ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "pr: unknown option '$1' (try --help)" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null || { echo "pr: needs the gh CLI." >&2; exit 1; }

# ── pre-flight: the guards that were each learned the hard way ───────────────
branch=$(git branch --show-current)
default=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)

[ -n "$branch" ] || { echo "pr: detached HEAD — check out a feature branch first." >&2; exit 1; }
[ "$branch" != "$default" ] || { echo "pr: refusing to PR from '$default' — branch first." >&2; exit 1; }

if [ -n "$(git status --porcelain)" ]; then
  echo "pr: the working tree is not clean — commit (or stash) first:" >&2
  git status --short >&2
  exit 1
fi

git fetch origin -q
ahead=$(git rev-list --count "origin/$default..HEAD")
[ "$ahead" -gt 0 ] || { echo "pr: nothing to PR — no commits beyond origin/$default." >&2; exit 1; }

# An unexpected deletion is how a neighbour's merge gets undone. Name every
# deleted file and stop; --allow-deletions says "yes, I read the list".
deleted=$(git diff --diff-filter=D --name-only "origin/$default..HEAD")
if [ -n "$deleted" ] && [ "$allow_deletions" -eq 0 ]; then
  echo "pr: this PR would DELETE files — re-run with --allow-deletions if that is meant:" >&2
  echo "$deleted" | sed 's/^/       /' >&2
  exit 1
fi

# ── push, then open or reuse the PR ──────────────────────────────────────────
git push -u origin "$branch"

pr=$(gh pr view "$branch" --json number,state -q 'select(.state == "OPEN") | .number' 2>/dev/null || true)
if [ -n "$pr" ]; then
  echo "pr: reusing open PR #$pr"
else
  [ -n "$title" ] || title=$(git log -1 --format=%s)
  if [ -n "$bodyfile" ]; then
    pr_url=$(gh pr create --title "$title" --body-file "$bodyfile")
  else
    # The last commit's body IS the PR body — write the commit well once.
    # mktemp, not a path under .git: in a WORKTREE .git is a pointer FILE,
    # and `> .git/…` dies with "Not a directory" (found by this tool's own
    # first run, shipping itself).
    body=$(mktemp -t pr-body-XXXXXX)
    git log -1 --format=%b > "$body"
    pr_url=$(gh pr create --title "$title" --body-file "$body")
    rm -f "$body"
  fi
  pr=${pr_url##*/}
  echo "pr: opened $pr_url"
fi

# ── CI: block until every check settles; a red check aborts with the PR open ─
sleep 5 # give the checks a beat to register, or --watch sees an empty list
echo "pr: waiting for checks on #$pr …"
gh pr checks "$pr" --watch --fail-fast || {
  echo "pr: checks FAILED — #$pr stays open for inspection." >&2
  exit 1
}

if [ "$merge" -eq 0 ]; then
  echo "pr: --no-merge — #$pr is green and waiting for review."
  exit 0
fi

# ── merge, then watch the deploy the merge just triggered ────────────────────
merged_at=$(date -u +%s)
gh pr merge "$pr" --squash
echo "pr: #$pr squash-merged."

run=""
tries=0
while [ -z "$run" ] && [ "$tries" -lt 12 ]; do
  sleep 5
  tries=$((tries + 1))
  run=$(gh run list --workflow deploy.yml --branch "$default" --limit 1 \
    --json databaseId,createdAt \
    -q "map(select((.createdAt | fromdate) >= $merged_at)) | .[0].databaseId" 2>/dev/null || true)
done
if [ -z "$run" ]; then
  echo "pr: merged, but no deploy run appeared within a minute — check 'gh run list' yourself." >&2
  exit 1
fi

echo "pr: watching deploy run $run …"
gh run watch "$run" --exit-status >/dev/null || {
  echo "pr: the DEPLOY failed — read: gh run view $run --log-failed" >&2
  exit 1
}

# the live proof: the published site must carry a fresh, real version (§9.2)
host=$(cat CNAME 2>/dev/null || true)
if [ -n "$host" ]; then
  live=$(curl -fsS "https://$host/?pr=$(date +%s)" | grep -o 'v=[a-z0-9]*' | sort -u | head -1)
  echo "pr: deploy green — $host serves ${live:-<no version found?>}."
else
  echo "pr: deploy green."
fi

# ── tidy: the remote branch auto-deletes; drop the local one too ─────────────
if [ "$tidy" -eq 1 ]; then
  git fetch origin --prune -q
  git checkout --detach "origin/$default" -q
  git branch -D "$branch" -q
  echo "pr: pruned '$branch'; you are on origin/$default (detached). Branch again to start the next one."
else
  echo "pr: done ('$branch' kept, remote may already be auto-deleted)."
fi
