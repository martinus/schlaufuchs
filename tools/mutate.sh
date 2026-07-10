#!/bin/sh
# Break the code on purpose, and prove the test suite notices.
#
# "A bug found is a test written" only holds if the test can fail. This runs the
# check: mutate a file, run the tests, expect red, restore the file.
#
#   sh tools/mutate.sh assets/js/leaveguard.js \
#       's/if \(confirmOpen\) return "stay";\n//' tests/leaveguard.test.js
#
# The restore is a file copy, taken before the mutation and put back by an EXIT
# trap — never `git checkout`, which was tried and which cost an hour. It reverts
# to HEAD, so it silently throws away whatever you had not committed yet, and it
# fails outright on a file git does not track, leaving the mutation in place. A
# copy has neither problem, and does not care about the branch you are on.
#
# Two exit codes carry meaning:
#   1  DECORATION — the tests passed with the code broken. They test nothing.
#   2  the mutation did not apply, so nothing was proven either way.
#
# Choosing the mutation is the whole skill: it has to change what the code
# *does*. Reword a comment and this will report DECORATION, correctly and
# uselessly. Delete the branch the test is named after instead.

set -eu

if [ $# -lt 2 ]; then
  echo "usage: sh tools/mutate.sh <file> <perl-expr> [node --test args…]" >&2
  echo "       perl-expr runs under 'perl -0pi -e', so \\n matches across lines" >&2
  exit 2
fi

file=$1
expr=$2
shift 2

[ -f "$file" ] || { echo "mutate: no such file: $file" >&2; exit 2; }

backup=$(mktemp) || exit 2
cp "$file" "$backup"
# Restore on success, on failure, and on Ctrl-C alike. The file is never left
# broken, so this is safe to run against a dirty tree.
trap 'cp "$backup" "$file"; rm -f "$backup"' EXIT INT TERM

perl -0pi -e "$expr" "$file"

# A pattern that matches nothing leaves the code intact, the tests green, and a
# false sense that they are load-bearing. That is the failure this catches.
if cmp -s "$backup" "$file"; then
  echo "mutate: the expression changed nothing in $file — check the pattern" >&2
  exit 2
fi

echo "--- mutated $file:"
diff -u "$backup" "$file" | sed -n '4,$p' | sed 's/^/    /'

if node --test "$@" >/dev/null 2>&1; then
  echo "DECORATION: the suite passes with $file broken. Those tests prove nothing." >&2
  exit 1
fi

echo "ok: the suite goes red. Restoring $file."
