#!/usr/bin/env bash
set -Eeuo pipefail

# Nettoyage sûr par défaut : jamais de --volumes et jamais de suppression
# d'images utilisées par un conteneur. Les valeurs peuvent être remplacées
# par /etc/docker/docker-gc.env.
KEEP_BUILD_CACHE="${KEEP_BUILD_CACHE:-10GB}"
BUILD_CACHE_AGE="${BUILD_CACHE_AGE:-168h}"
IMAGE_AGE="${IMAGE_AGE:-720h}"
PRUNE_ALL_IMAGES="${PRUNE_ALL_IMAGES:-false}"

log() { printf '[docker-gc] %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || { log 'Docker CLI introuvable'; exit 127; }
docker info >/dev/null 2>&1 || { log 'Démon Docker inaccessible'; exit 1; }

DRIVER="$(docker info --format '{{.Driver}}')"
ROOT="$(docker info --format '{{.DockerRootDir}}')"
log "driver=${DRIVER} root=${ROOT}"

if [[ "$DRIVER" == "vfs" ]]; then
  log 'Refus : le driver vfs est encore actif; corrigez le stockage avant la purge.'
  exit 2
fi

log 'État avant nettoyage'
docker system df

log "Purge du cache BuildKit âgé de ${BUILD_CACHE_AGE}, en conservant au moins ${KEEP_BUILD_CACHE}"
docker builder prune --force --filter "until=${BUILD_CACHE_AGE}" --keep-storage "${KEEP_BUILD_CACHE}"

if [[ "$PRUNE_ALL_IMAGES" == "true" ]]; then
  log "Purge des images non utilisées depuis ${IMAGE_AGE} (les images utilisées par un conteneur sont conservées)"
  docker image prune --all --force --filter "until=${IMAGE_AGE}"
else
  log "Purge des seules images dangling âgées de ${IMAGE_AGE}"
  docker image prune --force --filter "until=${IMAGE_AGE}"
fi

log 'Aucun volume n’a été supprimé'
log 'État après nettoyage'
docker system df
