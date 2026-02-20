# 🔍 Audyt kodu DyzioBOT — pełna analiza backendu

> Przeczytano 100% plików źródłowych (147 plików).  
> Audyt dotyczy **wyłącznie** backendu bota (`src/`) — dashboard pominięty.

---

## Spis treści

1. [Podsumowanie wykonawcze](#1-podsumowanie-wykonawcze)
2. [Duplikacja kodu](#2-duplikacja-kodu)
3. [Bezpośrednie importy modeli — łamanie warstwy serwisowej](#3-bezpośrednie-importy-modeli)
4. [Bugi i ryzykowne wzorce](#4-bugi-i-ryzykowne-wzorce)
5. [TypeScript — typowanie](#5-typescript--typowanie)
6. [Czytelność i uproszczenia](#6-czytelność-i-uproszczenia)
7. [Architektura i wzorce](#7-architektura-i-wzorce)
8. [Propozycja docelowej struktury katalogów](#8-propozycja-docelowej-struktury-katalogów)
9. [Reguły kodowania (coding rules)](#9-reguły-kodowania)
10. [Checklist: nowy moduł](#10-checklist-nowy-moduł)
11. [Priorytetyzacja zmian](#11-priorytetyzacja-zmian)
wwwww
---

## 1. Podsumowanie wykonawcze

| Metryka | Wartość |
|---------|---------|
| Plików src/ | 147 |
| Modeli typegoose | 31 |
| Serwisów | 15 |
| Komend slash | 29 |
| Event adapterów | ~40 |
| Schedulerów (clientReady) | 10 |
| Testów | 238 (16 suites) |

**Co działa dobrze:**
- Konsekwentny wzorzec `ServiceResult<T>` z helperami `ok()` / `fail()`.
- Centralizacja stałych (`cron.ts`, `colors.ts`).
- Walidacja środowiska z Zod (`env.schema.ts`).
- Serwisy czyste (brak importów discord.js) — łatwo testowalne.
- Testy z `mongodb-memory-server` — szybkie i izolowane.

**Główne problemy:**
- Znacząca duplikacja kodu (canvas, birthday message, parseDuration, giveaway embed building, log patterns).
- Kilkanaście plików nadal importuje modele bezpośrednio — omija warstwę serwisową.
- Monolityczny `Models.ts` z wszystkimi interfejsami.
- Hardkodowane ID w `bot.ts` i `guild.ts`.
- Dual path level-up (xpCache + xpService.modifyXp).
- Brak walidacji wejścia w kilku schedulerach (empty catch, silent errors).

---

## 2. Duplikacja kodu

### 2.1 `parseDuration` — dwie różne implementacje

**Gdzie:**
- `src/utils/moderationHelpers.ts` → `parseDuration(input: string): number | null`
- `src/services/giveawayService.ts` → `parseDuration(durationStr: string): number`

**Problem:** Dwie osobne regexy parsujące ten sam format "5 days 4 hours 2 minutes". Inna sygnatura (zwraca `null` vs `NaN`), inny zestaw obsługiwanych aliasów.

**Rozwiązanie:**

```typescript
// PRZED — giveawayService.ts (fragment)
export function parseDuration(durationStr: string): number {
  const regex = /(\d+)\s*(d|day|days|h|hour|hours|m|min|minute|minutes|s|sec|second|seconds)/gi;
  // ...
}

// PRZED — moderationHelpers.ts (fragment)
export function parseDuration(input: string): number | null {
  const units: Record<string, number> = { s: 1000, sec: 1000, ... , dzień: 86400000 };
  const pattern = /(\d+)\s*(s|sec|sek|sekund|...)/gi;
  // ...
}

// PO — src/utils/parseDuration.ts (jedna wspólna)
export function parseDuration(input: string): number | null {
  const UNITS: Record<string, number> = {
    s: 1_000, sec: 1_000, sek: 1_000, sekund: 1_000, sekunda: 1_000, second: 1_000, seconds: 1_000,
    m: 60_000, min: 60_000, minute: 60_000, minutes: 60_000, minut: 60_000, minuta: 60_000,
    h: 3_600_000, hour: 3_600_000, hours: 3_600_000, godz: 3_600_000, godzin: 3_600_000,
    d: 86_400_000, day: 86_400_000, days: 86_400_000, dzień: 86_400_000, dni: 86_400_000,
  };
  const PATTERN = /(\d+)\s*([a-ząćęłńóśźż]+)/gi;
  let total = 0;
  let match: RegExpExecArray | null;
  while ((match = PATTERN.exec(input))) {
    const ms = UNITS[match[2].toLowerCase()];
    if (!ms) continue;
    total += parseInt(match[1], 10) * ms;
  }
  return total > 0 ? total : null;
}
```

Następnie `giveawayService` i `moderationHelpers` importują z `utils/parseDuration`.

---

### 2.2 Canvas cards — ogromna duplikacja

**Gdzie:**
- `src/utils/canvasRankCard.ts` (~300 linii)
- `src/utils/canvasLeaderboardCard.ts` (~350 linii)

**Zduplikowane fragmenty:**
- `roundRect()` — identyczna funkcja w obu plikach.
- Ładowanie fontów — te same fonty rejestrowane oddzielnie.
- Ładowanie avatarów — ta sama logika `loadImage` + fallback.
- Formatowanie liczb — `formatNumber()` / `formatXP()`.

**Rozwiązanie:** Wyekstrahować wspólny moduł `canvasHelpers.ts`:

```typescript
// src/utils/canvasHelpers.ts
import { registerFont, createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';

let fontsRegistered = false;
export function ensureFonts() {
  if (fontsRegistered) return;
  registerFont('assets/fonts/Montserrat-Bold.ttf', { family: 'Montserrat', weight: 'bold' });
  registerFont('assets/fonts/Montserrat-Regular.ttf', { family: 'Montserrat' });
  fontsRegistered = true;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { /* ... */ }

export async function loadAvatar(url: string, fallback: string): Promise<Image> { /* ... */ }

export function formatNumber(n: number): string { /* ... */ }
```

Szacunkowa redukcja: ~120 linii mniej w sumie.

---

### 2.3 Birthday message — powielona logika formatowania

**Gdzie:**
- `src/commands/misc/birthdays/birthday.ts` → `createBirthdayMessage()`
- `src/commands/misc/birthdays/rememberBirthday.ts` → `createBirthdayMessage()`
- `src/commands/misc/birthdays/setUserBirthday.ts` → `createBirthdayMessage()`

Wszystkie 3 pliki mają niemal identyczną logikę obliczania "days until next birthday" i formatowania tekstu.

**Rozwiązanie:** Przenieść do `birthdayService`:

```typescript
// birthdayService.ts — dodać:
export function formatBirthdayMessage(
  botId: string, userId: string, date: Date, yearSpecified: boolean
): string { /* wspólna logika */ }
```

---

### 2.4 Giveaway embed building — powtórzenia w command + scheduler

**Gdzie:**
- `src/commands/admin/giveaway.ts` (handleEndGiveaway, handleRerollGiveaway)
- `src/events/clientReady/giveawayScheduler.ts`
- `src/events/interactionCreate/giveawayHandler.ts` (updateGiveawayMessage)

Każdy z tych plików buduje embedy giveaway z podobnym schematem (prize, description, winnersText, timestamp, participantsCount). Logika `reply → fallback channel.send` też jest zduplikowana.

**Rozwiązanie:** Wyekstrahować do `giveawayService`:

```typescript
// giveawayService.ts — dodać:
export function buildGiveawayEmbed(data: GiveawayData, status: 'active' | 'ended'): EmbedBuilder { /* ... */ }
export function buildWinnerAnnouncement(data: GiveawayData, winnerIds: string[]): string { /* ... */ }
```

> ⚠️ Uwaga: embed jest zależny od discord.js EmbedBuilder — jeżeli chcesz zachować czystość serwisu (bez discord.js), zdefiniuj dane jako plain object i niech adapter tworzy embed.

---

### 2.5 `getTimestamp()` — 3 kopie

**Gdzie:**
- `src/commands/admin/giveaway.ts`
- `src/events/clientReady/giveawayScheduler.ts`
- (inline w monthlyStats)

```typescript
function getTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
```

**Rozwiązanie:** Dodać do `timeHelpers.ts`:

```typescript
export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
```

---

### 2.6 Log event adapters — powtarzalny template

Wszystkie ~20 plików `log*.ts` (logBan, logUnban, logChannelCreate, logChannelDelete, logChannelUpdate, logRoleCreate, logRoleDelete, logRoleUpdate, logThreadCreate, logThreadDelete, logThreadUpdate, logGuildUpdate, logMemberJoin, logMemberRemove, logMemberUpdate, logMessageDelete, logMessageEdit, logVoiceStateUpdate) mają ten sam schemat:

```typescript
export default async function run(entity, client) {
  const moderator = await getModerator(guild, AuditLogEvent.X, targetId);
  await sendLog(client, guildId, 'eventType', { description, authorName, authorIcon, footer }, ctx);
}
```

To nie jest "zła" duplikacja — każdy event ma swoją logikę. Ale pattern audit-log-fetch + sendLog mógłby być uproszczony helper'em:

```typescript
export async function logWithAudit(
  client: Client, guild: Guild, auditEvent: AuditLogEvent,
  targetId: string | undefined, logType: string, buildDescription: (mod: User | null) => string
) { /* ... */ }
```

**Priorytet:** Niski — to opcjonalne uproszczenie.

---

## 3. Bezpośrednie importy modeli

Architektura projektu zakłada, że adaptery (event handlers, commands) komunikują się z bazą przez warstwę serwisową. Jednak kilka plików nadal importuje modele bezpośrednio.

### 3.1 `xpCache.ts` — dual level-up path ⚠️ WAŻNE

**Problem:**

```typescript
// src/cache/xpCache.ts
import { LevelModel } from '../models/Level';
import { notifyLevelUp } from '../services/levelNotifier';

// ... w flush():
if (lvl !== before) {
  await notifyLevelUp(this.client!, guildId, userId, lvl);
}
```

Jednocześnie `xpService.modifyXp()` też wykrywa level-up i woła `notifyLevelUp`. To tworzy **dwa niezależne ścieżki level-up** (cache flush vs modifyXp).

**Rozwiązanie:** xpCache powinien TYLKO buforować dane i zrzucać je do bazy. Detekcję level-up powinien robić wyłącznie `xpService` po flush'u:

```typescript
// xpCache — flush() powinien zwracać listę zmian:
export interface FlushResult { guildId: string; userId: string; oldLevel: number; newLevel: number; }

// xpService.flush() po bulkWrite sprawdza FlushResult[] i woła notifyLevelUp
```

---

### 3.2 `channelHelpers.ts` — bezpośredni import ChannelStatsModel

```typescript
import { ChannelStatsModel } from '../models/ChannelStats';
```

Plik `updateChannelStats()`, `safeSetChannelName()` operują bezpośrednio na modelu. Powinny iść przez `channelStatsService` (do stworzenia).

---

### 3.3 `logHelpers.ts` — bezpośredni import LogConfigurationModel

```typescript
import { LogConfigurationModel } from '../models/LogConfiguration';
```

`sendLog()` odpytuje config bezpośrednio z bazy. Powinien to robić `logService.getConfig(guildId)` (z cache'owaniem — config się rzadko zmienia).

---

### 3.4 `initializeGuildConfigs.ts` — importuje 13 modeli

```typescript
import { LogConfigurationModel } from '../../models/LogConfiguration';
import { LevelConfigModel } from '../../models/LevelConfig';
import { BirthdayConfigurationModel } from '../../models/BirthdayConfiguration';
// ... 10 więcej
```

**Rozwiązanie:** Stworzyć `guildSetupService.initializeDefaults(guildId)` — jedna metoda serwisowa, która woła poszczególne serwisy:

```typescript
export async function initializeGuildDefaults(guildId: string) {
  await Promise.all([
    logService.ensureConfig(guildId),
    levelService.ensureConfig(guildId),
    birthdayService.ensureConfig(guildId),
    // ...
  ]);
}
```

---

### 3.5 `voiceControl.ts` — bezpośredni import TempChannelModel

```typescript
import { TempChannelModel, TempChannelDocument } from '../../models/TempChannel';
```

W funkcji `validateOwnership()` po sprawdzeniu przez serwis robi dodatkowy `TempChannelModel.findOne()` aby "return the Mongoose doc for backward compat". To redundancja — serwis powinien zwracać pełne dane.

---

### 3.6 `twitchScheduler.ts` — bezpośredni import StreamConfigurationModel

```typescript
import { StreamConfigurationModel } from '../../models/StreamConfiguration';
```

W `checkStreams()` — powinno iść przez `twitchService.getStreamConfigs()`.

---

### 3.7 `questionScheduler.ts` — bezpośredni import QuestionConfigurationModel

```typescript
import { QuestionConfigurationModel } from '../../models/QuestionConfiguration';
```

Powinno iść przez `questionService.getConfigs()`.

---

### 3.8 `deleteStatsChannel.ts` — bezpośredni ChannelStatsModel

Patrz 3.2 — po utworzeniu channelStatsService.

---

### 3.9 `deleteTempChannel.ts` — bezpośredni TempChannelConfigurationModel

Powinno iść przez `tempChannelService.removeCreatorChannel(guildId, channelId)`.

---

### 3.10 `userStatusRemove.ts` — bezpośrednie importy Birthday, TwitchStreamer, Level

```typescript
import { BirthdayModel } from '../../models/Birthday';
import { TwitchStreamerModel } from '../../models/TwitchStreamer';
import { LevelModel } from '../../models/Level';
```

Powinno używać:
- `birthdayService.deactivate(guildId, userId)`
- `twitchService.deactivate(guildId, userId)`
- `xpService.resetUser(guildId, userId)`

---

### 3.11 `welcomeCard.ts` — bezpośredni GreetingsConfigurationModel

```typescript
import { GreetingsConfigurationModel } from '../../models/GreetingsConfiguration';
```

Powinno być: `greetingsService.getConfig(guildId)` (serwis do stworzenia).

---

### 3.12 `monthlyStats.ts` — czysty (używa serwisu) ✅

Wzorcowy example — korzysta wyłącznie z `monthlyStatsService`.

---

## 4. Bugi i ryzykowne wzorce

### 4.1 `monthlyStats.ts` — empty catch 🐛

```typescript
// src/events/clientReady/monthlyStats.ts, koniec pętli:
} catch (error) {}  // <-- cichy catch!
```

Scheduler generujący miesięczne statystyki połknie KAŻDY błąd bez logowania. Jeśli coś pójdzie nie tak, nigdy się o tym nie dowiesz.

**Fix:**
```typescript
} catch (error) {
  logger.error(`Błąd generowania statystyk dla guild ${guild.id}: ${error}`);
}
```

---

### 4.2 `ticketSystem.ts` — setTimeout + async delete (race condition) 🐛

```typescript
// handleConfirmClose
setTimeout(async () => {
  try {
    await interaction.channel.delete();
    await closeTicket(channelId);
  } catch { /* ... */ }
}, TICKET_CLOSE_DELAY);
```

**Problemy:**
1. `setTimeout` callback z `async` — unhandled rejection jeśli `.delete()` rzuci.
2. Jeśli użytkownik kliknie "Potwierdź" 3 razy szybko, zostaną uruchomione 3 timery.
3. `channelId` jest przechwycony z zewnątrz — jeśli kanał zostanie usunięty inną drogą, `closeTicket` i tak się uruchomi.

**Fix:**
```typescript
async function handleConfirmClose(interaction: ButtonInteraction): Promise<void> {
  // Natychmiast wyłącz button aby zapobiec wielokrotnemu kliknięciu
  await interaction.message.edit({ components: [] }).catch(() => {});
  
  await interaction.followUp({
    content: 'Zgłoszenie zostanie zamknięte za 5 sekund...',
    flags: MessageFlags.Ephemeral,
  });

  await new Promise(resolve => setTimeout(resolve, TICKET_CLOSE_DELAY));
  
  try {
    const channelId = interaction.channel?.id;
    if (interaction.channel) await interaction.channel.delete();
    if (channelId) await closeTicket(channelId);
  } catch (error) {
    logger.warn(`Ticket close error: ${error}`);
  }
}
```

---

### 4.3 `warnSystemMaintenance.ts` — hardkodowany `process.env.GUILD_ID` 🐛

```typescript
const guildId = process.env.GUILD_ID;
if (!guildId) { /* skip */ }
const result = await cleanExpiredWarns({ guildId });
```

Ten scheduler czyści warny tylko dla **jednego** guild'a (z env). Jeśli bot obsługuje wiele serwerów, reszta nigdy nie zostanie wyczyszczona.

**Fix:** Iterować po wszystkich guild'ach:

```typescript
for (const guild of client.guilds.cache.values()) {
  const result = await cleanExpiredWarns({ guildId: guild.id });
  // ...
}
```

(Wymaga przekazania `client` do schedulera — tak jak inne schedulerki.)

---

### 4.4 `kalendarzAdwentowy.ts` — getPolishTime() ⚠️

```typescript
function getPolishTime(): Date {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const polishTime = new Date(utcTime + 3600000);  // CET = UTC+1
  return polishTime;
}
```

Zakłada stały offset +1h. Polska ma **CEST** (UTC+2) w lecie. W czerwcu ten kod zwróci złą godzinę.

**Fix:** Użyć `Intl.DateTimeFormat`:

```typescript
function getPolishTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
}
```

Albo: ten konkretny feature jest `deleted: true` i dotyczy tylko grudnia — więc offset +1 jest OK w grudniu. Ale warto naprawić na przyszłość.

---

### 4.5 `kick.ts` / `mute.ts` — podwójny option lookup 

```typescript
const targetUser =
  interaction.options.getUser('użytkownik') || interaction.options.getUser('uzytkownik');
```

Option name w `SlashCommandBuilder` to `'uzytkownik'` (bez polskich znaków). Lookup `'użytkownik'` (z polską literą) zawsze zwróci `null`. Kod działa, ale to martwy branch — mylący dla czytającego.

**Fix:** Usunąć redundancję:

```typescript
const targetUser = interaction.options.getUser('uzytkownik', true);
```

---

### 4.6 `level.ts` command — bezpośredni import xpCache ⚠️

```typescript
import xpCache from '../../cache/xpCache';
// ...
const cachedData = await xpCache.getCurrentXp(gid, target.id);
```

Komenda `level` czyta XP bezpośrednio z cache zamiast z serwisu. Oznacza to:
- Jeśli cache jest pusty (restart bota), `getCurrentXp` może zwrócić dane z bazy ale przez niewłaściwą ścieżkę.
- Omija logikę serwisu.

**Fix:** Dodać `xpService.getCurrentLevel(guildId, userId)` i użyć go zamiast cache bezpośredniego.

---

### 4.7 `toplvl.ts` — `flushXp()` przy każdym wywołaniu komendy ⚠️

```typescript
await flushXp();  // flush XP cache to DB before rendering
const result = await getLeaderboard(guildId, page, perPage);
```

Każe flushować CAŁY cache XP za każdym wpisaniem `/toplvl`. Przy wielu użytkownikach to może być kosztowna operacja bazodanowa. Lepiej polegać na automatycznym cron flushu i ewentualnie zaakceptować lekko nieaktualne dane.

---

### 4.8 `xp.ts` command — import `flushXp` z event file

```typescript
import flushXp from '../../events/clientReady/xpFlush';
```

Komenda admin'owska `/xp` importuje z event'a. To narusza kierunek zależności (command → event). Lepiej: `xpService.flush()` (już istnieje).

---

## 5. TypeScript — typowanie

### 5.1 `Models.ts` — monolityczny plik interfejsów

**Plik:** `src/interfaces/Models.ts` (~200+ linii)

Zawiera interfejsy dla WSZYSTKICH modeli w jednym pliku. Przy 31 modelach to jest nieczytelne.

**Rozwiązanie:** Co-locate interfejsy z modelami:

```
src/models/Level.ts          ← model
src/models/Level.types.ts    ← ILevel, LevelDocument (opcjonalnie — lub w tym samym pliku)
```

Albo przynajmniej podzielić `Models.ts` na mniejsze pliki:
- `interfaces/xp.ts`
- `interfaces/moderation.ts`
- `interfaces/community.ts`

---

### 5.2 Brakujące typy zwracane w kilku komendach

- `kick.ts` — `options.userPermissions` to `bigint` a nie `bigint[]` (niespójne z innymi komendami):

```typescript
// kick.ts
export const options = {
  userPermissions: PermissionFlagsBits.KickMembers,  // bigint
};

// ban.ts
export const options = {
  userPermissions: [PermissionFlagsBits.BanMembers],  // bigint[]
};
```

**Fix:** Ujednolicić — zawsze array.

---

### 5.3 `any` w typach

- `userStatusRemove.ts`:

```typescript
async function deactivateEntry<TDoc extends { active?: boolean }>(
  model: ReturnModelType<any, DocumentType<TDoc>>,  // <-- any
  filter: Record<string, any>  // <-- any
)
```

**Fix:** Lepiej `Record<string, string>` dla filtra guild+user.

---

### 5.4 Loose typing w services

Kilka serwisów zwraca `.lean()` i typuje je ręcznie. Typegoose ma `DocumentType<T>` do tego.

---

## 6. Czytelność i uproszczenia

### 6.1 `bot.ts` — 147 linii hardkodowanych emoji

**Problem:** Ogromny obiekt z emoji per bot ID. Dwa identyczne bloki (dev bot + prod bot) z drobnymi różnicami.

**Rozwiązanie:** Przenieść do bazy (np. `BotConfigModel`) lub do pliku JSON/YAML. Fallback na domyślne wartości:

```typescript
// config/bot.ts
const DEFAULT_EMOJIS = { ... };

export function getBotConfig(botId: string): BotConfig {
  return CUSTOM_CONFIGS[botId] ?? { emojis: DEFAULT_EMOJIS };
}
```

Można też trzymać w `settings.json` i ładować raz przy starcie.

---

### 6.2 `guild.ts` — hardkodowane role/channel IDs

```typescript
const GUILD_CONFIGS: Record<string, GuildConfig> = {
  '1161993729142464603': { roles: { owner: '1161993729142464603', admin: '...', ... } },
  '1243851076562579456': { roles: { ... } },
};
```

**Rozwiązanie:** Przenieść do bazy (`GuildConfigModel`) — już masz pattern z innymi konfiguracjami per-guild.

---

### 6.3 `help.ts` — hardkodowana lista komend (ALL_COMMANDS)

**Problem:** 80+ linii hardkodowanej listy komend. Każda nowa komenda wymaga ręcznej edycji.

**Rozwiązanie:** Auto-generować z `CommandHandler.commands`:

```typescript
export async function run({ interaction, client }: ICommandOptions) {
  const commands = client.commandHandler.getSlashCommands();
  const ALL_COMMANDS = commands.map(cmd => ({
    name: `/${cmd.data.name}`,
    description: cmd.data.description,
  }));
  // ... reszta paginacji
}
```

---

### 6.4 `musicCommands.ts` — wielki switch/case

350+ linii z 13 handlerami w jednym pliku. Każdy `handleX()` to oddzielna funkcja, ale wszystko w jednym pliku.

**Rozwiązanie (opcjonalnie):** Podzielić na folder `messageCreate/music/`:
```
music/
  index.ts  (router)
  play.ts
  queue.ts
  controls.ts
```

Priorytet: niski — obecna forma działa, jest czytelna dzięki oddzielnym funkcjom.

---

### 6.5 `PlayDLExtractor.ts` — powtórzony `new Track()` pattern

Track creation jest powtórzone 5+ razy z prawie identycznym obiektem. 

**Fix:**

```typescript
private createTrack(info: any, context: ExtractorSearchContext, playlist?: Playlist): Track {
  const track = new Track(this.context.player, {
    title: info.title || 'Unknown',
    author: info.channel || info.uploader || 'Unknown',
    url: info.webpage_url || info.url || `https://youtube.com/watch?v=${info.id}`,
    thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
    duration: formatClock((info.duration || 0) * 1000),
    views: info.view_count || 0,
    requestedBy: context.requestedBy,
    source: 'youtube',
    raw: info,
    queryType: 'youtubeVideo',
    playlist,
  });
  track.extractor = this;
  return track;
}
```

Redukcja: ~60 linii mniej.

---

### 6.6 Niespójne error handling w schedulerach

Niektóre schedulerki logują błędy (`logger.error`), inne mają pusty `catch {}`. 

**Standardowy pattern powinien być:**

```typescript
schedule(CRON.X, async () => {
  try {
    // ...
  } catch (error) {
    logger.error(`[scheduler-name] ${error}`);
  }
}, { timezone: 'Europe/Warsaw' });
```

---

## 7. Architektura i wzorce

### 7.1 Warstwa: Adapter → Service → Model

Obecny stan:

```
Command/EventHandler (discord.js)
  ↓
  ├── Services (ServiceResult<T>)  ← ✅ dobrze
  │     ↓
  │     Models (Typegoose)
  │
  └── Bezpośrednie importy modeli  ← ❌ do naprawienia (sekcja 3)
```

Docelowo:

```
Command/EventHandler (discord.js)
  ↓
  Services (ServiceResult<T>)
  ↓
  Models (Typegoose)
```

**Żaden** adapter nie powinien importować z `models/`. Lista prac z sekcji 3.

---

### 7.2 Cache pattern — ujednolicić

Masz 2 cache:
- `xpCache` (klasa singleton, buffer → bulk flush)
- `monthlyStatsCache` (klasa singleton, buffer → bulk flush)

Oba działają identycznie (akumulator + `drain()` → `bulkWrite`). Można wyekstrahować bazowy `BufferedCache<K, V>`:

```typescript
export abstract class BufferedCache<K extends string, V> {
  protected map = new Map<K, V>();
  abstract merge(existing: V, incoming: Partial<V>): V;
  abstract createDefault(partial: Partial<V>): V;
  
  upsert(key: K, partial: Partial<V>) { /* ... */ }
  drain(): V[] { /* ... */ }
  size(): number { return this.map.size; }
}
```

Priorytet: niski — oba cache działają dobrze.

---

### 7.3 Event handler chain — return true pattern

```typescript
// EventHandler.ts
for (const handler of handlers) {
  const result = await handler(...args, client);
  if (result === true) break;  // stop chain
}
```

Ciekawy, ale nieudokumentowany pattern. Żaden handler nie zwraca `true`. 

**Rekomendacja:** Dodać JSDoc w EventHandler lub usunąć ten pattern jeśli nieużywany.

---

### 7.4 Scheduler pattern — standardyzacja

Każdy scheduler w `clientReady/` ma nieco inną strukturę:
- Niektóre exportują `default function run(client)` i wewnętrznie tworzą cron.
- Jeden (`monthlyStatsFlush.ts`) exportuje `startMonthlyStatsFlushScheduler()` + default.
- Jeden (`xpFlush.ts`) exportuje `default flushXp()` + `startXpFlushScheduler()`.

**Rekomendacja standardu:**

```typescript
// src/events/clientReady/xyzScheduler.ts
export default function run(client: Client): void {
  schedule(CRON.X, async () => {
    try { /* ... */ } catch (e) { logger.error(e); }
  }, { timezone: 'Europe/Warsaw' });
}
```

Aby ręczne wywołania (np. `flushXp()`) były możliwe, eksponuj je jako metody serwisu (`xpService.flush()`), nie z event file.

---

## 8. Propozycja docelowej struktury katalogów

```
src/
├── index.ts                         # Entry point
├── config/
│   ├── index.ts                     # Re-eksport
│   ├── env.schema.ts                # Zod validation
│   ├── bot.ts                       # Per-bot config (→ docelowo z bazy)
│   ├── guild.ts                     # Per-guild config (→ docelowo z bazy)
│   └── constants/
│       ├── colors.ts
│       └── cron.ts
│
├── models/                          # Typegoose models (31 plików — bez zmian)
│   ├── Level.ts
│   ├── Birthday.ts
│   └── ...
│
├── interfaces/                      # Podzielone na domeny
│   ├── Command.ts
│   ├── api/
│   │   ├── Animal.ts
│   │   ├── Faceit.ts
│   │   └── Meme.ts
│   ├── xp.ts                       # ILevel-related, RankData, etc.
│   ├── moderation.ts               # IWarn, WarnPunishment, etc.
│   └── community.ts                # IBirthday, IGiveaway, etc.
│
├── services/                        # Pure business logic (15+ plików)
│   ├── xpService.ts
│   ├── birthdayService.ts
│   ├── giveawayService.ts
│   ├── warnService.ts
│   ├── ticketService.ts
│   ├── twitchService.ts
│   ├── tempChannelService.ts
│   ├── monthlyStatsService.ts
│   ├── suggestionService.ts
│   ├── fortuneService.ts
│   ├── questionService.ts
│   ├── levelNotifier.ts
│   ├── rewardRoles.ts
│   ├── musicPlayer.ts
│   ├── PlayDLExtractor.ts
│   ├── channelStatsService.ts      # NOWY — z channelHelpers
│   ├── logService.ts               # NOWY — z logHelpers (config cache)
│   └── guildSetupService.ts        # NOWY — initializeGuildConfigs
│
├── cache/
│   ├── xpCache.ts
│   └── monthlyStatsCache.ts
│
├── handlers/
│   ├── CommandHandler.ts
│   └── EventHandler.ts
│
├── commands/                        # Slash commands (bez zmian)
│   ├── admin/
│   ├── fun/
│   ├── misc/
│   ├── moderation/
│   └── user/
│
├── events/                          # Event adapters (bez zmian)
│   ├── clientReady/                 # Schedulery
│   ├── interactionCreate/
│   ├── messageCreate/
│   ├── messageDelete/
│   ├── messageUpdate/
│   ├── voiceStateUpdate/
│   ├── guildMemberAdd/
│   ├── guildMemberRemove/
│   ├── guildMemberUpdate/
│   ├── guildBanAdd/
│   ├── guildBanRemove/
│   ├── guildUpdate/
│   ├── guildCreate/
│   ├── channelCreate/
│   ├── channelDelete/
│   ├── channelUpdate/
│   ├── roleCreate/
│   ├── roleDelete/
│   ├── roleUpdate/
│   ├── threadCreate/
│   ├── threadDelete/
│   ├── threadUpdate/
│   ├── inviteCreate/
│   ├── messageReactionAdd/
│   └── messageReactionRemove/
│
├── utils/                           # Helpery
│   ├── parseDuration.ts             # NOWY — wspólny parser
│   ├── timeHelpers.ts               # + toUnixTimestamp()
│   ├── levelMath.ts
│   ├── xpMultiplier.ts
│   ├── embedHelpers.ts
│   ├── moderationHelpers.ts         # Bez parseDuration (przeniesiony)
│   ├── logHelpers.ts                # sendLog (model import → logService)
│   ├── channelHelpers.ts            # → przenieść DB logic do channelStatsService
│   ├── auditLogHelpers.ts
│   ├── cooldownHelpers.ts
│   ├── animalHelpers.ts
│   ├── memeHelpers.ts
│   ├── canvasHelpers.ts             # NOWY — wspólne canvas fn
│   ├── canvasRankCard.ts            # → importuje z canvasHelpers
│   ├── canvasLeaderboardCard.ts     # → importuje z canvasHelpers
│   └── logger.ts
│
├── validations/
│   └── globalCooldown.ts
│
├── scripts/
│   ├── clearAllCommands.ts
│   ├── importFortunes.ts
│   └── syncCommands.ts
│
└── types/
    └── serviceResult.ts
```

**Kluczowe zmiany vs obecna struktura:**
1. `interfaces/Models.ts` → split na domains (`xp.ts`, `moderation.ts`, `community.ts`)
2. Nowe serwisy: `channelStatsService`, `logService`, `guildSetupService`
3. Nowy util: `parseDuration.ts`, `canvasHelpers.ts`
4. `timeHelpers` rozszerzone o `toUnixTimestamp()`

---

## 9. Reguły kodowania

### R1: Adaptery nie importują modeli
Event handlery i komendy NIGDY nie importują z `src/models/`. Cała logika bazodanowa idzie przez `src/services/`.

### R2: ServiceResult<T> wszędzie
Każda publiczna metoda serwisu zwraca `ServiceResult<T>`. Adapterzy sprawdzają `result.ok` przed użyciem danych.

### R3: Jeden odpowiedzialność na plik
Jeśli plik przekracza ~200 linii, sprawdź czy nie łamie SRP. Wydziel helpery.

### R4: Wspólne utility zamiast copy-paste
Przed dodaniem nowej utility function — sprawdź `src/utils/` czy nie istnieje już podobna.

### R5: Error handling w schedulerach
Każdy scheduler MUSI mieć try/catch z `logger.error`. Nigdy pusty catch.

### R6: Konsekwentne opcje komend
- `userPermissions` — zawsze `bigint[]` (array).
- `guildOnly: true` — zawsze gdy komenda wymaga guild context.

### R7: Typowanie — bez `any`
Unikaj `any`. Użyj `unknown` + type narrowing lub generics.

### R8: Testy — minimum dla każdego serwisu
Każdy nowy serwis musi mieć plik testowy z minimum:
- 1 test happy path
- 1 test error path
- Testy pure helpers (jeśli są)

### R9: Centralizacja stałych
- Cron schedules → `constants/cron.ts`
- Kolory → `constants/colors.ts`
- Limity/timeouty → nazwane `const` na szczycie pliku (nie magic numbers)

### R10: Nazewnictwo
- Serwisy: `fooService.ts` — eksportuje named functions (nie klasy).
- Modele: `Foo.ts` — PascalCase (Typegoose convention).
- Interfejsy: `IFoo` prefix albo `FooData` suffix (dla service return types).
- Event adaptery: action-based (`trackXp.ts`, `logMemberJoin.ts`).
- Komendy: folder = kategoria, plik = slug komendy.

---

## 10. Checklist: nowy moduł

Przy dodawaniu nowego modułu (np. "polls") wykonaj:

- [ ] **Model:** `src/models/Poll.ts` — Typegoose class + `getModelForClass()`
- [ ] **Model konfiguracji:** `src/models/PollConfiguration.ts` (jeśli potrzebna per-guild config)
- [ ] **Interfejs:** `src/interfaces/community.ts` — dodaj `IPollData`, `PollConfigData`
- [ ] **Serwis:** `src/services/pollService.ts` — pure functions, `ServiceResult<T>`, bez discord.js
- [ ] **Testy:** `src/__tests__/services/pollService.test.ts` — min 3 testy
- [ ] **Komenda:** `src/commands/misc/poll.ts` — slash command + `options`
- [ ] **Event adapter (opcjonalnie):** np. `src/events/interactionCreate/pollButtons.ts`
- [ ] **Scheduler (opcjonalnie):** `src/events/clientReady/pollScheduler.ts`
- [ ] **Guild init:** Dodaj `PollConfigurationModel` do `guildSetupService.initializeDefaults()`
- [ ] **Cron (jeśli scheduler):** Dodaj stałą do `constants/cron.ts`
- [ ] **Color (jeśli embed):** Dodaj stałą do `constants/colors.ts`
- [ ] **Help:** Auto-generated (po fix 6.3) lub ręcznie do `help.ts`
- [ ] **Testy przechodzą:** `npm test --silent` ✅
- [ ] **Build czyste:** `tsc --noEmit` ✅

---

## 11. Priorytetyzacja zmian

### P0 — Bugi (napraw natychmiast)

| # | Problem | Plik | Szacunek |
|---|---------|------|----------|
| 1 | Empty catch w monthlyStats scheduler | `monthlyStats.ts` | 1 min |
| 2 | setTimeout race condition w ticket close | `ticketSystem.ts` | 10 min |
| 3 | warnMaintenance single-guild | `warnSystemMaintenance.ts` | 5 min |

### P1 — Duplikacja / architektura (refactor)

| # | Problem | Pliki | Szacunek |
|---|---------|-------|----------|
| 4 | Wyekstrahować wspólne `parseDuration` | `moderationHelpers.ts`, `giveawayService.ts` | 20 min |
| 5 | Canvas helpers extraction | `canvasRankCard/LeaderboardCard` | 30 min |
| 6 | xpCache dual level-up path → single path | `xpCache.ts`, `xpService.ts` | 45 min |
| 7 | Birthday message dedup | 3 birthday cmd files | 20 min |
| 8 | getTimestamp → timeHelpers | 3 pliki | 5 min |
| 9 | Usunąć martwy `getUser('użytkownik')` w kick/mute | `kick.ts`, `mute.ts` | 2 min |
| 10 | PlayDLExtractor `createTrack()` helper | `PlayDLExtractor.ts` | 15 min |

### P2 — Architektura (nowe serwisy, bezpośrednie importy)

| # | Problem | Pliki | Szacunek |
|---|---------|-------|----------|
| 11 | channelStatsService | `channelHelpers.ts`, `deleteStatsChannel.ts` | 30 min |
| 12 | logService (+ config cache) | `logHelpers.ts` | 30 min |
| 13 | guildSetupService | `initializeGuildConfigs.ts` | 30 min |
| 14 | voiceControl → remove direct TempChannelModel | `voiceControl.ts` | 15 min |
| 15 | twitchScheduler → service | `twitchScheduler.ts` | 10 min |
| 16 | questionScheduler → service | `questionScheduler.ts` | 10 min |
| 17 | userStatusRemove → serwisy | `userStatusRemove.ts` | 15 min |
| 18 | welcomeCard → greetingsService | `welcomeCard.ts` | 15 min |
| 19 | level cmd → xpService zamiast raw cache | `level.ts` | 10 min |
| 20 | xp cmd → xpService.flush() zamiast event import | `xp.ts` | 5 min |

### P3 — Improvements (nice to have)

| # | Problem | Szacunek |
|---|---------|----------|
| 21 | Split Models.ts interfejsy | 30 min |
| 22 | bot.ts → settings.json / baza | 20 min |
| 23 | guild.ts → GuildConfigModel | 20 min |
| 24 | Auto-generated help command | 30 min |
| 25 | Ujednolicenie `userPermissions` (bigint vs bigint[]) | 5 min |
| 26 | Standardowy scheduler pattern | 15 min |

---

**Łączny szacunek:** ~8-10h pracy refaktoringowej.  
**Sugerowana kolejność:** P0 (15 min) → P1 (2h) → P2 (3h) → P3 (2h)
