#!/bin/sh
# Point git at the versioned hooks in .githooks/. This is a per-repository
# setting; it touches nothing outside this checkout.
#
#   sh tools/install-hooks.sh
#
# The hooks refuse a commit that fails `node --test` or that quietly deletes
# tests, and a push that would delete a file from `main`. Both can be waved
# through with SKIP_TEST_GUARD=1.

set -e
root=$(git rev-parse --show-toplevel)
chmod +x "$root/.githooks/pre-commit" "$root/.githooks/pre-push"
git config core.hooksPath .githooks
echo "hooks installed: $(git config core.hooksPath)"
