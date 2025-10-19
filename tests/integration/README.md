# Integration Tests

Testy integracyjne sprawdzają współpracę komponentów aplikacji w środowisku zbliżonym do produkcyjnego, ale z kontrolowanymi zależnościami zewnętrznymi.

## Struktura Katalogów

### 📁 `setup/`
**Przeznaczenie:** Konfiguracja środowiska testowego i lifecycle bazy danych
- `db.ts` - Manager MongoDB memory server (start/stop/clear)
- `environment.ts` - Konfiguracja zmiennych środowiskowych dla testów
- `globalSetup.ts` - Globalne przygotowanie środowiska przed testami
- `globalTeardown.ts` - Sprzątanie po wszystkich testach

**Przykład użycia:**
```typescript
import { DbManager } from './setup/db';
beforeAll(() => DbManager.connect());
afterAll(() => DbManager.disconnect());
```

### 🔧 `helpers/`
**Przeznaczenie:** Narzędzia pomocnicze do budowania i uruchamiania testów
- `commandRunner.ts` - Uruchamianie komend Discord z mock'owanymi interakcjami
- `seeding.ts` - Seedowanie bazy danych testowymi danymi
- `assertions.ts` - Niestandardowe asercje dla testów integracyjnych
- `cleanup.ts` - Czyszczenie stanu między testami

**Przykład użycia:**
```typescript
import { runCommand } from './helpers/commandRunner';
const result = await runCommand('ping', { user: mockUser, guild: mockGuild });
```

### 🏭 `factories/`
**Przeznaczenie:** Generatory obiektów testowych zgodnych ze schematami bazy
- `userFactory.ts` - Tworzenie użytkowników Discord
- `guildFactory.ts` - Tworzenie serwerów Discord
- `levelFactory.ts` - Dane systemu poziomów
- `ticketFactory.ts` - Konfiguracje systemu ticketów
- `giveawayFactory.ts` - Konkursy i giveaway
- `warnFactory.ts` - Ostrzeżenia moderacyjne

**Przykład użycia:**
```typescript
import { UserFactory } from './factories/userFactory';
const testUser = await UserFactory.create({ discordId: '123456789' });
```

### 🎭 `discord/`
**Przeznaczenie:** Mock'i i stuby dla Discord.js API
- `mocks.ts` - Mock'owane klasy Discord (Client, Guild, Channel, User)
- `interactionBuilder.ts` - Builder pattern dla interakcji
- `eventHarness.ts` - Symulator zdarzeń Discord
- `permissions.ts` - Mock'owanie uprawnień i ról

**Przykład użycia:**
```typescript
import { InteractionBuilder } from './discord/interactionBuilder';
const interaction = new InteractionBuilder()
  .command('ban')
  .user({ id: '123', username: 'testuser' })
  .guild({ id: '456', name: 'testguild' })
  .build();
```

### 🗄️ `models/`
**Przeznaczenie:** Testy integracyjne modeli Mongoose
- `Level.test.ts` - System poziomów (CRUD, indeksy, unique constraints)
- `Giveaway.test.ts` - Konkursy (lifecycle, relacje, TTL)
- `TicketConfig.test.ts` - Konfiguracja ticketów (walidacje, references)
- `Warn.test.ts` - Ostrzeżenia (bulk operations, expiry)
- `Birthday.test.ts` - Urodziny (schedulers integration)

**Przykład struktury:**
```typescript
describe('Level Model Integration', () => {
  it('should enforce unique constraint on user+guild', async () => {
    // Test unique index behavior
  });
  
  it('should cascade delete when guild is removed', async () => {
    // Test foreign key behavior
  });
});
```

### ⚙️ `handlers/`
**Przeznaczenie:** Testy głównych handlerów aplikacji
- `CommandHandler.test.ts` - Rejestracja komend, uprawnienia, cooldowns
- `EventHandler.test.ts` - Obsługa zdarzeń Discord, routing, middleware

**Scenariusze testowe:**
- Rejestracja i wykrywanie komend
- Sprawdzanie uprawnień użytkownika
- System cooldown'ów
- Obsługa błędów walidacji
- Pomyślne wykonanie komend

### 📅 `events/`
**Przeznaczenie:** Testy obsługi konkretnych zdarzeń Discord
- `messageCreate.test.ts` - Leveling, auto-moderation, triggers
- `guildMemberAdd.test.ts` - Auto-role, welcome messages
- `voiceStateUpdate.test.ts` - Temporary channels, voice stats
- `ready.test.ts` - Inicjalizacja schedulers, status update

### ⏰ `schedulers/`
**Przeznaczenie:** Testy zadań cron i schedulers
- `birthdayScheduler.test.ts` - Codzienne sprawdzanie urodzin
- `twitchScheduler.test.ts` - Monitoring streamów Twitch
- `giveawayScheduler.test.ts` - Automatyczne rozliczanie konkursów
- `warnSystemMaintenance.test.ts` - Czyszczenie przeterminowanych ostrzeżeń

**Użycie fake timers:**
```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

it('should trigger birthday check at midnight', () => {
  // Advance time and verify scheduler execution
  jest.advanceTimersByTime(24 * 60 * 60 * 1000);
});
```

### 🌐 `http/`
**Przeznaczenie:** Testy integracji z zewnętrznymi API
- `animalApi.test.ts` - Mock'owanie API zwierząt
- `memeApi.test.ts` - Mock'owanie API mem
- `twitchIntegration.test.ts` - API Twitch (auth, streams, users)
- `httpMocks.ts` - Konfiguracja nock interceptors

**Scenariusze:**
- Pomyślne odpowiedzi API
- Obsługa rate limitów
- Timeouty sieci
- Malformed responses
- Retry logic

## Uruchamianie Testów

```bash
# Wszystkie testy integracyjne
npm run test:int

# Konkretny folder
npm run test:int -- tests/integration/models

# Watch mode
npm run test:int -- --watch

# Z coverage
npm run test:int -- --coverage
```

## Zmienne Środowiskowe

```bash
# .env.test lub ustaw w środowisku
TEST_MONGO_URI=mongodb://localhost:27017/dyziobot-test
DISCORD_TOKEN=fake_token_for_tests
NODE_ENV=test
LOG_LEVEL=error
```

## Dobre Praktyki

1. **Izolacja testów** - każdy test powinien być niezależny
2. **Deterministic data** - używaj fabryk z kontrolowanymi danymi
3. **Cleanup** - zawsze czyść stan po testach
4. **Mock external APIs** - nie rób realnych połączeń HTTP
5. **Fast feedback** - testy powinny być szybkie (< 30s wszystkie)

## Debugowanie

```bash
# Szczegółowe logi
DEBUG=* npm run test:int

# Konkretny test z logami
npm run test:int -- --testNamePattern="should handle command" --verbose

# Pozostaw bazę do inspekcji
KEEP_TEST_DB=true npm run test:int
```

## Troubleshooting

- **MongoDB connection issues** → Sprawdź czy jest zainstalowany mongodb-memory-server
- **Discord rate limits** → Upewnij się że używasz mock'ów a nie realnego API
- **Canvas/Sharp errors** → Zainstaluj system dependencies lub użyj mock'ów
- **Memory leaks** → Sprawdź czy cleanup jest wywoływany w afterEach/afterAll