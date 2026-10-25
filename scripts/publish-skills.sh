#!/usr/bin/env bash
# Publish this pod's skills to /skills/<name>/SKILL.md. Pod skills are files in a
# system folder, so a bundle import can't write them; this script can. Safe to re-run.
#   SERVER=<server> ORG=<org-id> POD=<pod-id> ./scripts/publish-skills.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
L=(lemma)
[ -n "${SERVER:-}" ] && L+=(--server "$SERVER")
[ -n "${ORG:-}" ] && L+=(--org "$ORG")
[ -n "${POD:-}" ] && L+=(--pod "$POD")
for dir in "$HERE"/skills/*/; do
  name="$(basename "$dir")"
  "${L[@]}" files mkdir "/skills/$name" >/dev/null 2>&1 || true
  "${L[@]}" files write "/skills/$name/SKILL.md" --from "$dir/SKILL.md" --no-search >/dev/null
  echo "published /skills/$name"
done
