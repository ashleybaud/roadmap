#!/usr/bin/env bash
# Builds index.html from src/ (one self-contained page for Cloudflare Pages), then runs the smoke test.
# Usage: ./build.sh            build + test
#        ./build.sh --no-test  build only
set -euo pipefail
cd "$(dirname "$0")"
node scripts/make-pages.mjs
tmp=$(mktemp)
{ cat src/page.html; echo "<script>"; for f in src/js/*.js; do cat "$f"; echo; done; echo "</script></body></html>"; } > "$tmp"
sed -n '/<script>$/,/<\/script>/p' "$tmp" | sed '1d;$d' > "$tmp.js"
node --check "$tmp.js"
cp "$tmp" index.html; rm -f "$tmp" "$tmp.js"
echo "built index.html"
if [ "${1:-}" != "--no-test" ]; then node tests/smoke.cjs; fi
