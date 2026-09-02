#!/usr/bin/env bash
set -Eeuo pipefail

# Exécute la séquence LH2 dans une VM OpenFOAM configurée :
# 1) préflight et compilation de la bibliothèque CoolProp;
# 2) cas sans wall-boiling;
# 3) cas wall-boiling sur wall1 uniquement;
# 4) post-traitement des résidus/bilans et manifest SHA-256.
# Le script est fail-closed : un NaN/Inf/FPE ou une commande échouée arrête la séquence.

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BASE_CASE="${BASE_CASE:-$REPO_DIR/pilot_case/PILOT-LH2-001/openfoam_wallBoiling_base}"
RUN_ROOT="${RUN_ROOT:-$REPO_DIR/pilot_case/PILOT-LH2-001/runs}"
LIB_DIR="${LIB_DIR:-$REPO_DIR/tools/openfoam_coolprop_lib}"
PATCH_FILE="${PATCH_FILE:-$REPO_DIR/tools/openfoam_coolprop_dynamic_bounds.clean.patch}"
TIMEOUT_SEC="${TIMEOUT_SEC:-1800}"
MASS_TOL="${MASS_TOL:-1e-6}"
ENERGY_TOL="${ENERGY_TOL:-1e-6}"
WALL_PATCH="${WALL_PATCH:-wall1}"
SOLVER="${SOLVER:-reactingTwoPhaseEulerFoam}"

log() { printf '[lh2] %s\n' "$*"; }
die() { printf '[lh2][FAIL] %s\n' "$*" >&2; exit 2; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || die "commande absente: $1"; }

[[ -d "$BASE_CASE" ]] || die "cas absent: $BASE_CASE"
[[ -f "$BASE_CASE/0.orig/alpha.gas" ]] || die "0.orig/alpha.gas absent"
[[ -f "$BASE_CASE/0.orig/alpha.liquid" ]] || die "0.orig/alpha.liquid absent"
[[ -f "$BASE_CASE/system/controlDict" ]] || die "system/controlDict absent"
[[ -f "$PATCH_FILE" ]] || die "patch C++ absent: $PATCH_FILE"

require_cmd python3
require_cmd sha256sum
require_cmd timeout
require_cmd "$SOLVER"
require_cmd foamDictionary
require_cmd wmake

mkdir -p "$RUN_ROOT"

log "Préflight OpenFOAM"
foamVersion | tee "$RUN_ROOT/foamVersion.txt"
"$SOLVER" -help >"$RUN_ROOT/solver_help.txt" 2>&1 || true

log "Application du patch C++ avec sauvegarde"
TARGET_HEADER="$LIB_DIR/openfoam_coolPropThermo.H"
[[ -f "$TARGET_HEADER" ]] || die "adaptateur absent: $TARGET_HEADER"
if ! git -C "$REPO_DIR" diff --quiet -- "$TARGET_HEADER"; then
  die "adaptateur déjà modifié; commit/stash requis avant application"
fi
cp -p "$TARGET_HEADER" "$TARGET_HEADER.pre-lh2-patch"
git -C "$REPO_DIR" apply --check "$PATCH_FILE"
git -C "$REPO_DIR" apply "$PATCH_FILE"

log "Compilation CoolProp/OpenFOAM"
(
  cd "$LIB_DIR"
  wmake libso 2>&1 | tee "$RUN_ROOT/wmake_coolprop.log"
)
LIB_PATH="$LIB_DIR/platforms/${WM_OPTIONS:-linux64GccDPInt32Opt}/lib"
if compgen -G "$LIB_PATH/*lh2*CoolProp*.so" >/dev/null; then
  for so in "$LIB_PATH"/*lh2*CoolProp*.so; do
    ldd "$so" | tee -a "$RUN_ROOT/ldd_coolprop.log"
    grep -q 'not found' "$RUN_ROOT/ldd_coolprop.log" && die "dépendance dynamique manquante pour $so"
  done
fi
export LD_LIBRARY_PATH="$LIB_PATH:${LD_LIBRARY_PATH:-}"

prepare_case() {
  local name="$1"
  local mode="$2"
  local out="$RUN_ROOT/$name"
  rm -rf "$out"
  cp -a "$BASE_CASE" "$out"
  rm -rf "$out"/processor* "$out"/postProcessing
  # Ne jamais reprendre un temps calculé : repartir de 0.orig.
  rm -rf "$out/0"
  cp -a "$out/0.orig" "$out/0"
  foamDictionary "$out/0/alpha.gas" -entry internalField -set 'uniform 0.01'
  foamDictionary "$out/0/alpha.liquid" -entry internalField -set 'uniform 0.99'
  foamDictionary "$out/system/controlDict" -entry maxCo -set 0.02
  foamDictionary "$out/system/controlDict" -entry deltaT -set 1e-6
  foamDictionary "$out/system/controlDict" -entry maxDeltaT -set 1e-4

  if [[ "$mode" == "no-wall-boiling" ]]; then
    foamDictionary "$out/constant/phaseProperties" -entry phaseChange -set off
    foamDictionary "$out/0/alphat.gas" -entry 'boundaryField.wall1.type' -set calculated
    foamDictionary "$out/0/alphat.gas" -entry 'boundaryField.wall2.type' -set calculated
    foamDictionary "$out/0/alphat.liquid" -entry 'boundaryField.wall1.type' -set calculated
    foamDictionary "$out/0/alphat.liquid" -entry 'boundaryField.wall2.type' -set calculated
  elif [[ "$mode" == "wall1-only" ]]; then
    foamDictionary "$out/constant/phaseProperties" -entry phaseChange -set on
    foamDictionary "$out/0/alphat.gas" -entry 'boundaryField.wall2.type' -set calculated
    foamDictionary "$out/0/alphat.liquid" -entry 'boundaryField.wall2.type' -set calculated
  else
    die "mode inconnu: $mode"
  fi
  printf '%s\n' "$out"
}

run_case() {
  local name="$1"
  local out="$RUN_ROOT/$name"
  local mode="$2"
  prepare_case "$name" "$mode" >/dev/null
  log "Exécution $name ($mode)"
  (
    cd "$out"
    set -o pipefail
    timeout --signal=TERM "$TIMEOUT_SEC" "$SOLVER" 2>&1 | tee run.log
    rc=${PIPESTATUS[0]}
    if grep -Eiq '(^|[^a-z])(nan|inf|-inf|floating point exception|sigfpe)([^a-z]|$)' run.log; then
      echo 'FAIL_NONFINITE_OR_FPE' > run_status.txt
      exit 20
    fi
    printf 'solver_exit=%s\n' "$rc" > run_status.txt
    exit "$rc"
  )
  python3 "$REPO_DIR/tools/postprocess_openfoam_balances.py" \
    --log "$out/run.log" \
    --balance-csv "$out/postProcessing/balances.csv" \
    --mass-tolerance "$MASS_TOL" \
    --energy-tolerance "$ENERGY_TOL" \
    --output "$out/postProcessing/balance_report.json"
  (
    cd "$out"
    find . -type f -not -path './postProcessing/balance_report.json' -print0 \
      | sort -z | xargs -0 sha256sum > manifest.sha256
  )
}

run_case 01_no_wallboiling no-wall-boiling
run_case 02_wall1_only wall1-only

log "Séquence terminée : vérifier les deux balance_report.json et manifests.sha256."
log "Aucune décision scientifique PASS n'est émise automatiquement par ce script."
