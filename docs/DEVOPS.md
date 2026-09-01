# DeezyBOT — DevOps, Infrastructure & CI/CD

> Deployment na VPS Ubuntu + Docker Compose. Nginx reverse proxy. GitHub Actions CI/CD.  
> Brak Kubernetes / cloud managed services — self-hosted na OVH/Hetzner VPS.

---

## 1. INFRASTRUKTURA OVERVIEW

```
Internet
    │
    ▼
Cloudflare (DNS + DDoS protection + CDN)
    │
    ▼
VPS Ubuntu 22.04 (Nginx)
    │
    ├── port 443 → dashboard (Next.js :3000)
    │
    └── Docker network: deezybot_net
            ├── bot (discord.js) ← Discord Gateway WebSocket
            ├── dashboard (Next.js :3000)
            └── redis (:6379, internal only)

MongoDB Atlas (cloud managed, Warsaw region)
```

---

## 2. DOCKER

### 2.1 Struktura kontenerów

```yaml
# docker-compose.yml (uproszczony model)
version: '3.9'

networks:
  deezybot_net:
    driver: bridge

services:
  bot:
    build:
      context: .
      dockerfile: Dockerfile.bot
    restart: unless-stopped
    env_file: .env
    networks: [deezybot_net]
    depends_on: [redis]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 30s
      timeout: 10s
      retries: 3
    stop_grace_period: 10s  # SIGTERM → 10s na graceful shutdown

  dashboard:
    build:
      context: .
      dockerfile: Dockerfile.dashboard
    restart: unless-stopped
    env_file: .env
    ports: ["3000:3000"]
    networks: [deezybot_net]
    depends_on: [redis]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks: [deezybot_net]
    # NIE expose portów na host — tylko wewnętrzna sieć
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    logging:
      driver: json-file
      options: { max-size: "5m", max-file: "2" }

volumes:
  redis_data:
```

### 2.2 Dockerfile.bot (multi-stage)

```dockerfile
# Dockerfile.bot
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production=false
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER nodejs  # non-root user
EXPOSE 0     # bot nie nasłuchuje na porcie
CMD ["node", "."]
```

### 2.3 Dockerfile.dashboard (multi-stage)

```dockerfile
# Dockerfile.dashboard
FROM node:20-alpine AS builder
WORKDIR /app
COPY dashboard-nextjs/package*.json ./
RUN npm ci
COPY dashboard-nextjs/ .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nodejs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### 2.4 Operacje Docker

```bash
# Pełny restart z rebuildem (po deploy):
docker compose up --build -d

# Restart tylko jednego serwisu:
docker compose up --build -d dashboard

# Status serwisów:
docker compose ps

# Logi na żywo:
docker compose logs -f bot --tail=100
docker compose logs -f dashboard --tail=100

# Shell w kontenerze (debug):
docker compose exec bot sh
docker compose exec dashboard sh

# Wyczyść stare obrazy:
docker image prune -f

# Całkowity reset (DESTRUCTIVE — utrata redis data!):
docker compose down -v && docker compose up --build -d
```

---

## 3. NGINX REVERSE PROXY

```nginx
# /etc/nginx/sites-available/deezybot-dashboard
server {
    listen 443 ssl http2;
    server_name dashboard.deezybot.pl;  # zmień na swój domain

    ssl_certificate /etc/letsencrypt/live/dashboard.deezybot.pl/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.deezybot.pl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}

server {
    listen 80;
    server_name dashboard.deezybot.pl;
    return 301 https://$host$request_uri;
}
```

---

## 4. CI/CD — GITHUB ACTIONS

### 4.1 CI Pipeline (test + build)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  bot:
    name: Bot — lint, typecheck, test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run check:types
      - run: npm test -- --coverage --passWithNoTests
      - run: npm audit --audit-level=high

  dashboard:
    name: Dashboard — lint, typecheck, test, build
    runs-on: ubuntu-latest
    defaults:
      run: { working-directory: dashboard-nextjs }
    env:
      NEXTAUTH_SECRET: ci-test-secret-minimum-32-characters
      NEXTAUTH_URL: http://localhost:3000
      DISCORD_CLIENT_ID: ci-client-id
      DISCORD_CLIENT_SECRET: ci-client-secret
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: 'dashboard-nextjs/package-lock.json' }
      - run: npm ci
      - run: npm run check:types
      - run: npm test
      - run: npm run build
      - run: npm audit --audit-level=high
```

### 4.2 CD Pipeline (deploy na VPS)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]  # tylko z main → produkcja

jobs:
  deploy:
    name: Deploy to VPS
    runs-on: ubuntu-latest
    needs: [bot-tests, dashboard-tests]  # deploy tylko gdy testy przejdą
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/DeezyBOT
            git pull origin main
            docker compose up --build -d
            # Health check po deployu
            sleep 10
            docker compose ps | grep -E "(unhealthy|Exit)" && exit 1
            echo "Deploy successful"
```

### 4.3 GitHub Secrets wymagane

```
VPS_HOST               — IP lub hostname serwera
VPS_USER               — user SSH (np. ubuntu, deezy)
VPS_SSH_KEY            — private key SSH (bez hasła)
DISCORD_BOT_TOKEN      — token bota (production)
MONGODB_URI            — MongoDB Atlas URI (production)
NEXTAUTH_SECRET        — min 32 znaków
NEXTAUTH_URL           — https://dashboard.deezybot.pl
DISCORD_CLIENT_ID      — Discord OAuth app client ID
DISCORD_CLIENT_SECRET  — Discord OAuth app client secret
REDIS_PASSWORD         — hasło Redis
```

---

## 5. MONITORING I OBSERVABILITY

### 5.1 Health endpoint

```typescript
// dashboard-nextjs/src/app/api/health/route.ts
export async function GET(): Promise<Response> {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown' as 'ok' | 'error',
      redis: 'unknown' as 'ok' | 'redis',
    }
  };

  try {
    await mongoose.connection.db.admin().ping();
    checks.checks.database = 'ok';
  } catch {
    checks.checks.database = 'error';
    checks.status = 'degraded';
  }

  try {
    const redis = getRedisClient();
    await redis.ping();
    checks.checks.redis = 'ok';
  } catch {
    checks.checks.redis = 'error';
    // Redis degradation — nie fatal
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return Response.json(checks, { status: statusCode });
}
```

### 5.2 Logi produkcyjne

```bash
# Logi z ostatniej godziny:
docker compose logs --since 1h bot

# Logi błędów:
docker compose logs bot 2>&1 | grep '"level":"error"'

# Śledź logi w real-time:
docker compose logs -f dashboard

# Eksportuj logi do pliku:
docker compose logs bot > bot_$(date +%Y%m%d_%H%M%S).log
```

**Log rotation:** Docker json-file driver z `max-size: 10m, max-file: 3` = max 30MB na serwis.

### 5.3 Alerty (future — Discord webhook)

```typescript
// Przy krytycznym błędzie w bocie → webhook na owner channel:
async function sendOwnerAlert(message: string): Promise<void> {
  if (!config.ownerAlertWebhook) return;
  await fetch(config.ownerAlertWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: `⚠️ ALERT: ${message}` }),
  });
}
```

### 5.4 UptimeRobot / BetterStack (zewnętrzny monitoring)

Monitoruj endpointy z zewnątrz:
- `GET /api/health` — co 1 minutę, alert email/Discord gdy 503

---

## 6. BACKUP STRATEGY

### 6.1 MongoDB Atlas

- **Continuous backup** (Atlas managed) — point-in-time restore do 7 dni
- Przed każdą większą migracją: manual snapshot przez Atlas UI
- Eksport danych przed destrukcyjnymi operacjami:
  ```bash
  mongodump --uri="$MONGODB_URI" --out=backup_$(date +%Y%m%d)
  ```

### 6.2 Redis

Redis traktowany jako ephemeral cache (nie source of truth):
- Redis data volume: `redis_data` (appendonly yes)
- Utrata Redis data → akceptowalna (rate limiting zresetuje, cache się odbuduje)
- Nie backupuj Redis — to cache, nie baza

### 6.3 Konfiguracje serwera

```bash
# Backup plików konfiguracyjnych VPS:
scp user@vps:/etc/nginx/sites-available/deezybot-dashboard ./backup/nginx.conf
scp user@vps:~/DeezyBOT/.env ./backup/.env.$(date +%Y%m%d)
# Uwaga: .env zawiera sekrety — przechowuj bezpiecznie!
```

---

## 7. DISASTER RECOVERY

### 7.1 Bot crash (container restart)

```bash
# Docker `restart: unless-stopped` powinien auto-restart
# Sprawdź:
docker compose ps
docker compose logs bot --tail=50

# Jeśli container nie startuje:
docker compose logs bot  # sprawdź error
docker compose up -d bot  # force restart
```

### 7.2 Całkowita awaria VPS

1. Nowy VPS → Ubuntu 22.04
2. `apt install docker.io docker-compose-plugin nginx certbot`
3. Clone repozytorium
4. Skopiuj `.env` z backupu
5. `docker compose up -d`
6. `certbot --nginx -d dashboard.deezybot.pl`
7. Przywróć MongoDB Atlas backup (jeśli potrzeba)
8. Zaktualizuj DNS na nowy IP VPS

### 7.3 Corrupt data

1. Zidentyfikuj zakres uszkodzeń (guildId, kolekcja, time range)
2. Atlas UI → Point-in-time restore do przed uszkodzeniem
3. Weryfikuj przez bot komendy
4. Sprawdź audit logs co się stało

---

## 8. SECURITY HARDENING — VPS

```bash
# SSH hardening (/etc/ssh/sshd_config):
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
MaxAuthTries 3

# UFW firewall:
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP → redirect do HTTPS
ufw allow 443/tcp   # HTTPS
ufw deny 3000/tcp   # Dashboard nie bezpośrednio (tylko przez Nginx)
ufw enable

# Fail2ban (brute force protection):
apt install fail2ban
# konfiguracja w /etc/fail2ban/jail.local

# Automatic security updates:
apt install unattended-upgrades
dpkg-reconfigure unattended-upgrades
```

---

## 9. CHECKLISTY

### 9.1 Deploy checklist

- [ ] CI pipeline przeszedł (testy + typecheck + build)
- [ ] `npm audit --audit-level=high` — brak critical/high
- [ ] Nowe `.env` zmienne dodane na VPS
- [ ] `git pull` na VPS
- [ ] `docker compose up --build -d`
- [ ] `docker compose ps` — wszystkie serwisy `healthy`
- [ ] `curl https://dashboard.deezybot.pl/api/health` → 200
- [ ] Sprawdź logi: `docker compose logs --since 2m`
- [ ] Przetestuj jedną komendę na bocie
- [ ] Przetestuj logowanie w dashboardzie

### 9.2 Rollback procedure

```bash
# Jeśli deploy się posypał:
# 1. Sprawdź poprzedni commit:
git log --oneline -5

# 2. Reverta do poprzedniej wersji:
git revert HEAD
git push origin main
# → CI/CD automatycznie deploye poprzednią wersję

# Lub manualnie na VPS:
git checkout <poprzedni-commit>
docker compose up --build -d
```
</content>
</invoke>