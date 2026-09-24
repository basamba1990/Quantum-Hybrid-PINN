#!/usr/bin/env bash
set -euo pipefail

# Installation reproductible OpenFOAM Foundation 12 sur Ubuntu 24.04 (noble).
# Les binaires sont installés par APT, pas versionnés dans Git.
if [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

${SUDO} apt-get update
${SUDO} apt-get install -y software-properties-common wget ca-certificates gnupg python3-venv
${SUDO} sh -c 'wget -qO- https://dl.openfoam.org/gpg.key > /etc/apt/trusted.gpg.d/openfoam.asc'
${SUDO} add-apt-repository -y http://dl.openfoam.org/ubuntu
${SUDO} apt-add-repository -y universe
${SUDO} apt-get update
${SUDO} apt-get install -y openfoam12

PROFILE_LINE='. /opt/openfoam12/etc/bashrc'
if ! grep -Fqx "$PROFILE_LINE" "$HOME/.bashrc" 2>/dev/null; then
  printf '\n%s\n' "$PROFILE_LINE" >> "$HOME/.bashrc"
fi

# shellcheck disable=SC1091
. /opt/openfoam12/etc/bashrc
for app in foamMultiRun chtMultiRegionFoam multiphaseInterFoam splitMeshRegions foamToVTK; do
  command -v "$app" >/dev/null || { echo "Missing OpenFOAM command: $app" >&2; exit 1; }
done
printf 'OpenFOAM %s ready: %s\n' "${WM_PROJECT_VERSION:-unknown}" "${WM_PROJECT_DIR:-unknown}"

# L’environnement séparé évite de mélanger NumPy 2 avec le SciPy système compilé
# pour NumPy 1.x. Il est utilisé par le modèle thermo-CHT réduit et les outils
# d’analyse, pas par le solveur OpenFOAM.
VENV="${LH2_CHT_VENV:-$HOME/.venvs/lh2-cht}"
python3 -m venv --clear "$VENV"
"$VENV/bin/python" -m pip install --upgrade pip
"$VENV/bin/python" -m pip install 'numpy<2' 'scipy<1.14' CoolProp
"$VENV/bin/python" -c 'import numpy, scipy; from CoolProp.CoolProp import PropsSI; print("Python CHT env:", numpy.__version__, scipy.__version__, "Tsat=", PropsSI("T", "P", 101325, "Q", 0, "ParaHydrogen"), "K")'
printf 'Installation and smoke checks completed. Use: source %s/bin/activate\n' "$VENV"
