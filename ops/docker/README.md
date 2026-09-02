# Maintenance Docker et cache BuildKit

## Installation du nettoyage automatique

Cette configuration ne supprime jamais les volumes et, par défaut, ne supprime que le cache BuildKit ancien et les images dangling anciennes. Elle conserve au moins 10 Go de cache BuildKit. Pour l’installer sur une VM Docker :

```bash
sudo install -m 0755 ops/docker/docker-gc.sh /usr/local/sbin/docker-gc.sh
sudo install -m 0644 ops/docker/docker-gc.service /etc/systemd/system/docker-gc.service
sudo install -m 0644 ops/docker/docker-gc.timer /etc/systemd/system/docker-gc.timer

# Optionnel : personnaliser les seuils, puis protéger le fichier.
sudo install -m 0600 ops/docker/docker-gc.env.example /etc/docker/docker-gc.env
sudo systemctl daemon-reload
sudo systemctl enable --now docker-gc.timer
systemctl list-timers docker-gc.timer
```

Avant la première exécution automatique, testez manuellement :

```bash
sudo systemctl start docker-gc.service
sudo journalctl -u docker-gc.service -n 100 --no-pager
```

Pour un nettoyage immédiat sans supprimer de volumes :

```bash
sudo docker builder prune --force --filter until=168h --keep-storage 10GB
sudo docker image prune --force --filter until=720h
```

`PRUNE_ALL_IMAGES=true` peut être activé uniquement après inventaire des images de rollback. Il ne faut pas utiliser `docker system prune --volumes` sur cette VM, car les artefacts CFD du volume `lh2-cfd-artifacts` doivent rester persistants.

## Cache BuildKit pour OpenFOAM

Le Dockerfile du worker utilise maintenant la syntaxe BuildKit et deux cache mounts apt verrouillés. Le cache est réutilisable d’un build à l’autre, mais n’est pas copié dans la couche finale de l’image. Le contexte est également réduit par `.dockerignore`.

Pour une compilation OpenFOAM depuis les sources, séparez les étapes en stages nommés : un stage `builder` contenant compilateur, headers et sources, puis un stage `runtime` ne copiant que les bibliothèques, exécutables et fichiers de configuration nécessaires. Placez les étapes coûteuses et stables avant les `COPY` du code qui change souvent. Utilisez un stage `test` séparé et construisez `--target test` en CI avant de publier le stage runtime.

Exemple de structure :

```dockerfile
# syntax=docker/dockerfile:1
FROM opencfd/openfoam-default:2512 AS builder
USER root
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
      build-essential ca-certificates cmake ninja-build \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY openfoam-src/ ./openfoam-src/
RUN --mount=type=cache,target=/root/.cache/ccache,sharing=locked \
    cmake -S openfoam-src -B /build -G Ninja -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /build --parallel

FROM opencfd/openfoam-default:2512 AS runtime
USER root
COPY --from=builder /build/bin/ /usr/local/bin/
COPY --from=builder /build/lib/ /usr/local/lib/
USER cfdworker
```

Adaptez impérativement les chemins `bin`, `lib` et les dépendances au système de build réel d’OpenFOAM ; ne copiez pas arbitrairement `/usr` depuis le stage builder. L’image officielle OpenFOAM peut déjà contenir le solveur et ses bibliothèques, auquel cas il vaut mieux conserver un Dockerfile runtime léger comme celui du worker actuel plutôt que reconstruire OpenFOAM inutilement.

## Commandes de build recommandées

```bash
export DOCKER_BUILDKIT=1
docker buildx create --name openfoam-builder --driver docker-container --use 2>/dev/null || true
docker buildx inspect --bootstrap
docker buildx build --progress=plain --pull --load \
  -t lh2-cfd-worker:2512 \
  infrastructure/cfd-worker
```

Pour une CI avec registre, utilisez un cache externe afin de ne pas remplir durablement le disque local :

```bash
docker buildx build --progress=plain --pull --push \
  -t registry.example.org/quantum/lh2-cfd-worker:2512 \
  --cache-from type=registry,ref=registry.example.org/quantum/lh2-cfd-worker:buildcache \
  --cache-to type=registry,ref=registry.example.org/quantum/lh2-cfd-worker:buildcache,mode=max \
  infrastructure/cfd-worker
```

N’utilisez pas `--no-cache` sauf pour un diagnostic, car cela reconstruit toutes les étapes coûteuses. Vérifiez régulièrement `docker buildx du` et le journal du timer.

## Références

[1]: https://docs.docker.com/reference/cli/docker/builder/prune/ "Docker — docker builder prune"

[2]: https://docs.docker.com/reference/cli/docker/system/prune/ "Docker — docker system prune"

[3]: https://docs.docker.com/build/cache/optimize/ "Docker — Optimize cache usage in builds"

[4]: https://docs.docker.com/build/building/multi-stage/ "Docker — Multi-stage builds"
