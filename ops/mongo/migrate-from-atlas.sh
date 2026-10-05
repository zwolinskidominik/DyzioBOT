#!/usr/bin/env bash
# Jednorazowe przeniesienie danych z MongoDB Atlas do lokalnego Mongo na VPS.
#
# PRZED uruchomieniem zatrzymaj bota i dashboard (żeby nic nie zapisywało w trakcie):
#   docker compose stop bot dashboard
#   bash ops/mongo/migrate-from-atlas.sh <nazwa_bazy>
#
# Adres Atlasa jest czytany z MONGODB_URI w .env — uruchom skrypt ZANIM podmienisz tam adres
# na lokalny. Zrzut z Atlasa zostaje też jako plik na zaszyfrowanym wolumenie (zapas).
set -euo pipefail

DB="${1:?Podaj nazwę bazy, np. bash ops/mongo/migrate-from-atlas.sh deezybot}"
SECURE_DIR="${DEEZY_SECURE_DIR:-/srv/deezy-secure}"
DUMP="$SECURE_DIR/backups/atlas-$(date +%F-%H%M).archive.gz"

ATLAS_URI="$(grep -E '^MONGODB_URI=' .env | head -n1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//')"
if [[ "$ATLAS_URI" != mongodb+srv://* && "$ATLAS_URI" != *mongodb.net* ]]; then
  echo "MONGODB_URI w .env nie wygląda na adres Atlasa — czy już go podmieniłeś?" >&2
  exit 1
fi

echo "==> Zrzut bazy \"$DB\" z Atlasa -> $DUMP"
docker compose exec -T mongo mongodump --uri "$ATLAS_URI" --db "$DB" --archive --gzip > "$DUMP"
chmod 600 "$DUMP"
ls -lh "$DUMP"

echo "==> Wczytanie do lokalnego Mongo"
docker compose exec -T mongo sh -c \
  'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --drop' \
  < "$DUMP"

echo "==> Porównanie liczby dokumentów (Atlas vs lokalnie)"
COUNT_JS="
  const d = db.getSiblingDB('$DB');
  d.getCollectionNames().sort().forEach(c => print(c + ' ' + d.getCollection(c).estimatedDocumentCount()));
"
docker compose exec -T mongo mongosh --quiet "$ATLAS_URI" --eval "$COUNT_JS" > /tmp/deezy-atlas-counts.txt
docker compose exec -T mongo sh -c \
  'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "$1"' \
  _ "$COUNT_JS" > /tmp/deezy-local-counts.txt

if diff -u /tmp/deezy-atlas-counts.txt /tmp/deezy-local-counts.txt; then
  echo "OK: wszystkie kolekcje mają tyle samo dokumentów ($(wc -l < /tmp/deezy-local-counts.txt) kolekcji)."
else
  echo "UWAGA: liczby dokumentów się różnią (powyżej). Nie przełączaj bota, dopóki tego nie wyjaśnisz." >&2
  exit 1
fi
rm -f /tmp/deezy-atlas-counts.txt /tmp/deezy-local-counts.txt
