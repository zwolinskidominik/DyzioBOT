#!/usr/bin/env bash
# Pierwsze uruchomienie MongoDB: inicjuje jednowęzłowy replica set (rs0) i tworzy użytkownika
# aplikacji z dostępem tylko do bazy bota (readWrite) — bot i dashboard nie używają konta root.
#
# Uruchom z katalogu repo, gdy kontener mongo działa:
#   docker compose up -d mongo
#   bash ops/mongo/init-replica.sh <nazwa_bazy>
#
# Na końcu wypisuje MONGODB_URI do wpisania w .env i dashboard-nextjs/.env.local.
# Hasło użytkownika aplikacji pojawia się TYLKO raz — od razu wpisz je do plików .env.
set -euo pipefail

DB="${1:?Podaj nazwę bazy, np. bash ops/mongo/init-replica.sh deezybot}"
APP_USER="deezy"

if [[ ! "$DB" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Nieprawidłowa nazwa bazy: $DB" >&2
  exit 1
fi

# Polecenia mongosh wykonujemy w kontenerze — dane logowania roota biorą się z mongo.env
# (zmienne MONGO_INITDB_ROOT_*), więc hasło roota nie pojawia się w historii powłoki hosta.
mongo_root() {
  docker compose exec -T mongo sh -c \
    'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$@"' \
    _ "$@"
}

echo "==> Czekam, aż Mongo będzie gotowe"
for _ in $(seq 1 30); do
  if docker compose exec -T mongo mongosh --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Replica set rs0"
mongo_root --eval '
  try {
    rs.status();
    print("Replica set już zainicjowany.");
  } catch (e) {
    rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] });
    print("Zainicjowano rs0.");
  }
'

echo "==> Czekam na PRIMARY"
for _ in $(seq 1 30); do
  if mongo_root --eval 'quit(db.hello().isWritablePrimary ? 0 : 1)' >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

APP_PASS="$(openssl rand -hex 24)"
echo "==> Użytkownik aplikacji \"$APP_USER\" (readWrite na $DB)"
mongo_root --eval "
  const admin = db.getSiblingDB('admin');
  const roles = [{ role: 'readWrite', db: '$DB' }];
  if (admin.getUser('$APP_USER')) {
    admin.updateUser('$APP_USER', { pwd: '$APP_PASS', roles });
    print('Zaktualizowano hasło istniejącego użytkownika.');
  } else {
    admin.createUser({ user: '$APP_USER', pwd: '$APP_PASS', roles });
    print('Utworzono użytkownika.');
  }
"

echo
echo "Wpisz w .env (bot) i dashboard-nextjs/.env.local (dashboard):"
echo
echo "MONGODB_URI=mongodb://$APP_USER:$APP_PASS@mongo:27017/$DB?authSource=admin&replicaSet=rs0"
echo
