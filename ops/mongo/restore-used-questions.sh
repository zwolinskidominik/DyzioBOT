#!/usr/bin/env bash
# Przywraca historię wysłanych pytań dnia (kolekcja usedquestions) JEDNEGO serwera z kopii zapasowej.
# Dopisuje tylko brakujące wpisy — niczego nie usuwa i nie nadpisuje tego, co jest teraz w bazie.
#
#   bash ops/mongo/restore-used-questions.sh <kopia.archive.gz> <guildId>           # podgląd, bez zapisu
#   bash ops/mongo/restore-used-questions.sh <kopia.archive.gz> <guildId> --apply   # zapis
#
# Kopie: /srv/deezy-secure/backups/deezy-*.archive.gz (ostatnie 7 dni) oraz atlas-*.archive.gz
# (zrzut z dnia przeprowadzki z Atlasa). Uruchamiaj z katalogu repo (~/DyzioBOT).
set -euo pipefail

ARCHIVE="${1:?Podaj plik kopii, np. /srv/deezy-secure/backups/deezy-2026-10-05-0330.archive.gz}"
GUILD="${2:?Podaj ID serwera}"
APPLY=false
[[ "${3:-}" == "--apply" ]] && APPLY=true

# ID trafia do skryptu mongosh — dopuszczamy wyłącznie snowflake Discorda.
if [[ ! "$GUILD" =~ ^[0-9]{17,20}$ ]]; then
  echo "Nieprawidłowe ID serwera: $GUILD" >&2
  exit 1
fi
if [[ ! -r "$ARCHIVE" ]]; then
  echo "Nie mogę odczytać $ARCHIVE (brak pliku albo uprawnień — spróbuj przez sudo)." >&2
  exit 1
fi

PROD_DB=test
TMP_DB=deezy_restore_tmp

echo "==> Wczytuję usedquestions z $(basename "$ARCHIVE") do tymczasowej bazy $TMP_DB"
docker compose exec -T mongo sh -c \
  'mongorestore --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --drop --nsInclude "$1.usedquestions" --nsFrom "$1.usedquestions" --nsTo "$2.usedquestions"' \
  _ "$PROD_DB" "$TMP_DB" < "$ARCHIVE"

MERGE_JS="
const g = '$GUILD';
const apply = $APPLY;
const tmpDb = db.getSiblingDB('$TMP_DB');
const prod = db.getSiblingDB('$PROD_DB');
try {
  const existing = new Set(prod.questions.distinct('questionId'));
  const already = new Set(prod.usedquestions.distinct('questionId', { guildId: g }));
  const fromBackup = tmpDb.usedquestions.find({ guildId: g }).sort({ usedAt: 1 }).toArray();
  const toAdd = fromBackup.filter((u) => existing.has(u.questionId) && !already.has(u.questionId));
  const gone = fromBackup.filter((u) => !existing.has(u.questionId)).length;

  print('Wysłane w kopii:          ' + fromBackup.length);
  if (fromBackup.length) {
    print('  od ' + fromBackup[0].usedAt.toISOString() + ' do ' + fromBackup[fromBackup.length - 1].usedAt.toISOString());
  }
  print('Wysłane teraz w bazie:    ' + already.size);
  print('Do przywrócenia:          ' + toAdd.length);
  if (gone) print('Pominięte (pytanie usunięte z puli): ' + gone);

  if (apply && toAdd.length) {
    const res = prod.usedquestions.insertMany(
      toAdd.map((u) => ({ guildId: g, questionId: u.questionId, usedAt: u.usedAt })),
      { ordered: false }
    );
    print('Zapisano: ' + Object.keys(res.insertedIds).length);
  } else if (!apply) {
    print('(podgląd — nic nie zapisano; dodaj --apply, żeby przywrócić)');
  }
} finally {
  tmpDb.dropDatabase();
}
"

docker compose exec -T mongo sh -c \
  'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "$1"' \
  _ "$MERGE_JS"
