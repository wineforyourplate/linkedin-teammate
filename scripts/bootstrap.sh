#!/usr/bin/env bash
# Finish an install from the Lemma frontend. Run once after the import:
#
#   bash scripts/bootstrap.sh --pod <pod-id> [--server <cli-server>] [--org <org-id>]
#
# The frontend import leaves a few things undone; this script:
#   1. creates every folder under files/ (each has a .folder.json)
#   2. uploads the bundled files (carousel slide system and renderer)
#   3. publishes the skills to /skills/<name>/SKILL.md (a system folder an import can't write)
#   4. re-applies functions and agents, which restores their table, folder and connector grants
#   5. builds and deploys the app if it isn't live yet
#
# Safe to re-run: existing folders and files are skipped; skills are refreshed.
# Needs an authenticated Lemma CLI, python3, and Node.js 20+ with npm for step 5.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pod=""
server=(lemma)
cli=(lemma)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pod) pod="$2"; shift 2 ;;
    --server) server+=(--server "$2"); cli+=(--server "$2"); shift 2 ;;
    --org) cli+=(--org "$2"); shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$pod" ]] || { echo "usage: $0 --pod <pod-id> [--server <name>] [--org <org-id>]" >&2; exit 2; }

lemma_pod() { "${cli[@]}" --pod "$pod" "$@"; }
json_field() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

echo "== folders"
while IFS= read -r folder_json; do
  remote="/$(dirname "${folder_json#"$repo_root/files/"}")"
  if out="$(lemma_pod files mkdir "$remote" 2>&1)"; then
    echo "created $remote"
  elif grep -qi -E "exist|409|conflict" <<<"$out"; then
    echo "exists  $remote"
  else
    echo "$out" >&2; exit 1
  fi
done < <(find "$repo_root/files" -name .folder.json | sort)

echo "== files"
while IFS= read -r local_path; do
  remote="/${local_path#"$repo_root/files/"}"
  lemma_pod files mkdir "$(dirname "$remote")" >/dev/null 2>&1 || true
  if out="$(lemma_pod files upload "$local_path" "$remote" 2>&1)"; then
    echo "uploaded $remote"
  elif grep -qi -E "exist|409|conflict" <<<"$out"; then
    echo "exists   $remote"
  else
    echo "$out" >&2; exit 1
  fi
done < <(find "$repo_root/files" -type f ! -name '.*' | sort)

echo "== skills"
for dir in "$repo_root"/skills/*/; do
  name="$(basename "$dir")"
  lemma_pod files mkdir "/skills/$name" >/dev/null 2>&1 || true
  lemma_pod files write "/skills/$name/SKILL.md" --from "$dir/SKILL.md" --no-search >/dev/null
  echo "published /skills/$name"
done

echo "== grants"
for resource in functions agents; do
  out="$("${cli[@]}" pods import "$repo_root/$resource" --pod "$pod" 2>&1)" || { echo "$out" >&2; exit 1; }
  echo "re-applied $resource"
done

echo "== app"
source="$repo_root/apps/teammate/source"
server_json="$("${server[@]}" servers show --json)"
api_url="$(json_field "d['base_url']['value']" <<<"$server_json")"
auth_url="$(json_field "d['auth_url']['value']" <<<"$server_json")"
status="$(lemma_pod apps get teammate --json 2>/dev/null | json_field "d.get('status')" || echo MISSING)"
if [[ "$status" == "READY" ]]; then
  echo "ready    teammate"
else
  echo "deploying teammate (was $status)"
  (
    cd "$source"
    export VITE_LEMMA_API_URL="$api_url" VITE_LEMMA_AUTH_URL="$auth_url" VITE_LEMMA_POD_ID="$pod"
    npm ci --no-audit --no-fund >/dev/null
    npm run build >/dev/null
    "${cli[@]}" --pod "$pod" apps deploy teammate --dist-dir dist -y >/dev/null
  )
  echo "deployed teammate"
fi

"${cli[@]}" pods doctor "$pod" | tail -1
echo "Install finished. Open the teammate app and say hello to Spool."
