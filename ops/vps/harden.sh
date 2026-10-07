#!/usr/bin/env bash
# Porządkuje i zabezpiecza VPS na podstawie audytu (ops/vps/audit.sh). Można uruchamiać wielokrotnie.
#
#   sudo bash ops/vps/harden.sh
#
# Zabezpieczenia przed odcięciem dostępu:
#   - SSH przeładowujemy (reload), a nie restartujemy — obecna sesja zostaje otwarta;
#   - hasła wyłączamy tylko, gdy użytkownik ubuntu ma klucz SSH;
#   - zapora najpierw dostaje regułę dla portu SSH (2222), dopiero potem jest włączana;
#   - każda zmiana konfiguracji SSH i Nginx jest sprawdzana (sshd -t, nginx -t) przed przeładowaniem.
# Po skrypcie NIE zamykaj obecnej sesji, dopóki nie zalogujesz się z drugiego okna (ssh deezy.cc).
set -euo pipefail

SSH_PORT=2222
SSH_USER=ubuntu

if [[ $EUID -ne 0 ]]; then
  echo "Uruchom przez sudo: sudo bash $0" >&2
  exit 1
fi

step() { printf '\n==> %s\n' "$1"; }

# ── 1. SSH ──────────────────────────────────────────────────────────────────────
step "SSH: tylko klucze, bez roota (port $SSH_PORT bez zmian)"
KEYS="/home/$SSH_USER/.ssh/authorized_keys"
if [[ ! -s "$KEYS" ]] || ! grep -qE '^(ssh-|ecdsa-|sk-)' "$KEYS"; then
  echo "!! $KEYS nie ma żadnego klucza — NIE wyłączam haseł, żeby nie odciąć dostępu." >&2
  exit 1
fi
# Pliki z sshd_config.d są czytane alfabetycznie, a wygrywa PIERWSZA wartość — „10-” wyprzedza
# 50-cloud-init.conf, który na obrazach chmurowych potrafi włączać logowanie hasłem.
cat > /etc/ssh/sshd_config.d/10-deezy-hardening.conf <<CONF
# Zarządzane przez ops/vps/harden.sh
# (Port zostaje w dotychczasowej konfiguracji — przy aktywacji przez ssh.socket zdublowany
#  Port mógłby zablokować start SSH.)
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AllowUsers $SSH_USER
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
# Tunel SSH jest potrzebny do MongoDB Compass (localhost:27017) — zostaje włączony.
AllowTcpForwarding local
CONF
sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd
sshd -T | grep -Ei '^(port|passwordauthentication|permitrootlogin|maxauthtries|x11forwarding|allowtcpforwarding) '

# ── 2. fail2ban ─────────────────────────────────────────────────────────────────
step "fail2ban: pilnuje właściwego portu SSH ($SSH_PORT)"
# Domyślny jail patrzy na port 22 — przy SSH na $SSH_PORT banował niewłaściwy port.
cat > /etc/fail2ban/jail.d/deezy.local <<CONF
# Zarządzane przez ops/vps/harden.sh
[DEFAULT]
bantime = 1h
bantime.increment = true
bantime.maxtime = 1w
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = $SSH_PORT
backend = systemd
CONF
systemctl restart fail2ban
sleep 2
fail2ban-client status sshd | grep -E 'Currently|Total'

# ── 3. Zapora ───────────────────────────────────────────────────────────────────
step "Zapora (ufw): tylko SSH $SSH_PORT, HTTP 80, HTTPS 443"
if ! sshd -T | grep -qx "port $SSH_PORT"; then
  echo "!! SSH nie nasłuchuje na porcie $SSH_PORT — przerywam, żeby zapora nie odcięła dostępu." >&2
  exit 1
fi
ufw allow "$SSH_PORT/tcp" comment 'SSH'
ufw allow 80/tcp comment 'HTTP (certbot, przekierowanie na HTTPS)'
ufw allow 443/tcp comment 'HTTPS'
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
ufw status verbose
# Uwaga: Docker omija ufw dla portów, które sam publikuje — dlatego w docker-compose.yml
# porty dashboardu i Mongo są wystawione tylko na 127.0.0.1. Nie zmieniaj tego.

# ── 4. Logi systemowe ───────────────────────────────────────────────────────────
step "journald: limit 500 MB (było bez limitu)"
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/deezy.conf <<CONF
# Zarządzane przez ops/vps/harden.sh
[Journal]
SystemMaxUse=500M
MaxRetentionSec=1month
CONF
systemctl restart systemd-journald
journalctl --vacuum-size=500M >/dev/null
journalctl --disk-usage

# ── 5. Docker: sprzątanie ───────────────────────────────────────────────────────
step "Docker: usuwam cache budowania i nieużywane obrazy"
docker builder prune -af >/dev/null
docker image prune -f >/dev/null
docker system df
cat > /etc/cron.weekly/deezy-docker-prune <<'CRON'
#!/bin/sh
# Zarządzane przez ops/vps/harden.sh — co tydzień czyści cache budowania i nieużywane obrazy
# starsze niż tydzień (działające kontenery i ich obrazy zostają).
docker builder prune -af --filter until=168h >/dev/null 2>&1
docker image prune -af --filter until=168h >/dev/null 2>&1
CRON
chmod 755 /etc/cron.weekly/deezy-docker-prune

# ── 6. Nginx ────────────────────────────────────────────────────────────────────
step "Nginx: ukrycie wersji, HSTS, limit zapytań"
cat > /etc/nginx/conf.d/deezy-security.conf <<'CONF'
# Zarządzane przez ops/vps/harden.sh (poziom http — dotyczy wszystkich stron)
server_tokens off;

# Przeglądarka ma zawsze łączyć się przez HTTPS (nagłówek działa tylko na odpowiedziach HTTPS).
# Pozostałe nagłówki bezpieczeństwa (CSP, X-Frame-Options itd.) ustawia dashboard (next.config.ts).
add_header Strict-Transport-Security "max-age=31536000" always;

# Limit zapytań z jednego IP — hojny dla zwykłego użytkownika (pierwsze wejście ładuje
# kilkadziesiąt plików), a zatrzymuje proste zalewanie strony. Dashboard ma dodatkowo
# własny limit w Redisie.
limit_req_zone $binary_remote_addr zone=deezy_per_ip:10m rate=30r/s;
limit_req zone=deezy_per_ip burst=120 nodelay;
limit_req_status 429;
CONF
nginx -t
systemctl reload nginx

# ── 7. Zbędne usługi ────────────────────────────────────────────────────────────
step "Wyłączam usługi zbędne na serwerze (modem, dyski USB)"
for svc in ModemManager udisks2; do
  systemctl disable --now "$svc" 2>/dev/null && echo "wyłączono: $svc" || true
done

step "Gotowe"
cat <<'MSG'
NIE zamykaj tej sesji. W NOWYM oknie na PC sprawdź:  ssh deezy.cc echo ok
Jeśli działa — wszystko w porządku. Jeśli nie — w tej sesji uruchom:
  sudo rm /etc/ssh/sshd_config.d/10-deezy-hardening.conf && sudo systemctl reload ssh
MSG
