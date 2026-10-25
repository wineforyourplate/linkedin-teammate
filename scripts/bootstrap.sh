#!/usr/bin/env bash
# Finish an install. After Lemma's GitHub import, run once:
#
#   bash scripts/bootstrap.sh --pod <pod-id> [--server <cli-server>] [--org <org-id>]
#
# Installing from the command line instead? Create an empty pod and add --import:
#
#   bash scripts/bootstrap.sh --pod <pod-id> --import
#
# What it does:
#   1. declares the pod's `linkedin` connector (each person connects their own account), so the
#      LinkedIn grants below resolve
#   2. with --import, imports the whole bundle (tables, functions, agent, workflows, schedules, app)
#   3. creates every folder under files/ and uploads the bundled files (carousel slide system)
#   4. publishes the skills to /skills/<name>/SKILL.md (a system folder an import can't write)
#   5. re-applies functions and agents, which restores their table, folder and connector grants
#   6. builds and deploys the app if it isn't live yet
#
# Safe to re-run: existing folders, files and the connector are kept; skills are refreshed.
# Needs an authenticated Lemma CLI, python3, and Node.js 20+ with npm.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pod=""
full_import=0
server=(lemma)
cli=(lemma)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pod) pod="$2"; shift 2 ;;
    --server) server+=(--server "$2"); cli+=(--server "$2"); shift 2 ;;
    --org) cli+=(--org "$2"); shift 2 ;;
    --import) full_import=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$pod" ]] || { echo "usage: $0 --pod <pod-id> [--import] [--server <name>] [--org <org-id>]" >&2; exit 2; }

lemma_pod() { "${cli[@]}" --pod "$pod" "$@"; }
json_field() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

server_json="$("${server[@]}" servers show --json)"
api_url="$(json_field "d['base_url']['value']" <<<"$server_json")"
auth_url="$(json_field "d['auth_url']['value']" <<<"$server_json")"
org="$("${cli[@]}" --json pods get "$pod" | json_field "d['organization_id']")"

echo "== connectors"
auth_config="$("${cli[@]}" --org "$org" --json connectors auth-configs list | json_field "next((a['id'] for a in d.get('items', []) if a.get('connector_id') == 'linkedin'), '')")"
if [[ -z "$auth_config" ]]; then
  echo "Your organisation has no LinkedIn connector yet. Enable LinkedIn in Lemma's connectors, then run this again." >&2
  exit 1
fi
# The token goes from the CLI straight into the request on stdin: never on disk, never in argv.
"${server[@]}" auth print-token | python3 -c '
import json, sys, urllib.error, urllib.request
api, pod, auth_config = sys.argv[1:4]
body = json.dumps({"slug": "linkedin", "auth_config_id": auth_config, "mode": "PER_MEMBER",
                   "purpose": "Post to LinkedIn as you and read who you are"}).encode()
req = urllib.request.Request(f"{api}/pods/{pod}/connectors", data=body, method="POST",
                             headers={"Authorization": "Bearer " + sys.stdin.read().strip(), "Content-Type": "application/json"})
try:
    urllib.request.urlopen(req)
    print("declared linkedin")
except urllib.error.HTTPError as e:
    text = e.read().decode(errors="replace")
    if e.code == 409 or "exist" in text.lower():
        print("exists   linkedin")
    else:
        sys.exit(f"could not declare the linkedin connector ({e.code}): {text[:300]}")
' "$api_url" "$pod" "$auth_config"

if [[ "$full_import" == 1 ]]; then
  echo "== import"
  VITE_LEMMA_API_URL="$api_url" VITE_LEMMA_AUTH_URL="$auth_url" VITE_LEMMA_POD_ID="$pod" \
    "${cli[@]}" pods import "$repo_root" --pod "$pod" >/dev/null
  echo "imported the bundle"
fi

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
