#!/bin/sh
# Makes the checkout `npm run site:upgrade` runs from: an exact copy of ONE
# commit (never the shared working tree, which holds other sessions'
# uncommitted edits), with the dependencies linked in. publish refuses any
# other checkout (source.js checks every file against SOURCE_TREE).
#
#   sh scripts/site-upgrade/mirror.sh <repo> <commit> <new mirror dir> <node_modules dir> [<netlify/functions node_modules dir>]
#
# <commit>: the commit production runs (Netlify > Deploys > the published
# deploy, or the Netlify MCP's deploy commit_ref). The mirror dir must not
# exist yet, or be empty, and must be outside the repo. Nothing in the repo
# is changed: git only reads it.
set -eu

if [ "$#" -lt 4 ]; then
  echo "usage: mirror.sh <repo> <commit> <new mirror dir> <node_modules dir> [<functions node_modules dir>]" >&2
  exit 2
fi
repo=$1
commit=$2
mirror=$3
deps=$4
fndeps=${5:-}

sha=$(git -C "$repo" rev-parse --verify --quiet "$commit^{commit}") || { echo "mirror.sh: no commit $commit in $repo" >&2; exit 2; }
[ -d "$deps" ] || { echo "mirror.sh: $deps is not a node_modules folder" >&2; exit 2; }

if [ -e "$mirror" ] && [ -n "$(ls -A "$mirror")" ]; then
  echo "mirror.sh: $mirror is not empty; pick a new folder" >&2
  exit 2
fi
mkdir -p "$mirror"
repo_abs=$(cd "$repo" && pwd -P)
mirror_abs=$(cd "$mirror" && pwd -P)
case "$mirror_abs/" in
  "$repo_abs"/*) echo "mirror.sh: the mirror must be outside the repo" >&2; rmdir "$mirror" 2>/dev/null || true; exit 2 ;;
esac

git -C "$repo" archive --format=tar "$sha" | tar -x -C "$mirror_abs"
git -C "$repo" -c core.quotePath=false ls-tree -r --full-tree "$sha" > "$mirror_abs/SOURCE_TREE"
echo "$sha" > "$mirror_abs/SOURCE_COMMIT"
ln -s "$deps" "$mirror_abs/node_modules"
if [ -n "$fndeps" ]; then
  ln -s "$fndeps" "$mirror_abs/netlify/functions/node_modules"
fi
echo "Mirror of $sha in $mirror_abs"
echo "Next: cd \"$mirror_abs\" && npm run site:upgrade -- plan --inputs <export file>"
