# DyzioBOT — AI Agent Master Reference
> **Poziom:** Senior / Full-Stack Architect  
> **Architektura:** Multi-tenant SaaS — Discord Bot + Web Dashboard  
> **Środowisko:** Hostile Production — security-first, deny-by-default  
> **Wersja:** 3.0

---

## SEKCJA 0 — HIERARCHIA DOKUMENTÓW

| Dokument | Przeznaczenie | Kiedy czytać |
|---|---|---|
| **Ten plik** | Master guide dla AI agenta | Zawsze przy nietrywialnych zmianach |
| `.github/copilot-instructions.md` | Quick-reference dla Copilot | Ładowany automatycznie |
| `docs/ARCHITECTURE.md` | Decyzje architektoniczne, ADR | Zmiana struktury systemu |
| `docs/SECURITY.md` | Threat model, OWASP, hardening | Każda zmiana auth/API/DB/webhook |
| `docs/DEVELOPMENT.md` | Standardy kodu, git workflow, PR | Nowy feature / refactor |
| `docs/TESTING.md` | Strategia testów, coverage, mutation | Przed pisaniem testów |
| `docs/DEVOPS.md` | Docker, CI/CD, monitoring | Deploy, infrastruktura |
| `docs/DATABASE.md` | MongoDB, multi-tenant, security | Zmiana schema, query, migration |
| `skills/deezybot-*` | Implementacje konkretnych domen | Patrz tabela routingu |

## SEKCJA 1 — NAJWAŻNIEJSZA REGUŁA (MUST READ)

**Przed jakąkolwiek nietrywialną zmianą w tym repo otwórz i przeczytaj master skill:**

```
c:\Users\Chickenen\.agents\skills\deezybot-project\SKILL.md
```

Bez przeczytania master skilla **NIE WOLNO**:
- dodawać nowych zależności (`npm install`),
- zmieniać schema Mongoose / modeli Typegoose,
- pisać nowych komend, eventów, serwisów,
- modyfikować CommandHandler / EventHandler,
- zmieniać konfiguracji bota, gilda, modułów,
- modyfikować dashboard-nextjs (`src/app/`, `src/lib/`, API routes),
- tworzyć nowych endpointów API ani webhooków,
- zmieniać auth flow / session handling,
- modyfikować RBAC / permission system,
- zmieniać konfiguracji Docker / CI/CD.

Trywialne zmiany OK bez czytania (literówka, drobny tekst w embedzie).

## SEKCJA 2 — ROUTING SKILLI

Przeczytaj master skill, następnie otwórz **wszystkie** skille pasujące do zadania:

| Sygnał w zadaniu | Skill obowiązkowy |
|---|---|
| Nowa komenda / modyfikacja komendy | `deezybot-discord-commands` |
| Nowy event handler | `deezybot-discord-commands` |
| Nowy serwis w `src/services/` | `deezybot-discord-commands` + `deezybot-testing` |
| Testy (unit / integration / mutation / coverage) | `deezybot-testing` |
| Dashboard Next.js (komponenty, strony, API routes) | `deezybot-dashboard` |
| Auth, sesja NextAuth, RBAC, OAuth2 | `deezybot-dashboard` |
| QOTD, Giveaway, Tickets, Suggestions, Levels, XP | `deezybot-discord-commands` |
| Twitch notifications / integracje zewnętrzne | `deezybot-discord-commands` + `api-rate-limiting` |
| **Każde** zewnętrzne API (Twitch, Discord REST) | `api-rate-limiting` (ZAWSZE) |
| MongoDB schema / Typegoose model / migracja | `deezybot-discord-commands` |
| Deploy / Docker / CI-CD / infrastruktura | `github-actions-cicd` + `vps-deployment-ovh` |
| Security headers, proxy.ts, rate limit, CSRF | `deezybot-dashboard` |
| Shadcn/ui, Tailwind, animacje, design system | `deezybot-dashboard` |
| Observability, monitoring, alerty, health checks | `observability-monitoring` |
| Background jobs, schedulery, cron, workery | `api-rate-limiting` (queue patterns) |
| Meta: planowanie AI-driven workflow, review | `ai-agent-development-workflow` |

## SEKCJA 3 — TWARDY STACK

### 3.1 Bot (Node.js / Discord)

| Kategoria | Technologia | Wersja | Uwagi |
|---|---|---|---|
| Runtime | Node.js | ≥20 LTS | ESM disabled — `"type": "commonjs"` |
| Discord | discord.js | v14.x | Intenty minimalne (zasada least privilege) |
| Language | TypeScript | 5.x strict | `noImplicitAny`, `strictNullChecks` ON |
| DB ODM | Mongoose | 9.x | Schemat definiowany przez Typegoose |
| DI/Models | @typegoose/typegoose | 13.x | Modele w `src/models/` |
| Logger | winston | 3.x | Tylko przez `src/utils/logger.ts` |
| Validation | zod | 3.x | Walidacja env + input komend |
| Scheduler | node-cron | 3.x | Schedulery rejestrowane w `clientReady` |
| Testy | Jest 29 + ts-jest | 29.x | `mongodb-memory-server` dla unit |
| Mutation | Stryker | 8.x | `npm run mutate` |

**Bot directory layout:**
```
src/
  commands/<category>/<commandName>/index.ts  — jeden plik = jedna komenda
  events/<eventName>/<handlerName>.ts          — jeden plik = jeden handler
  services/<domain>Service.ts                  — logika biznesowa
  models/<Domain>.ts                           — Typegoose modele
  handlers/CommandHandler.ts                   — ładuje i rejestruje komendy
  handlers/EventHandler.ts                     — ładuje i rejestruje eventy
  utils/logger.ts                              — winston singleton
  utils/embedHelpers.ts                        — createBaseEmbed / createErrorEmbed
  utils/cooldownHelpers.ts                     — per-user cooldowns
  utils/channelHelpers.ts                      — safe channel operations
  utils/moderationHelpers.ts                   — mod actions
  utils/auditLogHelpers.ts                     — audit log writing
  config/bot.ts                                — OWNER_IDS, DEV_USER_IDS
  config/env.schema.ts                         — zod env schema
  config/guild.ts                              — OWNER_GUILD_IDS
  interfaces/Command.ts                        — ICommand interface
  validations/                                 — reusable validators
  types/                                       — shared TS types
  cache/                                       — in-memory caches (invite, XP, monthly stats)
tests/
  unit/services/                               — serwisy z mongodb-memory-server
  unit/utils/                                  — helpery
  integration/                                 — cross-service testy
  helpers/                                     — test factories, mocks
  mongo/globalSetup.ts + globalTeardown.ts     — mongodb-memory-server lifecycle
```

**Kluczowe konwencje bota:**
- Każda komenda implementuje `ICommand` (name, description, execute, permissions, cooldown)
- Serwisy **zawsze** zwracają `ServiceResult<T>` — nigdy nie rzucają wyjątków na górę
- `ServiceResult<T>` = `{ ok: true; data: T } | { ok: false; error: string; code?: string }`
- Każda komenda sprawdza: `globalCooldown` → `moduleEnabled` → logika
- Embedy używają `createBaseEmbed()` / `createErrorEmbed()` — nigdy surowego `new EmbedBuilder`
- Logger używany wyłącznie przez `logger.info/warn/error/debug` — zero `console.*`
- Konfiguracja gildii ładowana z MongoDB, cache invalidowany po zapisie
- Schedulery (cron) rejestrowane TYLKO w `clientReady` evencie, nie przy imporcie

### 3.2 Dashboard (Next.js)

| Kategoria | Technologia | Wersja | Uwagi |
|---|---|---|---|
| Framework | Next.js | 16.x App Router | `--webpack` flag, bez Turbopack |
| Language | TypeScript | 5.x strict | Identyczne ustawienia co bot |
| Auth | NextAuth.js | v4 | Discord OAuth2, authOptions w `src/lib/auth.config.ts` |
| UI | Shadcn/ui | latest | base: new-york, dark theme |
| Styles | Tailwind CSS | v3/v4 | `bot-primary` gradient, dark theme |
| Cache/RL | ioredis | 5.x | Singleton `src/lib/redis.ts`, tylko Docker network |
| DB | Mongoose | inline schemas | Tylko w route.ts — brak osobnych modeli w dashboard |
| Security | proxy.ts | — | Auth guard + rate limit + Next-Action CSRF |
| Testy | Vitest | 4.x | `npm test` → vitest run |

**Dashboard directory layout:**
```
dashboard-nextjs/src/
  app/
    (auth)/                         — login page, callback
    (dashboard)/[guildId]/          — per-guild pages (RBAC enforced)
    api/
      auth/[...nextauth]/route.ts   — NextAuth handler
      guild/[guildId]/              — bot config API routes
      discord/                      — Discord proxy endpoints
  lib/
    auth.config.ts                  — authOptions (SINGLE source of truth)
    auth.ts                         — quickAuthCheck helper
    owner.ts                        — OWNER_IDS constant
    redis.ts                        — ioredis singleton (globalThis)
    fetchWithAuth.ts                 — authenticated fetch wrapper
  components/
    ui/                             — shadcn primitives (never modify directly)
    dashboard/                      — composed dashboard components
  proxy.ts                          — middleware equiv. (auth + RL + CSRF)
  tests/
    setup.ts                        — vitest global setup
    api/                            — API route unit tests
    components/                     — component tests
```

**Kluczowe konwencje dashboardu:**
- Default = Server Component; `"use client"` tylko gdy potrzebny: hook, event listener, browser API
- `fetchWithAuth` ZAWSZE zamiast natywnego `fetch` z klientem
- Każdy API route: `getServerSession(authOptions)` → 401 bez sesji
- ownerOnly pages: `useSession` + `OWNER_IDS.includes(session.user.id)`
- Mongoose inline schemas w route.ts — nie duplikować modeli bota
- `proxy.ts` blokuje Next-Action requests z obcego origin (scanner protection)
- Redis niedostępny lokalnie — graceful fallback (rate limit pass-through gdy Redis down)

---

## SEKCJA 4 — ARCHITEKTURA SYSTEMU

Szczegóły: `docs/ARCHITECTURE.md`

### 4.1 Multi-tenant design

Bot obsługuje N guildów jednocześnie. Każda gilda ma:
- Własny dokument konfiguracji `GuildConfig` (MongoDB, `guildId` jako partition key)
- Własne dane domenowe (pytania QOTD, tickets, poziomy XP, giveaways, itp.)
- Własne uprawnienia (adminRoles, modRoles, moduleEnabled flags)

**Izolacja tenantów:**
- Każda query Mongoose **MUSI** zawierać `guildId` w filtrze — nigdy `findOne({})` bez scope
- Nigdy nie ładuj danych wielu guildów do cache'u bez jasnej kluczowania po `guildId`
- Dashboard API routes `[guildId]` veryfikują: auth + user ma `MANAGE_GUILD` na tej gildii

### 4.2 Sharding (przyszłe skalowanie)

Gdy bot przekroczy ~2500 guildów, Discord wymaga shardingu:
- Używamy `discord.js ShardingManager` w `src/index.ts`
- Redis pub/sub dla cross-shard komunikacji (inter-shard events)
- Każdy shard to osobny proces Node — nie współdziel in-memory stanu między shardami
- Cache (inviteCache, xpCache, monthlyStatsCache) → muszą być z Redis gdy >1 shard
- Obecnie: single-process, ale pisz kod jakby sharding był włączony (bez global state)

### 4.3 Event-driven architecture

Bot jest event-driven z natury (discord.js EventEmitter):
- Każdy Discord event ma swój folder `src/events/<eventName>/`
- Handler pliki ładowane przez `EventHandler` — zero hardcoded imports
- Schedulery (cron jobs) emitują wewnętrzne eventy (urodziny, stats, giveaway end)
- Żadna logika biznesowa w event handlerach — deleguj do serwisów

### 4.4 Worker i background jobs

- Node-cron schedulery w `clientReady`: birthdays, monthly stats, giveaway end check
- Scheduler register: `registerSchedulers(client)` wywołany raz po `ClientReady`
- Każdy scheduler ma własny logger label i error handling
- Długie operacje (np. export danych, bulk operations) → message queue (future: Redis Queue)
- Nie blokuj event loop — `setImmediate` / async iteration dla bulk

### 4.5 Graceful shutdown

```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — graceful shutdown');
  await mongoose.disconnect();
  client.destroy();
  process.exit(0);
});
```
- Docker `stop` wysyła SIGTERM → bot ma 10s (docker-compose `stop_grace_period: 10s`)
- Zapisz aktualny stan (XP cache flush) przed wyłączeniem
- Dashboard: Next.js obsługuje SIGTERM natywnie

### 4.6 Feature flags

- Per-guild module flags: `guildConfig.modules.<moduleName>.enabled`
- Komenda sprawdza przez `moduleEnabled(guildConfig, 'moduleName')` validation helper
- Hot-reload konfiguracji: po zapisie do MongoDB → invalidate in-memory cache dla guildId
- Nie cachuj konfiguracji bez TTL — nigdy stale config

### 4.7 Circuit breakers i retry

- Discord API: discord.js ma wbudowany rate limit handling — NIE nadpisuj
- Twitch API: `api-rate-limiting` skill → token bucket + exponential backoff + jitter
- MongoDB: mongoose connection pool z `serverSelectionTimeoutMS`, `connectTimeoutMS`
- Redis: graceful degradation gdy Redis niedostępny (catch + log + continue bez cache)
- Nigdy `Promise.all` na bulk Discord API calls — queue + rate limit

---

## SEKCJA 5 — BEZPIECZEŃSTWO

Szczegóły: `docs/SECURITY.md`

### 5.1 Zasady nadrzędne

1. **Deny-by-default**: każda akcja wymaga jawnego zezwolenia
2. **Least privilege everywhere**: Discord intenty minimalne; MongoDB user tylko read/write na swoim DB; Redis NOCOMMANDS poza potrzebnymi
3. **Zero trust**: każde żądanie API weryfikowane niezależnie (brak "trusted internal")
4. **Fail secure**: błąd = odmów dostępu, nie udzielaj
5. **Defense in depth**: wiele warstw kontroli, żadna nie jest jedyną barierą

### 5.2 OWASP Top 10 — mitygacje

| OWASP | Ryzyko | Mitygacja w projekcie |
|---|---|---|
| A01 Broken Access Control | User access cudzej gildii | `guildId` scope w każdej query; `MANAGE_GUILD` check w dashboard |
| A02 Cryptographic Failures | Token storage | Tokeny tylko w `.env`; nigdy w DB bez szyfrowania |
| A03 Injection | NoSQL injection | Mongoose schema typing; nigdy raw `$where`; walidacja Zod przed query |
| A04 Insecure Design | Privilege escalation | OWNER_IDS hardcoded (nie DB); per-guild permission model |
| A05 Security Misconfiguration | Default credentials | Env validation z Zod na starcie; no default passwords |
| A06 Vulnerable Components | Supply chain | `npm audit` w CI; lock files committed; no unreviewed packages |
| A07 Auth Failures | Session hijacking | NextAuth secure cookies; CSRF via proxy.ts; Next-Action origin check |
| A08 SSRF | Discord proxy abuse | Whitelist Discord API domains; nie fetch arbitrary URLs |
| A09 Logging Failures | Brak audit trail | Audit log do MongoDB dla mod actions; structured logs winston |
| A10 SSRF/Request Forgery | Webhook abuse | HMAC verification (jeśli incoming webhooks); rate limiting |

### 5.3 Input validation — pipeline

Każde wejście przez:
1. Discord interaction → `interaction.options.get*()` (typed by discord.js)
2. Zod schema validation przed przekazaniem do serwisu
3. Mongoose schema typing (type enforcement na DB level)
4. Sanitize przed wyświetleniem w embedzie (escape mentions: `@` → zero-width space jeśli potrzeba)

Dashboard:
1. `zod` schema na każdym API route body
2. `getServerSession` → user identity z sesji (nie z body!)
3. `guildId` z URL params, nie z body (prevent parameter pollution)

### 5.4 Secrets management

```
.env                    — lokalnie (gitignored)
.env.example            — template bez wartości (committed)
Docker secrets          — na produkcji (docker secret create)
```

- Walidacja envs przy starcie: `src/config/env.schema.ts` (zod) — brak wymaganego env = crash z czytelnym błędem
- Nigdy `process.env.X` bezpośrednio — tylko przez validated config object
- Rotacja tokenów: po rotacji bot token → restart kontenera wymagany
- `DISCORD_BOT_TOKEN` nigdy w logach — winston ma redaction patterns dla known secrets

### 5.5 Authentication — dashboard

- NextAuth Discord OAuth2: `authOptions` **jedyna** konfiguracja w `src/lib/auth.config.ts`
- Session: JWT strategy z `maxAge: 30d`; refresh przy każdym żądaniu
- Cookie: `httpOnly: true`, `secure: true` (prod), `sameSite: 'lax'`
- CSRF: NextAuth wbudowany double-submit cookie pattern
- Next-Action CSRF: `proxy.ts` blokuje Next-Action z obcego origin → 403
- Rate limiting: ioredis sliding window na IP (proxy.ts) — 100 req/15min per IP

### 5.6 Discord bot security

- Interaction verification: discord.js weryfikuje Ed25519 signature każdej interakcji
- Minimal intents: tylko intenty których faktycznie używamy (np. `GUILD_MESSAGES` tylko jeśli message events potrzebne)
- Guild isolation: każda operacja scope'owana do `guildId` — nie można modyfikować innych guildów
- Owner commands (`ownerOnly: true`): sprawdzane przez `OWNER_IDS` + opcjonalnie `OWNER_GUILD_IDS`
- Mention sanitization: embedy nie powinny pingować @everyone/@here nieintencjonalnie — `allowedMentions: { parse: [] }` jako default
- Anti-spam: per-user cooldown na każdej komendzie + globalCooldown
- Audit logging: każda akcja moderacyjna zapisywana do MongoDB `AuditLog` z userId, action, target, timestamp

---

## SEKCJA 6 — KONWENCJE BACKENDU (BOT)

Szczegóły: `docs/DEVELOPMENT.md`

### 6.1 ServiceResult pattern

```typescript
// src/interfaces/ServiceResult.ts (lub inlines w services/)
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ServiceErrorCode };

type ServiceErrorCode =
  | 'NOT_FOUND' | 'ALREADY_EXISTS' | 'FORBIDDEN'
  | 'INVALID_INPUT' | 'EXTERNAL_API_ERROR' | 'INTERNAL_ERROR';
```

**Zasady:**
- Serwis NIGDY nie rzuca błędów — catch wszystko, return `{ ok: false }`
- Caller sprawdza `result.ok` przed użyciem `result.data`
- Błędy infrastrukturalne (MongoDB down) → `code: 'INTERNAL_ERROR'` + log w serwisie
- Błędy biznesowe (user nie istnieje) → `code: 'NOT_FOUND'` + message po polsku lub EN
- CommandHandler prezentuje `result.error` przez `createErrorEmbed()`

### 6.2 Typescript strict — zakazy

```typescript
// NIGDY:
const x: any = ...          // zakaz any
const y = z as SomeType     // zakaz as (wyjątek: unknown → typed assertion z guard)
// @ts-ignore               // zakaz ts-ignore
// @ts-expect-error         // zakaz bez komentarza dlaczego

// ZAWSZE:
const result = await service.doThing();
if (!result.ok) return createErrorEmbed(result.error);
const data = result.data;   // TypeScript wie że to T
```

### 6.3 Error handling — warstwy

```
Discord event → EventHandler → Handler function
                                  │
                                  ▼
                           Service call (try/catch wewnątrz)
                                  │
                                  ▼
                           ServiceResult<T>
                                  │
                           ┌──────┴──────┐
                           ok            fail
                           │             │
                    send embed    createErrorEmbed + reply
```

- Uncaught exceptions: `process.on('uncaughtException', ...)` → logger.error + graceful shutdown
- Unhandled rejections: `process.on('unhandledRejection', ...)` → logger.error (nie shutdown)
- Discord API errors: discord.js emituje `error` event → logger.error (nie crash)

### 6.4 Logging standards

```typescript
// POPRAWNIE:
logger.info('Giveaway ended', { guildId, giveawayId, winnersCount });
logger.warn('Module disabled, skipping', { guildId, module: 'qotd' });
logger.error('Failed to fetch guild config', { guildId, error: err.message });

// ŹLE:
console.log('Giveaway ended:', giveawayId);                    // zakaz
logger.error(err);                                              // brak kontekstu
logger.info(`Guild ${guildId} joined`);                        // string concat
```

Zawsze loguj: `guildId`, `userId` (jeśli dotyczy), structured `{ key: value }` obiekt.

### 6.5 MongoDB / Typegoose konwencje

- Model: `@modelOptions({ schemaOptions: { timestamps: true, collection: 'name' } })`
- Wszystkie modele mają `guildId: string` (lub analogiczny tenant key)
- Indeksy: `@index({ guildId: 1, userId: 1 })` na polach używanych w filtrach
- Soft delete: `deletedAt?: Date` zamiast `.deleteOne()` dla danych audytowalnych
- Nigdy `Model.find({})` bez scope — zawsze `Model.find({ guildId })`
- Connection jest zarządzana przez singleton w `src/index.ts` — nie otwieraj nowych połączeń

---

## SEKCJA 7 — KONWENCJE FRONTENDU (DASHBOARD)

Szczegóły: `docs/DEVELOPMENT.md`

### 7.1 Server vs Client Components

```
Server Component (domyślnie):
  - Data fetching bezpośrednio (fetch, Mongoose)
  - Nie używa hooków React
  - Nie ma event handlerów przeglądarki
  - SEO-friendly

Client Component ("use client"):
  - Tylko gdy: useState, useEffect, useSession, onClick, useRouter
  - Nie fetchuj danych — przekazuj jako props z Server Component
  - Minimalizuj wielkość client bundle
```

### 7.2 API routes — checklist

Każdy `route.ts` musi mieć:
1. `const session = await getServerSession(authOptions)` — pierwsze 3 linie
2. `if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })`
3. Body validation przez Zod schema
4. `guildId` z `params` (URL), nigdy z body
5. Error handling — try/catch → 500 z sanitized message (nie stack trace)
6. Odpowiedni status code: 200/201/400/401/403/404/500

### 7.3 Bezpieczeństwo XSS / CSP

- Nie używaj `dangerouslySetInnerHTML` — nigdy bez sanitizacji
- Dane z Discord API (nazwy użytkowników, kanałów) traktuj jako untrusted
- `next.config.ts` → security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- CSP: `Content-Security-Policy` zdefiniowane w `proxy.ts` response headers

### 7.4 Performance

- `loading.tsx` dla każdej strony z data fetchingiem (Suspense boundary)
- `error.tsx` dla każdego segmentu (Error boundary)
- `Image` z next/image dla wszystkich obrazów (Discord avatarów, icon)
- Route-level code splitting jest automatyczny w App Router
- `React.memo` / `useMemo` tylko gdy profiler pokazuje problem — nie preoptimizuj

---

## SEKCJA 8 — BAZA DANYCH (MONGODB)

Szczegóły: `docs/DATABASE.md`

### 8.1 Multi-tenant isolation

```typescript
// ZAWSZE:
await GuildConfig.findOne({ guildId: interaction.guildId });

// NIGDY:
await GuildConfig.findOne({ name: 'something' });  // brak guildId scope!
await GuildConfig.find({});                         // zwraca dane WSZYSTKICH guildów!
```

Każdy model z danymi gildii **musi** mieć:
- `guildId: string` jako indeksowane pole
- Compound index: `{ guildId: 1, <secondary_field>: 1 }` dla częstych zapytań
- `createdAt`, `updatedAt` (timestamps: true)

### 8.2 Audit trail

Każda akcja moderacyjna / zapis do `AuditLog`:
```typescript
await AuditLog.create({
  guildId,
  actorId: userId,
  action: 'BAN',
  targetId,
  reason,
  metadata: { duration },
  timestamp: new Date(),
});
```

### 8.3 Bezpieczeństwo

- MongoDB Atlas: sieciowy ACL (tylko VPS IP + localhost test)
- Connection string w `MONGODB_URI` env (nigdy w kodzie)
- Mongoose: `sanitizeFilter: true` (ochrona przed NoSQL injection przez `$where`, `$regex`)
- Brak `eval()` / `$where` operatorów — zawsze typed queries

---

## SEKCJA 9 — DEVOPS / INFRASTRUKTURA

Szczegóły: `docs/DEVOPS.md`

### 9.1 Docker

```yaml
# docker-compose.yml struktura:
services:
  bot:        # discord bot
  dashboard:  # next.js
  redis:      # redis:7-alpine (tylko wewnętrzna sieć)
```

- Bot i dashboard mają osobne Dockerfile'y (`Dockerfile.bot`, `Dockerfile.dashboard`)
- Multi-stage builds: builder → production (bez devDependencies)
- Non-root user w Dockerfile (`USER node`)
- Health check: `healthcheck:` na każdym serwisie
- Logi: `logging: driver: json-file, max-size: 10m, max-file: 3`
- Redis **nie jest** exposowany na zewnątrz sieci Docker
- `.env` przekazywane przez `env_file:` — nie `environment:` (unika eksponowania w `docker inspect`)

### 9.2 CI/CD

- GitHub Actions: `.github/workflows/`
- Pipeline: `lint` → `typecheck` → `test` → `build` → `deploy`
- Testy muszą przejść zanim deploy się uruchomi
- Secrets w GitHub Secrets (nie w plikach)
- Deploy: `docker compose pull && docker compose up -d --build`
- Rollback: poprzedni image w Docker registry

### 9.3 Monitoring / Observability

- Winston structured logs → `/logs/` → potencjalnie Loki (future)
- Health endpoint dashboard: `/api/health` → 200 gdy DB i Redis OK
- Discord `error` event → logger.error → alert (future: Discord webhook na owner DM)
- `npm run test:coverage` w CI — fail jeśli poniżej thresholdów
- `npm audit` w CI — fail jeśli critical/high vulnerabilities

---

## SEKCJA 10 — TESTOWANIE

Szczegóły: `docs/TESTING.md`

### 10.1 Coverage thresholds (bot)

```javascript
// jest.config.js
coverageThreshold: {
  global: { statements: 90, branches: 80, functions: 90, lines: 90 }
}
```

NIE obniżaj thresholdów — znajdź pokrycie, nie wyłączaj sprawdzania.

### 10.2 Test file konwencje

```
tests/
  unit/services/<domain>Service.test.ts    — test serwisu, mongodb-memory-server
  unit/utils/<helper>.test.ts              — test utility
  integration/<feature>.test.ts            — cross-service
  helpers/<factory>.ts                     — test data factories
  mongo/globalSetup.ts                     — mongodb-memory-server start
  mongo/globalTeardown.ts                  — mongodb-memory-server stop
```

Dashboard:
```
src/tests/
  api/<route>.test.ts                      — API route z mock mongoose + mock getServerSession
  components/<Component>.test.tsx          — React Testing Library
  <domain>.test.ts                         — utility tests
  setup.ts                                 — @testing-library/jest-dom
```

### 10.3 Zasady pisania testów

- Jeden test = jedno zachowanie (nie testuj dwóch rzeczy w jednym `it`)
- Arrange-Act-Assert (AAA) pattern
- Mockuj zewnętrzne zależności (Discord API, Twitch API) — nigdy real calls w testach
- Używaj `mongodb-memory-server` dla testów z MongoDB — nie testuj na Atlas
- Factory functions dla test data — nie hardcoduj danych w testach
- Po każdej nowej funkcji: napisz test ZANIM zmergeujesz (TDD gdzie możliwe)

---

## SEKCJA 11 — JAKOŚĆ KODU

Szczegóły: `docs/DEVELOPMENT.md`

### 11.1 TypeScript

- `strict: true` w tsconfig — nie wyłączaj żadnej opcji strict
- `noImplicitAny: true` — każde pole musi mieć typ
- Absolute imports: `@/` alias dla `src/` w dashboardzie
- Unikaj `as` cast — użyj type guard (`isServiceError(x)`)
- Prefer `unknown` nad `any` gdy typ nieznany
- Interface dla obiektów domenowych; `type` dla union types

### 11.2 ESLint / Prettier

- ESLint: konfiguracja w `.eslintrc.js` (nie modyfikuj bez powodu)
- Prettier: `.prettierrc` — auto-format przy save
- Husky + lint-staged: przed commitem → lint + format (future: włącz)
- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`

### 11.3 Circular dependencies

- Zakazane — `madge` lub `dpdm` do detekcji
- `models/` nie importuje z `services/`
- `utils/` nie importuje z `services/` ani `models/`
- `services/` mogą importować `models/` i `utils/` — nie inne `services/` (przez eventy)

---

## SEKCJA 12 — WORKFLOW I CHECKLISTY

Szczegóły: `docs/DEVELOPMENT.md`

### 12.1 PR checklist (przed każdym merge)

- [ ] Testy napisane / zaktualizowane dla każdej zmiany
- [ ] `npm test` przechodzi lokalnie (coverage nie spada)
- [ ] `npm run check:types` — zero błędów TypeScript
- [ ] Brak `console.log` w kodzie (grep check)
- [ ] Brak `any` w nowym kodzie
- [ ] Sekrety nie są w plikach (grep dla typowych tokenów)
- [ ] `guildId` scope w każdej nowej query MongoDB
- [ ] API routes mają `getServerSession` check
- [ ] Nowe zależności sprawdzone: `npm audit --audit-level=high`

### 12.2 Security checklist (przy zmianach auth/API/webhook)

- [ ] Input validation Zod przed każdą operacją
- [ ] No SQL/NoSQL injection possibility (Mongoose typed, sanitizeFilter)
- [ ] Rate limiting na nowym endpoincie
- [ ] Auth check w każdym route (nie polegaj na middleware global)
- [ ] CORS policy nie rozszerzona bez powodu
- [ ] Żadne dane wrażliwe w logach (token, hasło, email)
- [ ] Nowe Discord intenty są minimalne i konieczne

### 12.3 Deploy checklist

- [ ] Testy przeszły w CI
- [ ] Migracje danych (jeśli zmiana schema) — wykonane ręcznie lub migration script
- [ ] `.env` na VPS zaktualizowane (nowe zmienne)
- [ ] `docker compose up --build -d` (nie `restart` — rebuild image)
- [ ] Health check po deployu: `docker compose ps` — wszystkie `healthy`
- [ ] Logi sprawdzone: `docker compose logs -f dashboard --tail=50`

### 12.4 Disaster recovery

- MongoDB Atlas: automated backups (daily) + point-in-time restore
- `./logs/` → periodically archived (logrotate lub scp do backup storage)
- Przy awarii: `docker compose down && docker compose up -d` (stateless containers)
- Przy data corruption: przywróć Atlas backup → replay event logs (jeśli audit trail kompletny)

---

## SEKCJA 13 — CZEGO NIE ROBIĆ

```
❌  console.log  — tylko logger.*
❌  any          — TypeScript strict, zawsze typuj
❌  as X         — użyj type guard
❌  npm install  — sprawdź stack, użyj npm install (projekt używa npm)
❌  hardcoded tokens/IDs — tylko przez .env
❌  find({}) bez guildId scope — zawsze scope do tenanta
❌  ServiceResult ignorowany — sprawdź ok przed data
❌  getServerSession pominięte — każdy API route!
❌  console.error w serwisie — ServiceResult + logger.error
❌  Promise.all na bulk Discord calls — queue + rate limit
❌  *.md podsumowania zmian — nie twórz bez prośby usera
❌  ts-ignore bez wyjaśnienia — zawsze opisz dlaczego
❌  Nowe intenty Discord bez uzasadnienia — least privilege
❌  Raw MongoDB queries bez Mongoose — zawsze przez ODM
❌  Tokeny OAuth w logach — redact before logging
```

---

## SEKCJA 14 — WORKSPACE

```
c:\Dyzio\Deezy\               — bot monorepo root
  src/                        — bot TypeScript source
  tests/                      — bot testy (Jest)
  dashboard-nextjs/           — Next.js dashboard
    src/                      — dashboard TypeScript source
    src/tests/                — dashboard testy (Vitest)
  docker-compose.yml          — serwisy: bot, dashboard, redis
  Dockerfile.bot
  Dockerfile.dashboard
  .github/
    workflows/                — CI/CD (do zaimplementowania)
    copilot-instructions.md   — auto-load Copilot rules
  docs/
    ARCHITECTURE.md
    SECURITY.md
    DEVELOPMENT.md
    TESTING.md
    DEVOPS.md
    DATABASE.md
  logs/                       — winston file logs
  AGENTS.md                   — ten plik
```

**Środowisko produkcyjne:** VPS Ubuntu, Docker Compose, Nginx reverse proxy → port 3000 (dashboard), MongoDB Atlas, Redis inside Docker network.

## Komunikacja

- Odpowiadaj po polsku jeśli user pisze po polsku
- Bądź zwięzły — edytuj pliki zamiast wklejać kod w czacie
- Po każdej nowej funkcji / zmianie API → utwórz/zaktualizuj test
- Nie twórz plików `*.md` z podsumowaniami bez prośby użytkownika
