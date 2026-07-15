#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || realpath "$(dirname "$0")/../../..")"

# Files to update
MANIFESTS=(
  "$ROOT/package.json"
  "$ROOT/apps/client/package.json"
  "$ROOT/apps/server/package.json"
  "$ROOT/packages/common/package.json"
)

echo "Checking latest @vworlds/vecs version..."
LATEST=$(npm view @vworlds/vecs version 2>/dev/null)
echo "Latest: $LATEST"

# Gather all @vworlds/vecs* deps across manifests
PKGS=$(sort -u <(for f in "${MANIFESTS[@]}"; do
  grep -oP '"(?=@vworlds/vecs[^"]*")[^"]*"' "$f" | tr -d '"'
done))

echo "Packages to update:"
echo "$PKGS" | sed 's/^/  /'

# Check each is available at the same latest version
echo ""
for pkg in $PKGS; do
  VER=$(npm view "$pkg" version 2>/dev/null)
  if [ "$VER" != "$LATEST" ]; then
    echo "WARNING: $pkg latest is $VER, not $LATEST"
  else
    echo "OK: $pkg @ $VER"
  fi
done

echo ""
echo "Updating manifests..."
for f in "${MANIFESTS[@]}"; do
  for pkg in $PKGS; do
    # Replace current version with latest using sed (handles both "pkg": "x.y.z" and "pkg": "x.y.z")
    sed -i "s|\"$pkg\": \"[0-9]*\.[0-9]*\.[0-9]*[^\"]*\"|\"$pkg\": \"$LATEST\"|g" "$f"
  done
  echo "  updated $(realpath --relative-to="$ROOT" "$f")"
done

echo ""
echo "Running npm install..."
npm install --silent 2>/dev/null || npm install

echo ""
echo "Verifying..."
npm ls @vworlds/vecs 2>/dev/null | head -20

echo ""
echo "Done. All @vworlds/vecs* packages updated to $LATEST."
