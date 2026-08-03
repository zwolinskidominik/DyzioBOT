# DyzioBOT — Testing Strategy

> Pełna strategia testów — bot (Jest 29) + dashboard (Vitest 4).  
> Coverage target: 90/80/90/90. Testy są obowiązkowe — nie ma merge bez testów.

---

## 1. OVERVIEW

| Warstwa | Framework | Środowisko | Lokalizacja |
|---|---|---|---|
| Bot unit | Jest 29 + ts-jest | Node.js + mongodb-memory-server | `tests/unit/` |
| Bot integration | Jest 29 + ts-jest | Node.js + mongodb-memory-server | `tests/integration/` |
| Bot mutation | Stryker 8 | Node.js | `stryker.conf.json` |
| Dashboard unit | Vitest 4 | jsdom | `dashboard-nextjs/src/tests/` |
| Dashboard API | Vitest 4 | Node.js (node env) | `dashboard-nextjs/src/tests/api/` |
| Dashboard E2E | Playwright (future) | Browser | TBD |

---

## 2. BOT TESTY (JEST)

### 2.1 Coverage thresholds

```javascript
// jest.config.js — NIE obniżaj tych wartości
coverageThreshold: {
  global: {
    statements: 90,
    branches: 80,   // branches trudniejsze — 80% wystarczy
    functions: 90,
    lines: 90,
  }
}
```

Jeśli coverage spada: dodaj testy, nie obniżaj threshold.

### 2.2 Struktura plików testowych

```
tests/
  mongo/
    globalSetup.ts          — uruchamia mongodb-memory-server przed wszystkimi testami
    globalTeardown.ts       — zatrzymuje mongodb-memory-server po wszystkich testach
  integration/
    setup.ts                — beforeEach: wyczyść kolekcje; afterEach: cleanup
    services/               — cross-service tests (przyszłe)
  unit/
    services/
      giveawayService.test.ts
      questionService.test.ts
      xpService.test.ts
      ticketService.test.ts
      ... (jeden plik na serwis)
    utils/
      embedHelpers.test.ts
      cooldownHelpers.test.ts
      channelHelpers.test.ts
  helpers/
    factories.ts            — factory functions dla test data
    mocks/
      discordMocks.ts       — mock Client, Guild, Interaction
      twitchMocks.ts        — mock Twitch API responses
```

### 2.3 globalSetup / globalTeardown

```typescript
// tests/mongo/globalSetup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

export default async function globalSetup(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  (global as any).__MONGOD__ = mongod;
}

// tests/mongo/globalTeardown.ts
export default async function globalTeardown(): Promise<void> {
  const mongod = (global as any).__MONGOD__;
  if (mongod) await mongod.stop();
}
```

### 2.4 Integration setup

```typescript
// tests/integration/setup.ts
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from '@jest/globals';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  // Wyczyść wszystkie kolekcje przed każdym testem
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

### 2.5 Wzorzec testu serwisu

```typescript
// tests/unit/services/giveawayService.test.ts
import mongoose from 'mongoose';
import { createGiveaway, endGiveaway, listActiveGiveaways } from '../../../src/services/giveawayService';
import { GiveawayModel } from '../../../src/models/Giveaway';
import { createGiveawayFactory } from '../../helpers/factories';

const GUILD_ID = 'test-guild-123';
const CHANNEL_ID = 'test-channel-456';
const USER_ID = 'test-user-789';

describe('giveawayService', () => {
  describe('createGiveaway', () => {
    it('creates giveaway with correct guildId scope', async () => {
      const result = await createGiveaway({
        guildId: GUILD_ID,
        channelId: CHANNEL_ID,
        creatorId: USER_ID,
        prize: 'Nitro 1 miesiąc',
        winnerCount: 1,
        endsAt: new Date(Date.now() + 86400000),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return; // TypeScript narrowing
      expect(result.data.guildId).toBe(GUILD_ID);
      expect(result.data.prize).toBe('Nitro 1 miesiąc');
    });

    it('returns NOT_FOUND error for invalid winnersCount', async () => {
      const result = await createGiveaway({
        guildId: GUILD_ID,
        channelId: CHANNEL_ID,
        creatorId: USER_ID,
        prize: 'Prize',
        winnerCount: 0,  // invalid
        endsAt: new Date(Date.now() + 86400000),
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('INVALID_INPUT');
    });

    it('isolates data — cannot access other guild giveaways', async () => {
      await createGiveaway({ guildId: GUILD_ID, ...validData });
      await createGiveaway({ guildId: 'other-guild', ...validData });

      const result = await listActiveGiveaways(GUILD_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Tylko giveaways z GUILD_ID
      result.data.forEach(g => expect(g.guildId).toBe(GUILD_ID));
    });
  });

  describe('endGiveaway', () => {
    it('selects correct number of winners', async () => { ... });
    it('returns ALREADY_EXISTS when giveaway already ended', async () => { ... });
    it('handles case when entries are empty gracefully', async () => { ... });
  });
});
```

### 2.6 Factory functions

```typescript
// tests/helpers/factories.ts
import { Types } from 'mongoose';

export function createGuildId(): string {
  return `guild-${Math.random().toString(36).substr(2, 9)}`;
}

export function createUserId(): string {
  return `user-${Math.random().toString(36).substr(2, 9)}`;
}

export function createGiveawayData(overrides?: Partial<GiveawayData>): GiveawayData {
  return {
    guildId: createGuildId(),
    channelId: 'channel-123',
    creatorId: createUserId(),
    prize: 'Test prize',
    winnerCount: 1,
    endsAt: new Date(Date.now() + 86400000),
    ...overrides,
  };
}
```

### 2.7 Discord mocks

```typescript
// tests/helpers/mocks/discordMocks.ts
import { jest } from '@jest/globals';

export function createMockInteraction(overrides?: Partial<MockInteraction>): MockInteraction {
  return {
    guildId: 'test-guild',
    user: { id: 'test-user', username: 'TestUser' },
    guild: { id: 'test-guild', name: 'Test Server' },
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    options: {
      getString: jest.fn(),
      getInteger: jest.fn(),
      getUser: jest.fn(),
      getMember: jest.fn(),
    },
    ...overrides,
  };
}

export function createMockClient(): MockClient {
  return {
    guilds: {
      cache: new Map(),
      fetch: jest.fn(),
    },
    channels: {
      fetch: jest.fn(),
    },
    users: {
      fetch: jest.fn(),
    },
  };
}
```

---

## 3. DASHBOARD TESTY (VITEST)

### 3.1 Config

```typescript
// dashboard-nextjs/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

### 3.2 Struktura testów

```
dashboard-nextjs/src/tests/
  setup.ts                     — @testing-library/jest-dom
  api/
    qotd-questions.test.ts     — API route tests (mock mongoose + getServerSession)
    guild-config.test.ts
  components/
    EmojiDisplay.test.ts       — utility functions tests
    GuildSelector.test.tsx     — React component tests
  proxy.test.ts                — Next-Action CSRF guard
```

### 3.3 API route test pattern

```typescript
// src/tests/api/qotd-questions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getServerSession PRZED importem route
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock mongoose - używaj class/function (nie arrow) dla konstruktora
vi.mock('mongoose', () => {
  class Schema {}
  const mockFind = vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue([]) });
  const mockFindOneAndUpdate = vi.fn();
  
  function QuestionModelMock(this: any, data: any) {
    Object.assign(this, data);
  }
  QuestionModelMock.prototype.save = vi.fn().mockResolvedValue(this);
  QuestionModelMock.find = mockFind;
  QuestionModelMock.findOneAndUpdate = mockFindOneAndUpdate;

  return {
    default: { Schema, model: vi.fn(() => QuestionModelMock), connect: vi.fn() },
    Schema,
    model: vi.fn(() => QuestionModelMock),
  };
});

import { getServerSession } from 'next-auth';
import { GET, PATCH } from '@/app/api/guild/[guildId]/qotd/questions/route';

const mockSession = { user: { id: 'user-123', name: 'TestUser' } };

describe('GET /api/guild/[guildId]/qotd/questions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = new Request('http://localhost/api/guild/123/qotd/questions');
    const res = await GET(req, { params: { guildId: '123' } });
    expect(res.status).toBe(401);
  });

  it('returns disabled questions when ?disabled=true', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    // ...
  });
});
```

### 3.4 Component test pattern

```typescript
// src/tests/components/GuildSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { GuildSelector } from '@/components/dashboard/GuildSelector';

describe('GuildSelector', () => {
  const guilds = [
    { id: '1', name: 'Server A', icon: null },
    { id: '2', name: 'Server B', icon: 'abc123' },
  ];

  it('renders guild names', () => {
    render(<GuildSelector guilds={guilds} onSelect={() => {}} />);
    expect(screen.getByText('Server A')).toBeInTheDocument();
    expect(screen.getByText('Server B')).toBeInTheDocument();
  });

  it('calls onSelect with guild id when clicked', () => {
    const onSelect = vi.fn();
    render(<GuildSelector guilds={guilds} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Server A'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });
});
```

---

## 4. MUTATION TESTING (STRYKER)

```bash
npm run mutate  # uruchamia Stryker mutation testing
```

**Co testuje Stryker:**
- Czy testy faktycznie wykrywają błędy w kodzie
- Mutation score ≥ 70% jest akceptowalny

**Kiedy uruchamiać:**
- Przed release
- Po dodaniu krytycznej logiki biznesowej (giveaway winner selection, XP calculation)

---

## 5. ZASADY PISANIA TESTÓW

### 5.1 AAA Pattern (Arrange-Act-Assert)

```typescript
it('adds XP to user and levels up when threshold reached', async () => {
  // Arrange
  const guildId = 'guild-123';
  const userId = 'user-456';
  await UserXP.create({ guildId, userId, xp: 990 });  // blisko level-up
  
  // Act
  const result = await xpService.addXP(guildId, userId, 15);
  
  // Assert
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.xp).toBe(1005);
  expect(result.data.level).toBe(2);       // powinien awansować
  expect(result.data.leveledUp).toBe(true);
});
```

### 5.2 Jeden test = jedno zachowanie

```typescript
// ❌ ZA DUŻO w jednym teście:
it('creates giveaway, adds entry, and ends it', async () => {
  const g = await createGiveaway(...);
  await addEntry(g.id, userId);
  const winner = await endGiveaway(g.id);
  expect(winner).toBeDefined();
  // Trudno zlokalizować co się posypało
});

// ✅ Osobne testy:
it('creates giveaway with valid data', async () => { ... });
it('adds entry to giveaway', async () => { ... });
it('selects winner when giveaway ends', async () => { ... });
```

### 5.3 Edge cases — zawsze testuj

Dla każdej funkcji testuj:
- Happy path (nominalny przypadek)
- Empty/null input
- Boundary values (0, max, -1)
- Concurrent operations (jeśli relevant)
- guildId isolation (cross-tenant access prevention)
- Error cases (DB fail, not found, forbidden)

### 5.4 Nie testuj internals — testuj zachowanie

```typescript
// ❌ Testowanie implementacji:
it('calls Model.findOne once with correct args', async () => {
  const spy = jest.spyOn(GiveawayModel, 'findOne');
  await getGiveaway('123');
  expect(spy).toHaveBeenCalledWith({ _id: '123' });
});

// ✅ Testowanie zachowania:
it('returns NOT_FOUND when giveaway does not exist', async () => {
  const result = await getGiveaway('nonexistent-id');
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe('NOT_FOUND');
});
```

---

## 6. CI TEST PIPELINE

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  bot-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run check:types
      - run: npm test -- --coverage
      - run: npm audit --audit-level=high

  dashboard-tests:
    runs-on: ubuntu-latest
    defaults:
      run: { working-directory: dashboard-nextjs }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: 'dashboard-nextjs/package-lock.json' }
      - run: npm ci
      - run: npm run check:types
      - run: npm test
      - run: npm audit --audit-level=high
```

---

## 7. COVERAGE REQUIREMENTS

| Metryka | Bot threshold | Dashboard target |
|---|---|---|
| Statements | 90% | 80% |
| Branches | 80% | 70% |
| Functions | 90% | 80% |
| Lines | 90% | 80% |

**Wyłączenia z coverage (uzasadnione):**
```javascript
// jest.config.js
collectCoverageFrom: [
  'src/**/*.{ts,js}',
  '!src/index.ts',          // entry point — trudno testować
  '!src/scripts/**',        // jednorazowe skrypty
  '!src/**/*.d.ts',         // type declarations
]
```

**Nowe pliki zawsze uwzględnione w coverage** — nie dodawaj do excludelist bez uzasadnienia.
</content>
</invoke>