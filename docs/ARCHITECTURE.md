# DyzioBOT — Architektura Systemu

> Dokument ADR (Architecture Decision Records) + opis architektury.  
> Przeznaczony dla AI agenta i senior developerów.

---

## 1. OVERVIEW

DyzioBOT jest **multi-tenant SaaS** — jeden deployment obsługuje N serwerów Discord jednocześnie. Architektura jest celowo **modular monolith** (nie microservices), ponieważ:
- Koszt operacyjny microservices (network hops, service discovery, distributed tracing) nie jest uzasadniony przy obecnej skali
- Monorepo ułatwia shared types i code reuse
- Sharding Discord.js jest obsługiwany procesowo, nie serwisowo

**Dwa podsystemy:**
1. **Bot** (Node.js / discord.js v14) — event-driven, reaguje na Discord events
2. **Dashboard** (Next.js 16 App Router) — web UI dla administratorów gildii

---

## 2. MULTI-TENANT DESIGN

### 2.1 Izolacja tenantów

Każda gildia (Discord server) to osobny **tenant**. Dane są izolowane przez:

```
partition key: guildId (string, Discord Snowflake)
```

**Zasady:**
- Każdy dokument MongoDB z danymi gildii **musi** mieć pole `guildId`
- Każda query **musi** filtrować po `guildId` — nigdy `find({})` bez scope
- Cache'owanie: klucz zawsze `guildId:*` — nigdy globalny cache bez namespace
- Dashboard API: `guildId` z URL params (nigdy z body), weryfikowany przez MANAGE_GUILD check

### 2.2 Dane współdzielone

Tylko dane globalne (bez `guildId`):
- `BotConfig` — globalna konfiguracja bota (singleton)
- `ActivityBucket` — globalne statystyki bota

Wszystko inne: per-guild.

### 2.3 RBAC per tenant

```
Guild owner (Discord)
  └── Guild admins (adminRoles z GuildConfig)
        └── Guild mods (modRoles z GuildConfig)
              └── Regular users
```

Dashboard permissions:
- Dostęp do `/dashboard/[guildId]` → `user.guilds` z Discord OAuth musi zawierać guildId z flagą `MANAGE_GUILD`
- Owner commands → `OWNER_IDS.includes(userId)` (hardcoded, nie DB)

---

## 3. BOT — ARCHITEKTURA

### 3.1 Event-Driven Flow

```
Discord Gateway
    │
    ▼
discord.js EventEmitter
    │
    ├── guildCreate     → eventHandlers/guildCreate/
    ├── interactionCreate → eventHandlers/interactionCreate/
    │       │
    │       ├── CommandHandler.execute(interaction)
    │       │       │
    │       │       └── ICommand.execute()
    │       │               │
    │       │               └── Service.method() → ServiceResult<T>
    │       │
    │       └── ButtonHandler, SelectMenuHandler, ModalHandler
    │
    ├── messageCreate   → eventHandlers/messageCreate/
    ├── guildMemberAdd  → eventHandlers/guildMemberAdd/
    └── ... (wszystkie eventy w src/events/)
```

**Zasada:** Zero logiki biznesowej w event handlerach. Handler = delegacja do serwisu.

### 3.2 CommandHandler

```typescript
// src/handlers/CommandHandler.ts
class CommandHandler {
  private commands: Collection<string, ICommand>;

  async loadCommands(): Promise<void>   // skanuje src/commands/**/*.ts, ładuje dynamicznie
  async execute(interaction: ChatInputCommandInteraction): Promise<void>
    // 1. Znajdź komendę po interaction.commandName
    // 2. Sprawdź globalCooldown
    // 3. Sprawdź moduleEnabled(guildConfig, command.module)
    // 4. Sprawdź permissions (command.permissions)
    // 5. Wywołaj command.execute(interaction)
    // 6. Obsłuż błąd → createErrorEmbed
}
```

### 3.3 ServiceResult Pattern

Każdy serwis zwraca `ServiceResult<T>` — nigdy nie rzuca wyjątków poza serwis:

```typescript
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ServiceErrorCode };

// W serwisie:
async function doSomething(guildId: string): Promise<ServiceResult<SomeData>> {
  try {
    const data = await Model.findOne({ guildId });
    if (!data) return { ok: false, error: 'Nie znaleziono.', code: 'NOT_FOUND' };
    return { ok: true, data };
  } catch (err) {
    logger.error('doSomething failed', { guildId, error: err.message });
    return { ok: false, error: 'Błąd serwera.', code: 'INTERNAL_ERROR' };
  }
}
```

### 3.4 Schedulery / Background Jobs

Rejestracja w `clientReady` event, jeden raz:

```typescript
// src/events/clientReady/registerSchedulers.ts
export function registerSchedulers(client: Client): void {
  // Urodziny — codziennie o 8:00
  cron.schedule('0 8 * * *', () => birthdayService.checkBirthdays(client), {
    timezone: 'Europe/Warsaw'
  });

  // Statystyki miesięczne — 1. każdego miesiąca
  cron.schedule('0 0 1 * *', () => monthlyStatsService.archiveStats(client));

  // Giveaway check — co minutę
  cron.schedule('* * * * *', () => giveawayService.checkExpired(client));
}
```

**Zasady:**
- Każdy scheduler ma własny try/catch + logger label
- Nie blokuj event loop — używaj async iteration dla bulk operations
- Scheduler nie modyfikuje stanu globalnego — każda iteracja jest niezależna

### 3.5 In-Memory Cache

Trzy cache'e (src/cache/):
- `inviteCache` — mapa guildId → Map<inviteCode, { uses, inviterId }>
- `xpCache` — mapa `${guildId}:${userId}` → { xp, timestamp }
- `monthlyStatsCache` — mapa guildId → aktualne statystyki

**Zasady:**
- Cache jest per-process — przy shardingu (>2500 guildów) cache musi przenieść się do Redis
- Flush XP cache przed SIGTERM (graceful shutdown)
- Cache invalidacja: po każdej zmianie GuildConfig

---

## 4. DASHBOARD — ARCHITEKTURA

### 4.1 Next.js App Router — Data Flow

```
Browser Request
    │
    ▼
proxy.ts (auth check + rate limit + Next-Action CSRF)
    │
    ▼
Route Handler / Server Component
    │
    ├── Server Component → Mongoose query bezpośrednio → render HTML
    │
    └── API Route → getServerSession → Zod validate → Mongoose → Response.json()
```

### 4.2 Component Architecture

```
Server Components (domyślnie):
  - Strony z data fetchingiem (async page.tsx)
  - Layout components
  - Static content

Client Components ("use client"):
  - Interaktywne formy (useForm, onChange)
  - Real-time updates (useEffect + polling/websocket)
  - Auth-dependent UI (useSession)
  - Browser APIs (clipboard, animations)
```

### 4.3 Auth Flow

```
User → /login
  │
  ▼
NextAuth Discord OAuth2 → Discord API
  │
  ▼
Callback → JWT session (maxAge: 30d)
  │
  ▼
proxy.ts: każde żądanie → getToken(req) → brak tokenu → /login
  │
  ▼
Dashboard: useSession() / getServerSession(authOptions)
```

**Session shape:**
```typescript
interface Session {
  user: {
    id: string;        // Discord user ID
    name: string;      // Discord username
    image: string;     // Discord avatar URL
    guilds?: Guild[];  // guilds z Discord API (zapamiętane w JWT)
  };
  accessToken: string; // Discord OAuth access token
  expires: string;
}
```

### 4.4 Proxy (proxy.ts)

Wykonywany przed każdym requestem (plik musi być w `src/` i skonfigurowany jako `experimental.nodeMiddleware`):

```typescript
// Kolejność sprawdzeń:
// 1. Next-Action CSRF guard (blokuj skanery)
// 2. Rate limiting (ioredis sliding window, 100 req/15min per IP)
// 3. Auth check (getToken → brak → redirect /login)
// 4. Public paths bypass (/, /login, /api/auth/*)
```

---

## 5. REDIS — STRATEGIA UŻYCIA

| Zastosowanie | Key pattern | TTL | Uwagi |
|---|---|---|---|
| Rate limiting | `rl:{ip}:{window}` | 15min | sliding window counter |
| Session cache | `session:{userId}` | 30d | opcjonalnie, NextAuth domyślnie JWT |
| Guild config cache | `config:{guildId}` | 5min | invaliduj po zapisie |
| Twitch stream status | `twitch:stream:{broadcasterId}` | 60s | unikaj spam API |
| XP leaderboard | `xp:lb:{guildId}` | 5min | sorted set |

**Redis jako pub/sub (future — sharding):**
```
Shard 0 → PUBLISH bot:event:guildId:xpUpdate → Shard 1, 2, N (subskrybują)
```

**Graceful degradation:** Każde użycie Redis musi mieć try/catch → jeśli Redis down → kontynuuj bez cache (nie crash).

---

## 6. SHARDING STRATEGY

### 6.1 Próg shardingu

Discord wymaga shardingu gdy bot jest na >2500 guildów. Aktualnie: single-process.

### 6.2 Przygotowanie kodu na sharding

**Teraz (single-process):**
```typescript
// src/index.ts
const client = new Client({ intents: [...] });
```

**Po osiągnięciu progu:**
```typescript
// src/index.ts
const manager = new ShardingManager('./dist/shard.ts', {
  totalShards: 'auto',
  token: config.botToken,
});
manager.on('shardCreate', shard => logger.info('Shard created', { shardId: shard.id }));
await manager.spawn();
```

**Kod musi być shard-safe:**
- Nie używaj globalnych zmiennych (poza config)
- In-memory cache → Redis przed shardingiem
- Cross-shard queries → `client.shard.broadcastEval()`

---

## 7. API VERSIONING (DASHBOARD)

Obecne API routes nie mają wersjonowania (v1 implicit). Przy breaking changes:

```
/api/guild/[guildId]/qotd/questions     ← current (v1 implicit)
/api/v2/guild/[guildId]/qotd/questions  ← future breaking change
```

Zasady:
- Additive changes (nowe pola w response) → nie wymagają nowej wersji
- Breaking changes (usunięcie pola, zmiana semantyki) → nowy endpoint lub wersja
- Deprecated endpoints: 6-miesięczny okres deprecacji z `Deprecation: true` headerem

---

## 8. CIRCUIT BREAKERS I RETRY

### 8.1 Discord API

discord.js v14 ma wbudowany rate limit handler (REST queue):
- Automatyczne retry przy 429
- `restTimeOffset` dla zapobiegania edge cases
- **NIE** nadpisuj ani nie obchodź tego mechanizmu

### 8.2 Twitch API (custom retry)

```typescript
// Użyj skill: api-rate-limiting
// Token bucket: 800 req/min dla Helix API
// Exponential backoff z jitter dla 429/503
// Circuit breaker: po 5 błędach z rzędu → 30s circuit open
```

### 8.3 MongoDB

```typescript
// mongoose.connect opcje:
{
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  socketTimeoutMS: 45000,
}
```

---

## 9. GRACEFUL SHUTDOWN

```typescript
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — starting graceful shutdown`);

  // 1. Stop accepting new Discord interactions
  client.removeAllListeners();

  // 2. Flush in-memory caches
  await xpCache.flush();

  // 3. Close DB connection
  await mongoose.disconnect();

  // 4. Destroy Discord client
  client.destroy();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Docker `stop_grace_period: 10s` — bot ma 10 sekund na cleanup.

---

## 10. DISTRIBUTED LOCKING (FUTURE)

Przy operacjach które muszą być atomowe across shards (np. giveaway winner selection):

```typescript
// Redis SETNX jako distributed lock
const lock = await redis.set(`lock:giveaway:${giveawayId}`, '1', 'EX', 30, 'NX');
if (!lock) return; // Inny shard już przetwarza
try {
  // krytyczna sekcja
} finally {
  await redis.del(`lock:giveaway:${giveawayId}`);
}
```

---

## 11. ADR (Architecture Decision Records)

### ADR-001: Modular Monolith nad Microservices
**Decyzja:** Jeden process bota, jeden process dashboardu.  
**Uzasadnienie:** Brak potrzeby niezależnego skalowania poszczególnych modułów. Koszt operacyjny microservices nieuzasadniony. Redis pub/sub wystarczy dla cross-component komunikacji.  
**Konsekwencje:** Deployment jest prostszy. Przy >10k guildów ponownie oceń.

### ADR-002: MongoDB Atlas nad self-hosted Postgres
**Decyzja:** MongoDB Atlas jako główna baza danych.  
**Uzasadnienie:** Discord data jest naturalnie dokumentowa (guildConfig, embeds, etc). Atlas managed backups + global clusters. Typegoose daje type safety.  
**Konsekwencje:** Brak SQL joins. Denormalizacja gdzie potrzeba.

### ADR-003: NextAuth v4 Discord OAuth
**Decyzja:** NextAuth.js v4 z Discord providerem.  
**Uzasadnienie:** Dojrzałe rozwiązanie, natywna integracja z Discord OAuth2, JWT strategy bezstanowa (brak session store).  
**Konsekwencje:** Upgrade do v5 (Auth.js) wymaga refaktoru session shape.

### ADR-004: ServiceResult Pattern nad Exceptions
**Decyzja:** Serwisy zwracają `ServiceResult<T>`, nigdy nie rzucają.  
**Uzasadnienie:** Explicit error handling, brak niespodziewanych crashes w command handlers, lepsza TypeScript type safety.  
**Konsekwencje:** Verbose w callerach — zawsze sprawdzaj `.ok`.
</content>
</invoke>