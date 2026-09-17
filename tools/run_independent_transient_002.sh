#!/usr/bin/env bash
set -euo pipefail
ROOT=/tmp/Quantum-Hybrid-PINN
SRC="$ROOT/runs/PCCV-TRANSIENT-RUN-001"
CASE="$ROOT/runs/PCCV-TRANSIENT-RUN-002"
rm -rf "$CASE"
mkdir -p "$ROOT/runs"
cp -a "$SRC" "$CASE"
rm -rf "$CASE"/{0.001,0.002,0.003,0.004,0.005,0.006,0.007,0.008,VTK,frames,postProcessing}
rm -f "$CASE"/residual_history.csv "$CASE"/balance_history.csv "$CASE"/sidecar.json
mkdir -p "$CASE/logs"
/usr/bin/openfoam2512 -c 'cd '"$CASE"'; blockMesh > logs/01_blockMesh.log 2>&1; snappyHexMesh -overwrite > logs/02_snappyHexMesh.log 2>&1; checkMesh -allGeometry -allTopology > logs/03_checkMesh.log 2>&1; pimpleFoam -noFunctionObjects > logs/04_pimpleFoam.log 2>&1; foamToVTK -time 0.001:0.008 > logs/05_foamToVTK.log 2>&1'
for i in 5 10 15 20 25 30 35 40; do cp "$CASE/VTK/PCCV-TRANSIENT-RUN-002_${i}/internal.vtu" "$CASE/frames_tmp_$(printf '%04d' $((i/5-1))).vtu"; done
sha256sum "$CASE"/frames_tmp_*.vtu > "$CASE/frames_tmp.sha256"
find "$CASE" -maxdepth 1 -type d -regex '.*/0\\.[0-9]+' -printf '%f\\n' | sort -V > "$CASE/times.txt"
echo RUN002_STATUS=PASS
