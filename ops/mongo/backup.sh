#!/usr/bin/env bash
# Codzienna kopia zapasowa MongoDB na zaszyfrowany wolumen, z rotacją.
#
# Instalacja (crontab użytkownika z dostępem do dockera, np. ubuntu):
#   crontab -e
#   30 3 * * * cd /home/ubuntu/DyzioBOT && bash ops/mongo/backup.sh >> /srv/deezy-secure/backups/backup.log 2>&1
#
# Kopia zostaje na tym samym VPS — chroni przed błędem w danych (np. przypadkowym usunięciem),
# ale nie przed utratą całego serwera. Kopię poza VPS pobiera komputer właściciela:
# ops/mongo/pull-backup.ps1 (Harmonogram zadań Windows).
set -euo pipefail

SECURE_DIR="${DEEZY_SECURE_DIR:-/srv/deezy-secure}"
BACKUP_DIR="$SECURE_DIR/backups"
KEEP_DAYS="${KEEP_DAYS:-7}"
FILE="$BACKUP_DIR/deezy-$(date +%F-%H%M).archive.gz"

if ! mountpoint -q "$SECURE_DIR"; then
  echo "$(date -Is) BŁĄD: $SECURE_DIR nie jest zamontowany — nie zapisuję kopii na niezaszyfrowany dysk." >&2
  exit 1
fi

docker compose exec -T mongo sh -c \
  'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip' \
  > "$FILE.partial"
mv "$FILE.partial" "$FILE"
chmod 600 "$FILE"

find "$BACKUP_DIR" -maxdepth 1 -name 'deezy-*.archive.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) OK: $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"
