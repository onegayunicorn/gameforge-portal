#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "=== Universal Game Platform — Bootstrap ==="
corepack enable
corepack prepare pnpm@8.12.0 --activate
pnpm install --frozen-lockfile
echo "=== Bootstrap complete ==="
