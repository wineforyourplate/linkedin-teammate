#!/usr/bin/env bash
# Copy the post-format craft from Content Factory, the source of truth for how
# carousels and claim images are made: the slide system (/templates) and the
# format skills. Lemma's own taste (/house) is never copied. Maintainers only.
#   CF=<path to a content-factory pod bundle> ./scripts/sync-formats.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CF="${CF:?set CF to a content-factory pod bundle}"
[ -d "$CF/files/templates" ] || { echo "Content Factory not found at $CF" >&2; exit 1; }
# Our render.py carries the brand kit (headshot, name, logo, wordmark, fonts, colours).
# Until Content Factory's renderer has it too, keep ours and say so.
KEEP=""
if grep -q brand_kit_css "$HERE/files/templates/render.py" 2>/dev/null && ! grep -q brand_kit_css "$CF/files/templates/render.py"; then
  KEEP="$(mktemp)"; cp "$HERE/files/templates/render.py" "$KEEP"
fi
rm -rf "$HERE/files/templates"
mkdir -p "$HERE/files/templates" "$HERE/skills"
cp -R "$CF/files/templates/." "$HERE/files/templates/"
if [ -n "$KEEP" ]; then
  cp "$KEEP" "$HERE/files/templates/render.py"; rm -f "$KEEP"
  echo "kept this pod's render.py (brand kit); Content Factory's renderer doesn't have it yet" >&2
fi
find "$HERE/files/templates" -name '.DS_Store' -delete
for s in carousel claim-image; do
  mkdir -p "$HERE/skills/$s"
  cp "$CF/seed/skills/$s/SKILL.md" "$HERE/skills/$s/SKILL.md"
done
echo "synced templates and skills (carousel, claim-image) from $CF"
