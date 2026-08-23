#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGETS=("$ROOT/apps/web/app" "$ROOT/apps/web/components")
PATTERN='industrial-3d-visualizer-|generatePureVolumetricGrid|new THREE\.Points|PointsMaterial|MarchingCubes'

matches="$(grep -RInE --include='*.ts' --include='*.tsx' --exclude='tsconfig.tsbuildinfo' --exclude-dir=node_modules --exclude-dir='__tests__' "$PATTERN" "${TARGETS[@]}" || true)"

if [[ -n "$matches" ]]; then
  echo "Legacy CFD rendering path detected in production sources:"
  echo "$matches"
  exit 1
fi

echo "CFD render-path guard passed: production sources use no legacy visualizer or point-cloud primitive."
