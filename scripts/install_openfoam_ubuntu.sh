#!/usr/bin/env bash
set -Eeuo pipefail

# Installation reproductible de la distribution OpenFOAM Foundation v13.
# Référence : https://openfoam.org/download/13-ubuntu/
# Usage : sudo ./scripts/install_openfoam_ubuntu.sh

OPENFOAM_VERSION="${OPENFOAM_VERSION:-13}"
REPO_KEY_URL="https://dl.openfoam.org/gpg.key"
REPO_LINE="http://dl.openfoam.org/ubuntu main dev"

if [[ "${EUID}" -ne 0 ]]; then
  echo "FAIL: exécuter avec sudo" >&2
  exit 2
fi

source /etc/os-release
if [[ "${ID}" != "ubuntu" ]]; then
  echo "FAIL: ce script cible Ubuntu, détecté: ${ID:-UNAVAILABLE}" >&2
  exit 2
fi

case "${VERSION_CODENAME:-}" in
  noble|jammy|plucky|quantal|resolute) ;;
  *) echo "FAIL: version Ubuntu non supportée par ce script: ${VERSION_CODENAME:-UNAVAILABLE}" >&2; exit 2 ;;
esac

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates wget gnupg software-properties-common
install -d -m 0755 /etc/apt/trusted.gpg.d
wget --https-only --secure-protocol=TLSv1_2 -qO /etc/apt/trusted.gpg.d/openfoam.asc "${REPO_KEY_URL}"
rm -f /etc/apt/sources.list.d/*dl_openfoam_org*list
add-apt-repository -y "${REPO_LINE}"
# Le dépôt Foundation documente ce correctif pour les architectures amd64v3.
if grep -Rqs 'amd64v3' /etc/apt/sources.list.d/*dl_openfoam_org*list 2>/dev/null; then
  sed -i 's/^\(deb\).*\(http\)/\1 [arch=amd64] \2/' /etc/apt/sources.list.d/*dl_openfoam_org*list
fi
apt-get update
apt-get install -y "openfoam${OPENFOAM_VERSION}"

PREFIX="/opt/openfoam${OPENFOAM_VERSION}"
[[ -f "${PREFIX}/etc/bashrc" ]] || { echo "FAIL: bashrc absent: ${PREFIX}/etc/bashrc" >&2; exit 1; }

cat > "${PREFIX}/OPENFOAM_INSTALL_RECORD.txt" <<EOF
package=openfoam${OPENFOAM_VERSION}
prefix=${PREFIX}
ubuntu=${VERSION_ID}
codename=${VERSION_CODENAME}
installed_utc=$(date -u +%FT%TZ)
source=${REPO_KEY_URL}
EOF

# Ne modifie pas automatiquement ~/.bashrc : le runner source explicitement cette configuration.
"${PREFIX}/etc/bashrc" >/dev/null 2>&1 || true
source "${PREFIX}/etc/bashrc"
command -v blockMesh >/dev/null || { echo "FAIL: blockMesh introuvable après installation" >&2; exit 1; }
command -v checkMesh >/dev/null || { echo "FAIL: checkMesh introuvable après installation" >&2; exit 1; }
command -v potentialFoam >/dev/null || { echo "FAIL: potentialFoam introuvable après installation" >&2; exit 1; }
foamInstallationTest 2>&1 || true
printf 'PASS: OpenFOAM %s installé et utilitaires disponibles\n' "${OPENFOAM_VERSION}"
