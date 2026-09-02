#!/usr/bin/env bash
set -Eeuo pipefail

IMAGE="${CFD_WORKER_IMAGE:-lh2-cfd-worker:2512}"
CONTEXT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../infrastructure/cfd-worker" && pwd)"

command -v docker >/dev/null 2>&1 || {
  echo "Docker CLI introuvable. Installez Docker Engine/Compose sur la VM de calcul." >&2
  exit 127
}

docker info >/dev/null 2>&1 || {
  echo "Le démon Docker n'est pas accessible. Vérifiez systemctl status docker et les permissions de l'utilisateur." >&2
  exit 1
}

DRIVER="$(docker info --format '{{.Driver}}')"
ROOT_DIR="$(docker info --format '{{.DockerRootDir}}')"
AVAIL_KB="$(df -Pk "$ROOT_DIR" | awk 'NR==2 {print $4}')"
AVAIL_GB="$((AVAIL_KB / 1024 / 1024))"

echo "Driver Docker : ${DRIVER}"
echo "Racine Docker : ${ROOT_DIR}"
echo "Espace disponible : ${AVAIL_GB} GiB"

if [[ "$DRIVER" == "vfs" ]]; then
  cat >&2 <<'EOF'
Le driver vfs effectue des copies complètes de couches et consomme beaucoup plus
que overlay2. Ne relancez pas le build avant d'avoir migré le démon vers overlay2
ou libéré suffisamment d'espace dans Docker.

Diagnostic non destructif : docker system df -v
Nettoyage contrôlé après vérification : docker builder prune
Nettoyage plus large, à confirmer explicitement : docker system prune
EOF
  exit 2
fi

exec docker build --progress=plain --pull -t "$IMAGE" "$CONTEXT"
