#!/usr/bin/env bash
set -Eeuo pipefail

# Installs OpenCFD/Keysight OpenFOAM v2512 from the official signed Debian/Ubuntu repository.
# Official repository instructions:
# https://gitlab.com/openfoam/core/openfoam/-/wikis/precompiled/debian
# Usage: sudo ./scripts/install_openfoam_ubuntu.sh

PACKAGE="openfoam2512-default"
PREFIX="/usr/lib/openfoam/openfoam2512"
REPO_INSTALLER_URL="https://dl.openfoam.com/add-debian-repo.sh"
REPO_KEY_URL="https://dl.openfoam.com/pubkey.gpg"

fail() { echo "FAIL: $*" >&2; exit 1; }
info() { printf '[openfoam2512-install] %s\n' "$*"; }

[[ "${EUID}" -eq 0 ]] || fail "run with sudo"
[[ "$(uname -m)" == "x86_64" ]] || fail "x86_64 required; found $(uname -m)"
source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || fail "Ubuntu required; found ${ID:-UNAVAILABLE}"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg lsb-release

info "Downloading the official OpenCFD repository installer"
tmp_installer="$(mktemp)"
trap 'rm -f "$tmp_installer"' EXIT
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 "$REPO_INSTALLER_URL" -o "$tmp_installer"
test -s "$tmp_installer" || fail "empty repository installer"
info "Official repository installer SHA-256: $(sha256sum "$tmp_installer" | awk '{print $1}')"

# The downloaded official installer installs the repository signing key and apt source.
bash "$tmp_installer"
apt-get update
apt-get install -y "$PACKAGE"

[[ -f "$PREFIX/etc/bashrc" ]] || fail "missing OpenFOAM environment: $PREFIX/etc/bashrc"
command -v openfoam2512 >/dev/null 2>&1 || fail "openfoam2512 selector command is missing"

cat > "$PREFIX/OPENFOAM_INSTALL_RECORD.txt" <<EOF
package=$PACKAGE
prefix=$PREFIX
repository_installer=$REPO_INSTALLER_URL
repository_signing_key=$REPO_KEY_URL
ubuntu=${VERSION_ID:-UNKNOWN}
codename=${VERSION_CODENAME:-UNKNOWN}
architecture=$(uname -m)
installed_utc=$(date -u +%FT%TZ)
EOF

info "PASS: $PACKAGE installed from the official signed OpenCFD repository"
printf 'Load the environment with: source %s/etc/bashrc\n' "$PREFIX"
printf 'Or use the selector: openfoam2512\n'
