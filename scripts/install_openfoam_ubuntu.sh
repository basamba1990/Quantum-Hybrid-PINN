#!/usr/bin/env bash
set -Eeuo pipefail

# Installe OpenFOAM Foundation 13 sur Ubuntu 22.04/24.04/25.04/25.10/26.04.
# Référence officielle : https://openfoam.org/download/13-ubuntu/
# Usage : sudo ./scripts/install_openfoam_ubuntu.sh
# Variables optionnelles : OPENFOAM_VERSION=13 APT_RETRIES=5

OPENFOAM_VERSION="${OPENFOAM_VERSION:-13}"
APT_RETRIES="${APT_RETRIES:-5}"
REPO_HOST="dl.openfoam.org"
REPO_KEY_URL="https://${REPO_HOST}/gpg.key"
REPO_FILE="/etc/apt/sources.list.d/openfoam.list"
KEY_FILE="/etc/apt/trusted.gpg.d/openfoam.asc"
PREFIX="/opt/openfoam${OPENFOAM_VERSION}"

fail() { echo "FAIL: $*" >&2; exit 1; }
info() { printf '[openfoam-install] %s\n' "$*"; }

[[ "${EUID}" -eq 0 ]] || fail "exécuter avec sudo"
[[ "$(uname -m)" == "x86_64" ]] || fail "architecture x86_64 requise, détecté: $(uname -m)"
source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || fail "Ubuntu requis, détecté: ${ID:-UNAVAILABLE}"
case "${VERSION_CODENAME:-}" in
  jammy|noble|plucky|quantal|resolute) ;;
  *) fail "version Ubuntu non couverte par OpenFOAM 13: ${VERSION_CODENAME:-UNAVAILABLE}" ;;
esac

export DEBIAN_FRONTEND=noninteractive
APT=(apt-get -o Acquire::Retries="${APT_RETRIES}" -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30)

info "Mise à jour des dépôts Ubuntu"
"${APT[@]}" update || fail "apt update initial échoué; vérifier DNS, proxy et accès HTTPS/HTTP"
"${APT[@]}" install -y --no-install-recommends ca-certificates wget gnupg

info "Téléchargement et installation de la clé publique OpenFOAM"
install -d -m 0755 "$(dirname "${KEY_FILE}")"
tmp_key="$(mktemp)"
trap 'rm -f "${tmp_key}"' EXIT
wget --https-only --secure-protocol=TLSv1_2 --timeout=30 --tries="${APT_RETRIES}" -qO "${tmp_key}" "${REPO_KEY_URL}" \
  || fail "clé OpenFOAM inaccessible: ${REPO_KEY_URL}"
test -s "${tmp_key}" || fail "clé OpenFOAM vide"
install -m 0644 "${tmp_key}" "${KEY_FILE}"

info "Configuration du dépôt signé OpenFOAM"
cat > "${REPO_FILE}" <<EOF
# OpenFOAM Foundation packages; repository authenticated by ${KEY_FILE}
deb [arch=amd64 signed-by=${KEY_FILE}] http://${REPO_HOST}/ubuntu ${VERSION_CODENAME} main dev
EOF

info "Mise à jour de l’index apt OpenFOAM"
"${APT[@]}" update || fail "dépôt OpenFOAM inaccessible; aucun paquet n’a été déclaré installé"

PACKAGE="openfoam${OPENFOAM_VERSION}"
info "Installation de ${PACKAGE}"
"${APT[@]}" install -y "${PACKAGE}" \
  || fail "installation de ${PACKAGE} échouée"

[[ -f "${PREFIX}/etc/bashrc" ]] || fail "configuration absente après installation: ${PREFIX}/etc/bashrc"

cat > "${PREFIX}/OPENFOAM_INSTALL_RECORD.txt" <<EOF
package=${PACKAGE}
prefix=${PREFIX}
distribution=Ubuntu ${VERSION_ID}
codename=${VERSION_CODENAME}
architecture=$(uname -m)
installed_utc=$(date -u +%FT%TZ)
repository=http://${REPO_HOST}/ubuntu
key_url=${REPO_KEY_URL}
EOF

# Le shell courant doit être relancé ou la configuration sourcée manuellement.
# shellcheck disable=SC1090
source "${PREFIX}/etc/bashrc"
for command_name in blockMesh checkMesh potentialFoam; do
  command -v "${command_name}" >/dev/null 2>&1 \
    || fail "utilitaire absent après installation: ${command_name}"
done

if command -v foamInstallationTest >/dev/null 2>&1; then
  foamInstallationTest || fail "foamInstallationTest a échoué"
fi

info "PASS: ${PACKAGE} installé; blockMesh, checkMesh et potentialFoam sont disponibles"
printf 'Pour charger OpenFOAM dans un nouveau shell : source %s/etc/bashrc\n' "${PREFIX}"
