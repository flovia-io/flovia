#!/usr/bin/env bash
# Stage publishable npm packages from the build output.
# Usage: bash scripts/stage-packages.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "── Staging flovia-cli package ──"
CLI_PKG="$ROOT/cli"
rm -rf "$CLI_PKG/dist-cli"
cp -r "$ROOT/dist-cli" "$CLI_PKG/dist-cli"
# Ensure shebang + executable
chmod +x "$CLI_PKG/dist-cli/cli/index.js"
echo "   ✔ dist-cli → cli/dist-cli"

echo "── Staging flovia launcher package ──"
chmod +x "$ROOT/bin/launch.js"
echo "   ✔ bin/launch.js is ready"

echo ""
echo "Done. Packages ready to publish:"
echo "  npm publish --access public              (root — @flovia-io/flovia)"
echo "  cd cli && npm publish --access public    (@flovia-io/cli)"
