# DyzioBOT — Development Standards

> Standardy kodu, workflow, konwencje, checklisty dla całego projektu.  
> Poziom: Senior. Każdy PR musi spełniać te standardy.

---

## 1. TYPESCRIPT STANDARDS

### 1.1 Strict mode — zawsze ON

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Zakazy — nigdy w kodzie produkcyjnym:**
```typescript
const x: any = ...;              // ❌ zakaz any
const y = z as SomeType;        // ❌ zakaz as (wyjątek: unknown → typed z guard)
// @ts-ignore                   // ❌ zakaz ts-ignore
// @ts-expect-error: ...        // ✅ ok z wyjaśnieniem dlaczego
Object.keys(obj) as string[];   // ❌ już jest string[], nie potrzeba cast
```

**Dozwolone wzorce:**
```typescript
// Type guard (zamiast 'as'):
function isServiceError(result: ServiceResult<unknown>): result is { ok: false; error: string } {
  return !result.ok;
}

// Unknown zamiast any:
async function parseWebhookBody(req: Request): Promise<unknown> {
  return req.json();
}

// Discriminated unions:
type LoadingState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
```

### 1.2 Naming conventions

```typescript
// Interfaces: prefix I dla domain interfaces
interface ICommand { name: string; execute: (...) => Promise<void> }
interface IGuildConfig { guildId: string; ... }

// Types: PascalCase
type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
type ServiceErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL_ERROR';

// Enums: PascalCase, wartości UPPER_SNAKE
enum ModAction { BAN = 'BAN', KICK = 'KICK', WARN = 'WARN' }

// Funkcje: camelCase, czasownik + rzeczownik
async function createGiveaway(...) {}
async function findUserByGuildAndId(...) {}
async function handleGuildMemberAdd(...) {}

// Stałe: UPPER_SNAKE_CASE
const OWNER_IDS = ['...'] as const;
const MAX_EMBED_LENGTH = 4096;

// Pliki: kebab-case dla utils, PascalCase dla modeli/klas
// giveawayService.ts, createBaseEmbed.ts, GuildConfig.ts (model)
```

### 1.3 Import order

```typescript
// 1. Node.js built-ins
import { createHmac } from 'crypto';
import path from 'path';

// 2. External packages
import { Client, GatewayIntentBits } from 'discord.js';
import { getModelForClass } from '@typegoose/typegoose';

// 3. Internal absolute (@/ alias)
import { config } from '@/config';
import { logger } from '@/utils/logger';

// 4. Relative imports
import { GuildConfigModel } from '../models/GuildConfig';
import type { ServiceResult } from './types';
```

---

## 2. SERVICERESULT PATTERN (BOT)

### 2.1 Definicja

```typescript
// src/interfaces/ServiceResult.ts
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ServiceErrorCode };

export type ServiceErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'EXTERNAL_API_ERROR'
  | 'INTERNAL_ERROR';
```

### 2.2 Implementacja w serwisach

```typescript
// ✅ POPRAWNIE:
export async function addQuestion(
  guildId: string,
  content: string,
  authorId: string
): Promise<ServiceResult<IQuestion>> {
  try {
    if (!content.trim()) {
      return { ok: false, error: 'Treść pytania nie może być pusta.', code: 'INVALID_INPUT' };
    }

    const existing = await QuestionModel.findOne({ guildId, content });
    if (existing) {
      return { ok: false, error: 'To pytanie już istnieje.', code: 'ALREADY_EXISTS' };
    }

    const question = await QuestionModel.create({ guildId, content, authorId });
    return { ok: true, data: question };
  } catch (err) {
    logger.error('addQuestion failed', { guildId, error: (err as Error).message });
    return { ok: false, error: 'Błąd serwera.', code: 'INTERNAL_ERROR' };
  }
}

// ✅ POPRAWNIE w command:
const result = await questionService.addQuestion(guildId, content, userId);
if (!result.ok) {
  return interaction.editReply({ embeds: [createErrorEmbed(result.error)] });
}
// result.data jest tutaj typed jako IQuestion
```

### 2.3 Czego nie robić

```typescript
// ❌ NIE rzucaj z serwisu:
export async function addQuestion(...): Promise<IQuestion> {
  const q = await QuestionModel.create({...});
  return q;  // Jeśli rzuci — nie jest obsłużone w komendzie
}

// ❌ NIE ignoruj result.ok:
const result = await questionService.addQuestion(...);
console.log(result.data.content);  // TypeError jeśli ok: false
```

---

## 3. LOGGING STANDARDS

### 3.1 Winston logger — jedyny logger

```typescript
// src/utils/logger.ts — singleton
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()  // structured logs zawsze JSON
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

### 3.2 Jak logować

```typescript
// ✅ Structured logging — zawsze obiekt jako drugi argument:
logger.info('Command executed', { guildId, userId, command: 'ban', targetId });
logger.warn('Module disabled', { guildId, module: 'giveaway' });
logger.error('MongoDB query failed', { guildId, collection: 'GuildConfig', error: err.message });
logger.debug('Cache miss', { key: `config:${guildId}`, ttl: 300 });

// ❌ NIGDY:
console.log('Command:', commandName);          // console.log zakaz
logger.info(`Guild ${guildId} did something`); // template string w message
logger.error(err);                              // obiekt Error bez kontekstu
logger.info('Error: ' + err.message);          // konkatenacja
```

### 3.3 Sensitive data — nigdy w logach

```typescript
// ❌ Nigdy nie loguj:
logger.info('Token loaded', { token: config.botToken });          // token
logger.info('DB connected', { uri: config.mongoUri });            // connection string
logger.info('User session', { accessToken: session.accessToken }); // OAuth token
logger.info('Guild member', { userId, email });                    // PII

// ✅ Loguj ID, nie dane:
logger.info('User authenticated', { userId: session.user.id });  // tylko ID
```

---

## 4. ERROR HANDLING

### 4.1 Bot error hierarchy

```
process.on('uncaughtException')   → logger.error + graceful shutdown (fatal)
process.on('unhandledRejection')  → logger.error (nie shutdown — może się zdarzyć)
client.on('error')                → logger.error (discord.js connectivity)
EventHandler try/catch            → logger.error (handler nie crashuje process)
Service try/catch                 → ServiceResult { ok: false } (kontrolowany błąd)
```

### 4.2 Dashboard error handling

```typescript
// API Route:
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // logika...
    return Response.json({ success: true });
  } catch (err) {
    logger.error('API route failed', { path: req.url, error: (err as Error).message });
    return Response.json({ error: 'Internal server error' }, { status: 500 });
    // Nie zwracaj stack trace — to security risk
  }
}
```

---

## 5. EMBED HELPERS

```typescript
// ✅ ZAWSZE createBaseEmbed / createErrorEmbed:
const embed = createBaseEmbed()
  .setTitle('Giveaway zakończony!')
  .setDescription(`Zwycięzca: <@${winnerId}>`)
  .setColor(0x00ff00);

const errorEmbed = createErrorEmbed('Nie znaleziono giveaway o podanym ID.');

// ❌ NIGDY raw EmbedBuilder:
const embed = new EmbedBuilder()
  .setTitle('...')
  .setColor(0xff0000);
// Brak standaryzacji koloru, footera, branding
```

---

## 6. GIT WORKFLOW

### 6.1 Branch strategy

```
main          ← produkcja, chroniony (require PR + review)
develop       ← staging, integracja feature branchy
feature/*     ← nowe feature (feature/qotd-suggestions)
fix/*         ← bugi (fix/giveaway-winner-null)
chore/*       ← maintenance (chore/update-dependencies)
hotfix/*      ← pilne bugi na prod (hotfix/security-patch)
```

### 6.2 Conventional commits

```
feat(qotd): add suggestion system with approval queue
fix(giveaway): handle null winner when all entries invalid
chore(deps): update discord.js to 14.15.0
test(qotd): add unit tests for suggestionService
docs: update API route conventions in DEVELOPMENT.md
refactor(xp): extract cooldown logic to xpCooldownHelper
security: patch NoSQL injection in guildConfig filter
```

Format: `<type>(<scope>): <description>`

Typy: `feat`, `fix`, `chore`, `test`, `docs`, `refactor`, `security`, `perf`, `ci`

### 6.3 PR requirements

Każdy PR musi mieć:
1. Opis co zmienia i dlaczego
2. Link do issue (jeśli istnieje)
3. Screenshot / demo (jeśli UI change)
4. `npm test` — wszystkie testy przechodzą
5. `npm run check:types` — zero TypeScript errors
6. Coverage nie spada poniżej thresholdów

---

## 7. CODE REVIEW STANDARDS

### 7.1 Co reviewować

**Bezpieczeństwo (blokujące):**
- Brak `getServerSession` w API route → odrzuć
- `guildId` z body zamiast URL params → odrzuć
- `find({})` bez scope → odrzuć
- Hardcoded token / secret → odrzuć
- `any` → odrzuć (chyba że z uzasadnieniem)

**Jakość (wymagające poprawy):**
- `console.log` w kodzie → zastąp `logger.*`
- Brak testu dla nowej logiki → wymagaj testu
- ServiceResult ignorowany → wymagaj sprawdzenia `.ok`
- Circular dependencies → wymagaj refaktoru

**Sugestia (nieblokujące):**
- Nazewnictwo, czytelność
- Optymalizacja zapytań DB
- Dodatkowe testy edge cases

### 7.2 Review checklist

```
Security:
  [ ] guildId scope w każdej query
  [ ] auth check w API routes
  [ ] brak wrażliwych danych w logach
  [ ] brak hardcoded secrets

Code quality:
  [ ] brak any/as
  [ ] brak console.log
  [ ] ServiceResult sprawdzany
  [ ] testy napisane/zaktualizowane

Architecture:
  [ ] logika biznesowa w serwisach (nie w handlerach)
  [ ] brak circular dependencies
  [ ] konwencje embeds (createBaseEmbed)
```

---

## 8. ONBOARDING NOWEGO DEVELOPERA

### 8.1 Setup (30 minut)

```bash
# 1. Clone
git clone <repo-url>
cd Deezy

# 2. Install dependencies
npm install
cd dashboard-nextjs && npm install && cd ..

# 3. Copy env template
cp .env.example .env
# Uzupełnij .env: DISCORD_BOT_TOKEN, MONGODB_URI, NEXTAUTH_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET

# 4. Verify TypeScript
npm run check:types

# 5. Run tests
npm test
cd dashboard-nextjs && npm test

# 6. Start dev (bot)
npm run dev

# 7. Start dev (dashboard)
cd dashboard-nextjs && npm run dev
```

### 8.2 Must-read (kolejność)

1. Ten plik (DEVELOPMENT.md) — standardy
2. `docs/ARCHITECTURE.md` — jak system działa
3. `docs/SECURITY.md` — zagrożenia i mitigacje
4. `docs/DATABASE.md` — MongoDB conventions
5. `AGENTS.md` — pełne instrukcje AI agenta (też dobry kontekst dla ludzi)

### 8.3 Pierwsze zadanie

Zanim zrobisz cokolwiek:
1. Przejrzyj istniejącą komendę (np. `src/commands/fun/`)
2. Przejrzyj istniejący serwis (np. `src/services/giveawayService.ts`)
3. Przejrzyj istniejące testy (np. `tests/unit/services/`)
4. Napisz test dla istniejącej funkcji bez testów (dobry start)

---

## 9. PERFORMANCE GUIDELINES

### 9.1 Bot performance

```typescript
// ✅ Batch DB operations zamiast N+1:
const allConfigs = await GuildConfig.find({ guildId: { $in: guildIds } });  // ✅ jeden query

// ❌ N+1 problem:
for (const guildId of guildIds) {
  const config = await GuildConfig.findOne({ guildId });  // N queries
}

// ✅ Pagination dla dużych kolekcji:
const questions = await Question.find({ guildId })
  .sort({ createdAt: -1 })
  .skip(page * PAGE_SIZE)
  .limit(PAGE_SIZE);

// ✅ Lean queries gdy nie potrzebujesz Mongoose methods:
const configs = await GuildConfig.find({ guildId }).lean();  // 2-3x szybsze
```

### 9.2 Dashboard performance

```typescript
// ✅ Parallel fetching w Server Components:
const [config, questions, stats] = await Promise.all([
  fetchGuildConfig(guildId),
  fetchQuestions(guildId),
  fetchStats(guildId),
]);

// ✅ Suspense boundaries dla niezależnych sekcji:
// <Suspense fallback={<SkeletonCard />}><ExpensiveComponent /></Suspense>

// ✅ React.cache() dla deduplication w SSR:
const getGuildConfig = cache(async (guildId: string) => {
  return GuildConfigModel.findOne({ guildId }).lean();
});
```

---

## 10. ACCESSIBILITY (DASHBOARD)

- Shadcn/ui komponenty są WCAG 2.1 AA compliant — używaj ich
- Każdy interaktywny element ma `aria-label` jeśli tekst nie jest oczywisty
- Keyboard navigation: Tab → focus visible, Enter/Space → activate
- Kolory: kontrast minimum 4.5:1 (WCAG AA) — weryfikuj w Chrome DevTools
- Formularze: każde pole ma `<label>` lub `aria-label`
- Loadery: `aria-busy="true"` podczas ładowania
- Error messages: `role="alert"` dla krytycznych komunikatów

---

## 11. I18N (FUTURE)

Obecny stan: UI wyłącznie po polsku (bot i dashboard).

Przy wprowadzeniu i18n:
- Dashboard: `next-intl` lub `react-i18next`
- Bot: pliki lokalowe w `src/locales/<lang>/`
- Strings: nigdy hardcoded w komponentach — zawsze przez translation key
- Domyślny język: `pl`
</content>
</invoke>