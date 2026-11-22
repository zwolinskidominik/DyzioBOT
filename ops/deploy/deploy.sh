#!/usr/bin/env bash
# Wdrożenie na VPS - uruchamiane przez GitHub Actions (.github/workflows/ci-deploy.yml) po zielonych
# testach na main. Klucz SSH GitHub Actions w ~/.ssh/authorized_keys ma wymuszoną komendę
# (command="bash .../ops/deploy/deploy.sh"), więc nawet po wycieku klucza da się nim tylko odpalić ten skrypt.
#
# Ręcznie (np. po awarii Actions):  bash ~/DyzioBOT/ops/deploy/deploy.sh
#
# Co robi:
#   - pobiera main i przesuwa repo TYLKO do przodu (--ff-only) - lokalne commity/zmiany na VPS
#     zatrzymują wdrożenie z błędem zamiast cokolwiek nadpisać,
#   - przebudowuje tylko to, czego dotyczą zmiany (bot / dashboard),
#   - sprawdza, czy kontenery po restarcie działają; jeśli nie - pokazuje końcówkę logów i kończy błędem.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

# Jedno wdrożenie naraz (np. dwa szybkie pushe).
exec 9>"/tmp/deezy-deploy.lock"
if ! flock -w 600 9; then
  echo "!! Inne wdrożenie trwa ponad 10 min - przerywam." >&2
  exit 1
fi

log() { printf '[deploy %s] %s\n' "$(date '+%F %T')" "$*"; }

before="$(git rev-parse HEAD)"
git fetch --quiet origin main
if ! git merge --ff-only --quiet origin/main; then
  echo "!! Na VPS są lokalne zmiany albo commity - nie nadpisuję ich. Sprawdź: cd $REPO_DIR && git status" >&2
  exit 1
fi
after="$(git rev-parse HEAD)"

if [[ "$before" == "$after" ]]; then
  log "Brak nowych zmian ($(git log -1 --format='%h %s'))."
  exit 0
fi

changed="$(git diff --name-only "$before" "$after")"
services=()
if grep -qE '^docker-compose\.yml$' <<<"$changed"; then
  services=(bot dashboard)
else
  grep -qE '^(src/|assets/|package(-lock)?\.json$|tsconfig[^/]*\.json$|Dockerfile\.bot$)' <<<"$changed" && services+=(bot)
  grep -qE '^(dashboard-nextjs/|Dockerfile\.dashboard$)' <<<"$changed" && services+=(dashboard)
fi

log "Wdrażam ${before:0:7} -> ${after:0:7}"
git log --format='  %h %s' "$before..$after"

if [[ ${#services[@]} -eq 0 ]]; then
  log "Zmiany nie dotyczą bota ani dashboardu (dokumentacja, ops, testy) - bez przebudowy."
  exit 0
fi

log "Przebudowa: ${services[*]}"
docker compose up -d --build "${services[@]}"

sleep 20
failed=0
for service in "${services[@]}"; do
  state="$(docker compose ps --format '{{.State}}' "$service" 2>/dev/null || true)"
  if [[ "$state" != "running" ]]; then
    echo "!! $service nie działa po wdrożeniu (stan: ${state:-brak})." >&2
    docker compose logs --tail=40 "$service" >&2 || true
    failed=1
  else
    log "$service: działa."
  fi
done

# Stare obrazy po przebudowie zajmują miejsce na dysku.
docker image prune -f >/dev/null 2>&1 || true

exit "$failed"
