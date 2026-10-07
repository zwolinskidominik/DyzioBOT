#!/usr/bin/env bash
# Przegląd konfiguracji VPS — TYLKO ODCZYT, niczego nie zmienia.
# Wynik nie zawiera haseł ani tokenów (bez .env, bez kluczy), więc można go wkleić do rozmowy.
#
# Uruchom z katalogu repo:  sudo bash ops/vps/audit.sh
set -uo pipefail

section() { printf '\n===== %s =====\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

if [[ $EUID -ne 0 ]]; then
  echo "Uruchom przez sudo: sudo bash $0" >&2
  exit 1
fi

section "System"
. /etc/os-release && echo "$PRETTY_NAME"
uname -r
uptime -p
timedatectl show -p Timezone -p NTPSynchronized 2>/dev/null
[[ -f /var/run/reboot-required ]] && echo "!! Wymagany restart (reboot-required)" || echo "Restart niewymagany"

section "Zasoby"
nproc | sed 's/^/CPU: /'
free -h
swapon --show || true
df -h / /srv/deezy-secure 2>/dev/null

section "Użytkownicy z powłoką i sudo"
awk -F: '$7 ~ /(bash|sh|zsh)$/ {print $1" ("$7")"}' /etc/passwd
getent group sudo | sed 's/^/sudo: /'
for home in /root /home/*; do
  keys="$home/.ssh/authorized_keys"
  [[ -f "$keys" ]] && echo "$keys: $(grep -cvE '^\s*(#|$)' "$keys") klucz(y)"
done

section "SSH (efektywna konfiguracja)"
sshd -T 2>/dev/null | grep -Ei '^(port|permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|maxauthtries|x11forwarding|allowusers|allowtcpforwarding) '
ls /etc/ssh/sshd_config.d/ 2>/dev/null | sed 's/^/sshd_config.d: /'

section "Porty nasłuchujące"
ss -tlnpH | awk '{print $4"  "$6}' | sort -u

section "Zapora"
if have ufw; then ufw status verbose; else echo "ufw: nie zainstalowany"; fi
iptables -S INPUT 2>/dev/null | head -5

section "fail2ban"
if have fail2ban-client; then fail2ban-client status 2>/dev/null; else echo "fail2ban: nie zainstalowany"; fi

section "Automatyczne aktualizacje"
dpkg -l unattended-upgrades 2>/dev/null | grep -q '^ii' && echo "unattended-upgrades: zainstalowany" || echo "unattended-upgrades: brak"
cat /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null
apt list --upgradable 2>/dev/null | grep -vc '^Listing' | sed 's/^/Pakiety do aktualizacji: /'

section "Docker"
docker --version 2>/dev/null
docker compose version 2>/dev/null
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
docker system df 2>/dev/null
cat /etc/docker/daemon.json 2>/dev/null || echo "daemon.json: brak"

section "Nginx"
if have nginx; then
  nginx -v 2>&1
  nginx -t 2>&1 | tail -1
  ls /etc/nginx/sites-enabled/
  nginx -T 2>/dev/null | grep -E '^\s*(server_name|listen|ssl_protocols|add_header|limit_req|client_max_body_size|server_tokens|proxy_pass)\b' | sed 's/^\s*//' | sort | uniq -c
else
  echo "nginx: nie zainstalowany"
fi

section "Certyfikaty"
if have certbot; then certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry'; else echo "certbot: brak"; fi
systemctl list-timers --all 2>/dev/null | grep -i certbot || true

section "Zadania cron"
for u in root ubuntu; do echo "-- $u"; crontab -l -u "$u" 2>/dev/null | grep -vE '^\s*(#|$)' || echo "(brak)"; done

section "Logi"
journalctl --disk-usage 2>/dev/null
grep -E '^\s*SystemMaxUse' /etc/systemd/journald.conf /etc/systemd/journald.conf.d/*.conf 2>/dev/null || echo "journald: brak limitu (domyślny)"
du -sh /var/log 2>/dev/null

section "Usługi systemowe (włączone)"
systemctl list-unit-files --type=service --state=enabled --no-legend 2>/dev/null | awk '{print $1}' | tr '\n' ' '
echo

section "Nieudane logowania SSH (ostatnie 24 h)"
journalctl -u ssh -u sshd --since "24 hours ago" 2>/dev/null | grep -ciE 'failed password|invalid user' | sed 's/^/Prób: /'
