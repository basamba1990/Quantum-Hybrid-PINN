#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PILOT="$ROOT/pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER"
OUT="${1:-$PILOT/benchmark/run/synthetic_vof_reference}"
SRC="$ROOT/artifacts/synthetic_lh2_vtu"

rm -rf "$OUT"
mkdir -p "$OUT"
cp "$SRC"/frame_*.vtu "$SRC"/sidecar.json "$OUT"/

python3 "$PILOT/benchmark/scripts/generate_sidecar.py" "$OUT"
python3 "$PILOT/benchmark/scripts/verify_sidecar.py" "$OUT"

printf '\nArtefacts prêts pour import local : %s\n' "$OUT"
printf 'Sidecar : %s/sidecar.json\n' "$OUT"
printf 'Statut scientifique : STRUCTURAL_TEST_UNVALIDATED (pas une simulation VOF physique)\n'
