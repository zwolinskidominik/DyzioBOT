#!/usr/bin/env bash
# Tworzy zaszyfrowany (LUKS2) wolumen na dane MongoDB i kopie zapasowe.
#
# Discord Developer Terms §5c wymagają szyfrowania danych w spoczynku. MongoDB Community nie
# szyfruje plików sam z siebie, a dysk VPS nie jest szyfrowany — więc dane Mongo trzymamy
# w kontenerze LUKS (plik-obraz montowany jako /srv/deezy-secure).
#
# Odblokowanie po restarcie VPS: automatyczne, kluczem z /root/.deezy-secure.key (tylko root).
# Chroni to dane, gdy wycieknie sam obraz/kopia wolumenu albo stary dysk po wymianie u OVH.
# Dodatkowo ustawiasz hasło awaryjne (recovery) — zapisz je w menedżerze haseł; bez klucza
# i bez hasła danych NIE DA SIĘ odzyskać.
#
# Uruchom raz, jako root:  sudo bash ops/mongo/setup-encrypted-volume.sh [rozmiar, np. 10G]
set -euo pipefail

SIZE="${1:-10G}"
NAME="deezy-secure"
IMG="/var/lib/${NAME}.img"
KEY="/root/.${NAME}.key"
MNT="/srv/${NAME}"
MONGO_UID=999 # użytkownik mongodb w oficjalnym obrazie mongo

if [[ $EUID -ne 0 ]]; then
  echo "Uruchom jako root: sudo bash $0 [rozmiar]" >&2
  exit 1
fi
if [[ -e "$IMG" ]]; then
  echo "Obraz $IMG już istnieje — przerywam, żeby niczego nie nadpisać." >&2
  exit 1
fi

command -v cryptsetup >/dev/null || { apt-get update -qq && apt-get install -y -qq cryptsetup; }

echo "==> Tworzę obraz $IMG ($SIZE)"
fallocate -l "$SIZE" "$IMG"
chmod 600 "$IMG"

echo "==> Generuję klucz $KEY"
( umask 077 && head -c 64 /dev/urandom > "$KEY" )
chmod 400 "$KEY"

echo "==> Formatuję LUKS2"
cryptsetup luksFormat --type luks2 --batch-mode "$IMG" "$KEY"

echo
echo "==> Ustaw HASŁO AWARYJNE (drugi sposób odblokowania, gdyby klucz zaginął)."
echo "    Zapisz je w menedżerze haseł."
cryptsetup luksAddKey "$IMG" --key-file "$KEY"

echo "==> Otwieram i formatuję ext4"
cryptsetup open "$IMG" "$NAME" --key-file "$KEY"
mkfs.ext4 -q -L "$NAME" "/dev/mapper/$NAME"
mkdir -p "$MNT"
mount "/dev/mapper/$NAME" "$MNT"

echo "==> Automatyczne odblokowanie i montowanie po restarcie"
grep -q "^$NAME " /etc/crypttab 2>/dev/null || echo "$NAME $IMG $KEY luks" >> /etc/crypttab
grep -q " $MNT " /etc/fstab || echo "/dev/mapper/$NAME $MNT ext4 defaults,nofail 0 2" >> /etc/fstab

# Docker nie może wystartować kontenera Mongo, zanim wolumen jest zamontowany — inaczej Mongo
# utworzyłby pustą bazę na niezaszyfrowanym dysku.
mkdir -p /etc/systemd/system/docker.service.d
cat > /etc/systemd/system/docker.service.d/deezy-secure.conf <<UNIT
[Unit]
RequiresMountsFor=$MNT
UNIT
systemctl daemon-reload

echo "==> Katalogi i keyFile replica setu Mongo"
mkdir -p "$MNT/mongo/data" "$MNT/backups"
( umask 077 && openssl rand -base64 756 > "$MNT/mongo/keyfile" )
chmod 400 "$MNT/mongo/keyfile"
chown -R "$MONGO_UID:$MONGO_UID" "$MNT/mongo"
# Kopie robi i czyta zwykły użytkownik (ten, który uruchomił sudo, np. ubuntu) — cron,
# migracja i pobieranie kopii przez scp nie działają z uprawnieniami roota.
BACKUP_OWNER="${SUDO_USER:-root}"
chown "$BACKUP_OWNER:" "$MNT/backups"
chmod 700 "$MNT/backups"

echo
echo "Gotowe. Zaszyfrowany wolumen: $MNT"
df -h "$MNT"
