#!/usr/bin/env bash
set -e

echo "=== 🛡️ Quantum-PINN Local Pre-Flight Check ==="
echo "1. Running TypeScript type check..."
cd apps/web
pnpm exec tsc --noEmit
cd ../..

echo "2. Running Next.js production build..."
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--max-old-space-size=2048" pnpm --dir apps/web run build

echo "✅ All local pre-flight checks passed successfully!"
