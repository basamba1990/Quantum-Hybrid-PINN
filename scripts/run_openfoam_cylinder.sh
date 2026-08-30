#!/usr/bin/env bash
set -Eeuo pipefail

# Exécute le cas officiel potentialFoam/cylinder dans un répertoire propre.
# Usage : ./scripts/run_openfoam_cylinder.sh [run_directory]

RUN_DIR="${1:-pilot_case/runs/OPENFOAM-CYLINDER-001}"
OPENFOAM_VERSION="${OPENFOAM_VERSION:-13}"
PREFIX="${OPENFOAM_PREFIX:-/opt/openfoam${OPENFOAM_VERSION}}"
TUTORIAL="${OPENFOAM_TUTORIAL:-${PREFIX}/tutorials/potentialFoam/cylinder}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "${RUN_DIR}")"

if [[ ! -f "${PREFIX}/etc/bashrc" ]]; then
  echo "FAIL: OpenFOAM non installé: ${PREFIX}/etc/bashrc" >&2
  exit 2
fi
set +e
set +u
# shellcheck disable=SC1090
source "${PREFIX}/etc/bashrc"
source_rc=$?
set -u
set -e
[[ "${source_rc}" -eq 0 || -n "${WM_PROJECT_DIR:-}" ]] || { echo "FAIL: chargement du bashrc OpenFOAM échoué" >&2; exit 2; }
for cmd in blockMesh checkMesh potentialFoam; do
  command -v "${cmd}" >/dev/null || { echo "FAIL: commande absente: ${cmd}" >&2; exit 2; }
done
[[ -d "${TUTORIAL}" ]] || { echo "FAIL: tutoriel absent: ${TUTORIAL}" >&2; exit 2; }

rm -rf "${RUN_DIR}"
mkdir -p "${RUN_DIR}"
cp -a "${TUTORIAL}/." "${RUN_DIR}/"
printf 'run_id=OPENFOAM-CYLINDER-001\nopenfoam_prefix=%s\ntutorial=%s\nstarted_utc=%s\n' "${PREFIX}" "${TUTORIAL}" "$(date -u +%FT%TZ)" > "${RUN_DIR}/runtime_manifest.txt"

cd "${RUN_DIR}"
blockMesh 2>&1 | tee blockMesh.log
checkMesh 2>&1 | tee checkMesh.log
if grep -Eiq 'Failed|FOAM FATAL ERROR|error in mesh' checkMesh.log; then
  echo "FAIL: checkMesh a signalé une erreur critique" >&2
  exit 1
fi
potentialFoam 2>&1 | tee potentialFoam.log
if ! grep -Eq 'End$|ExecutionTime|ClockTime' potentialFoam.log; then
  echo "FAIL: marqueur explicite de fin OpenFOAM absent" >&2
  exit 1
fi

printf 'status=PASS\ncompleted_utc=%s\n' "$(date -u +%FT%TZ)" >> runtime_manifest.txt
sha256sum blockMesh.log checkMesh.log potentialFoam.log runtime_manifest.txt > output_hashes.sha256
sha256sum runtime_manifest.txt > runtime_manifest.sha256
printf 'PASS: cas cylindre exécuté dans %s\n' "${RUN_DIR}"
