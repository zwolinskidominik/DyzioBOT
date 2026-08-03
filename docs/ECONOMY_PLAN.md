# System Ekonomii Deezy — Pełna Specyfikacja

> Ekonomia jako **pełny system finansowy** — komendy to tylko interfejs.
> Waluta konfigurowalna per-guild. Architektura ledger-based (audit trail wszystkiego).

---

## Waluta

Konfigurowalna per-guild przez `/economy config`:

| Pole | Domyślnie |
|---|---|
| Name | GameCoins |
| Symbol | 🪙 |
| Plural | GameCoinów |
| Starting balance | 0 |

---

## Model konta użytkownika (`Economy`)

```typescript
class Economy {
  guildId: string          // tenant key
  userId: string

  // Portfele
  wallet: number           // cash in hand — INTEGER
  bank: number             // bezpieczne oszczędności — INTEGER

  // Statystyki lifetime
  netWorth: number         // wallet + bank + wartość inventory
  totalEarned: number
  totalSpent: number
  totalWon: number
  totalLost: number

  // Streaki
  dailyStreak: number
  weeklyStreak: number
  monthlyStreak: number
  lastDaily?: Date
  lastWeekly?: Date
  lastMonthly?: Date

  // Aktywność
  economyLevel: number     // osobny od XP (komenda: /economy level)
  reputation: number       // zmienia się przez /rob, /crime, etc.
  createdAt: Date
  lastActivityAt: Date
}
```

---

## Ledger — EconomyTransaction (najważniejsze)

**Nigdy nie aktualizujemy salda bezpośrednio.** Każda operacja tworzy wpis.

```typescript
enum TransactionType {
  // Zarabianie
  DAILY, WEEKLY, MONTHLY, WORK, CRIME, ROB,
  COLLECT, BEG, SEARCH, FISH, HUNT, MINE,
  // Kasyno
  COINFLIP, BLACKJACK, ROULETTE, DICE, SLOTS,
  CASE_BATTLE,
  // Sklep / Inventory
  SHOP_BUY, SHOP_SELL, ITEM_SELL, LOOTBOX_OPEN,
  // Między użytkownikami
  DEPOSIT, WITHDRAW, SEND, PAYMENT,
  // Aktywność
  QUEST_COMPLETE, ACHIEVEMENT_REWARD, LEVEL_UP,
  // Administracja
  ADMIN_ADD, ADMIN_REMOVE, RESET,
}

class EconomyTransaction {
  guildId: string
  userId: string
  type: TransactionType
  amount: number           // +/- INTEGER
  walletAfter: number
  bankAfter: number
  targetUserId?: string    // dla SEND, ROB, CASE_BATTLE
  meta?: Record<string, unknown>  // itemId, gameResult, skinId, caseId etc.
  createdAt: Date
}
```

Zalety ledgera: audyt · wykrywanie exploitów · rollback błędów · statystyki.

---

## Fazy implementacji

### Faza 1 — Core Economy

**Modele:** `Economy`, `EconomyTransaction`, `EconomyConfig`

**Komendy:**

| Komenda | Opis |
|---|---|
| `/balance [@user]` | Wallet · Bank · Net Worth · Ranking position |
| `/deposit <amount\|all>` | Wallet → Bank |
| `/withdraw <amount\|all>` | Bank → Wallet |
| `/send <@user> <amount>` | Transfer (walidacja: nie do siebie, nie do botów, limit, cooldown) |
| `/leaderboard [wealth\|wallet\|bank\|earned\|gambling]` | Ranking per tryb |

**Serwis:** `economyService.ts`
```
getOrCreateWallet · getBalance · deposit · withdraw · send
transfer (atomowe $inc) · getLeaderboard · getHistory
```

---

### Faza 2 — Zarabianie

| Komenda | Cooldown | Kwota | Mechaniki |
|---|---|---|---|
| `/daily` | 24h | 200 🪙 | streak +10%/dzień (max +200%), premium bonus |
| `/weekly` | 7 dni | 2000 🪙 | streak bonus, większa nagroda |
| `/monthly` | 30 dni | 10 000 🪙 | miesięczny jackpot |
| `/work` | 60 min | 100–500 🪙 | losowy zawód (Developer, Streamer, Pilot...) |
| `/crime` | 2h | ±800/−400 🪙 | 60% sukces, opis fabuły |
| `/rob <@user>` | 4h | 10–30% wallet ofiary | 40% sukces, partial success, caught, immunity 24h |
| `/beg` | 30 min | 5–50 🪙 | losowe zdarzenie z opisem |
| `/search <location>` | 45 min | 0–300 🪙 | Śmietnik · Sofa · Bankomat · Kasyno (różne ryzyko) |
| `/collect [location]` | 20–40 min | 5–650 🪙 | zbieranie butelek/puszek/złomu; lokacje: ulica/park/budowa/złomowisko |
| `/fish` | 30 min | ryba → inventory | rzadkości: Common/Rare/Epic/Legendary |
| `/hunt` | 1h | zwierzyna → inventory | analogicznie |
| `/mine` | 45 min | surowce → inventory | analogicznie |

---

### `/collect` — szczegółowa mechanika

Zbieranie butelek i puszek kaucyjnych + losowe znaleziska złomowe.

**Lokacje** (wpływają na cooldown i szansę złomowych łupów):

| Lokacja | Cooldown | Mnożnik złomu | Wymagany eco level |
|---|---|---|---|
| `ulica` (domyślna) | 20 min | ×1.0 | — |
| `park` | 25 min | ×0.8 | — |
| `budowa` | 30 min | ×2.0 | 3 |
| `złomowisko` | 40 min | ×3.0 | 5 |

**Tabela łupów (szanse dla lokacji `ulica`):**

| Znalezisko | Nagroda | Szansa |
|---|---|---|
| 🧴 Plastikowa butelka 0,5L | 5🪙 | 45% |
| 🍾 Szklana butelka 0,33L | 8🪙 | 25% |
| 🥤 Puszka aluminiowa | 10🪙 | 15% |
| 🍶 Butelka szklana 1L | 15🪙 | 8% |
| 🛍️ Torba pełna puszek | 80–120🪙 | 4.7% |
| 🔋 Akumulator z dostawczaka | 450–550🪙 | 0.4% |
| 🏠 Żeliwny kaloryfer | 400–500🪙 | 0.4% |
| 🚗 Alufelga z rowu | 350–450🪙 | 0.4% |
| ⚡ Gruby kabel z budowy (miedź) | 500–650🪙 | 0.3% |

Szanse tier złomowego mnożone przez `location.scrapMultiplier` (max ×3.0 na złomowisku).

**Opisy fabularne złomowych jackpotów:**
- 🔋 *„Mało nie łamiesz nogi o stary ołowiany akumulator za warsztatem. Na skupie zapłacą jak za zboże."*
- 🏠 *„Ktoś robił remont w wielopłytowcu. Ładujesz kaloryfer na wózek i pędzisz na skup, zanim zwinie go konkurencja."*
- 🚗 *„W rowie melioracyjnym błyszczy zgięta felga. Dla kierowcy złom, dla Ciebie czyste aluminium."*
- ⚡ *„Kilkumetrowy ścinek kabla w chaszczach. Po obraniu izolacji — lśniąca miedź. Święty Graal zbieraczy."*

**Achievement:** „Eko-wojownik" — zbierz 50 puszek w tygodniu → badge + 200🪙 bonus.

---

### Faza 3 — Hazard (z animacją wideo)

Wszystkie komendy hazardowe operują na **wallet** (nie bank).

| Komenda | Mechanika | House Edge |
|---|---|---|
| `/coin-flip <heads\|tails> <bet>` | 50/50, wypłata ×1.95 | 5% |
| `/dice <bet> <1-6\|low\|high\|even\|odd>` | konkretna liczba ×5.5, reszta ×1.9 | 5–8% |
| `/slots <bet>` | 5 bębnów, rzadkości (Common→Mythic) | 5% |
| `/blackjack <bet>` | hit/stand/double, dealer stoi na 17 | 2% |
| `/roulette <bet> <type>` | red/black/odd/even/1-18/number | 2.7% |
| `/coin-war` | PvP — dwóch graczy, wyższy rzut wygrywa | 0% |
| `/higher-lower <bet>` | zgadnij czy następna karta wyższa | 4% |
| `/wheel <bet>` | koło fortuny, różne sektory | 5% |
| `/case-battle <case> <rounds> [gracze]` | PvP: kto otworzy skrzynki o wyższej wartości | 5% |

**Animacja `/slots` (canvas + FFmpeg pipe):**
```
Losuj wynik → generuj klatki (canvas 500×140px) → pipe do FFmpeg ultrafast → MP4 attachment
```
Pre-render wszystkich możliwych kombinacji przy pierwszym uruchomieniu → cache → instant delivery.

---

### `/case-battle` — szczegółowa mechanika

PvP format wzorowany na csgo-skins.com. Gracze otwierają tę samą liczbę skrzynek jednocześnie — wygrywa ten z najwyższą łączną wartością.

**Flow:**
```
/case-battle create <case> <rounds> [players: 2|3|4]
  → lobby embed z przyciskami "Dołącz"
  → wszystkie sloty zajęte → battle start automatycznie
  → każdy gracz otwiera N skrzynek równolegle
  → wyniki pokazywane kolumnami w embedzie
  → najwyższa suma wartości wygrywa całą pulę
```

**Tryby:**

| Tryb | Opis |
|---|---|
| 1v1 | Klasyk |
| 1v1v1 / FFA | Do 4 graczy |
| 2v2 Team | Sumy teamów, wygrywa team |
| Cursed mode | Wygrywa NAJNIŻSZA wartość |
| Bot fill | Brak chętnych → dołącza „bot" (house) po 5 min |

**Bezpieczeństwo:**
- Wynik pre-generowany server-side przed startem animacji — gracz nie może uciec po zobaczeniu swojego wyniku
- Koszt wejścia = cena klucza × liczba rund, pobierany przy tworzeniu/dołączaniu
- House edge 5%: zwycięzca dostaje 95% łącznej puli
- Timeout na dołączenie: 5 min → auto-refund jeśli niepełne lobby

**Model:** `CaseBattle.ts`

```typescript
class CaseBattle {
  guildId: string
  channelId: string
  messageId: string           // embed lobby
  caseId: string              // ref → CsCase
  rounds: number
  maxPlayers: number
  mode: 'normal' | 'cursed' | 'team'
  status: 'waiting' | 'in_progress' | 'finished'
  players: {
    userId: string
    teamId?: number
    items: string[]           // ref → CsSkin._id
    totalValue: number
  }[]
  winnerId?: string
  winnerTeamId?: number
  createdAt: Date
  startedAt?: Date
  finishedAt?: Date
}
```

---

### Faza 4 — Sklep i Skrzynki

| Komenda | Opis |
|---|---|
| `/shop [category]` | Przeglądaj: Roles · Boosters · Consumables · Cosmetics · Cases |
| `/buy <item>` | Zakup z wallet |
| `/sell <item>` | Odsprzedaż (70% ceny bazowej) — z autocomplete po inventory |
| `/inventory [@user] [kategoria]` | Lista posiadanych przedmiotów (select menu UX) |
| `/use <item>` | Użyj consumable/booster — z autocomplete |
| `/give <@user> <item>` | Przekaż przedmiot — z autocomplete |
| `/open <case>` | Otwórz skrzynkę CS2-style (animacja canvas+FFmpeg → MP4) |
| `/market` | Marketplace P2P: wystaw/kup od innych graczy |
| `/auction <item> <start_price>` | Aukcja z czasem |
| `/bid <auction_id> <amount>` | Licytuj |

---

### `/open` — CS2-style lootboxy

Otwieranie skrzynek z animacją identyczną jak w CS2 i na botach takich jak DisGo.

**Skrzynka (CsCase):** admin definiuje w dashboardzie — nazwa, cena klucza, zawartość (lista skinów z wagami drop rate).

**Rzadkości z prawdziwymi CS2 drop rates:**

| Rzadkość | Kolor | Szansa | Przykład |
|---|---|---|---|
| Consumer Grade | Szary | ~79.92% | P250 Melon Candy |
| Industrial Grade | Niebieski jasny | ~15.98% | MP9 Setting Sun |
| Mil-Spec | Niebieski | ~3.20% | AK-47 Slate |
| Restricted | Fioletowy | ~0.64% | M4A4 龍王 |
| Classified | Różowy | ~0.128% | AWP Redline |
| Covert | Czerwony | ~0.026% | AK-47 Wild Lotus |
| ★ Rare Special (Nóż/Rękawice) | Żółty | ~0.026% | ★ Karambit |

**Wear (float) — losowany po określeniu rzadkości:**

| Wear | Zakres float |
|---|---|
| Factory New (FN) | 0.00–0.07 |
| Minimal Wear (MW) | 0.07–0.15 |
| Field-Tested (FT) | 0.15–0.38 |
| Well-Worn (WW) | 0.38–0.45 |
| Battle-Scarred (BS) | 0.45–1.00 |

**Animacja `/open` (canvas + FFmpeg):**
```
1. Server losuje skin (rarity → konkretny skin → wear → float)
2. Canvas 600×150px: poziomy strip z losowymi skinami, wylosowany na pozycji ~75%
3. Animacja ease-out: strip przesuwa się w lewo, zwalnia na wylosowanym skinie
4. Ostatnia klatka: podświetlenie kolorem rzadkości + nazwa skina
5. FFmpeg ultrafast pipe → MP4 attachment w Discord
6. Skin trafia do inventory, wpis w ledgerze (LOOTBOX_OPEN)
```

**Modele CS2:**

```typescript
// Definicja skina
class CsSkin {
  name: string               // "AK-47 | Wild Lotus"
  weapon: string             // "AK-47"
  finish: string             // "Wild Lotus"
  rarity: CsRarity           // enum: CONSUMER | INDUSTRIAL | MIL_SPEC | ...
  imageUrl: string           // Steam CDN URL
  baseValue: number          // wartość w 🪙 — INTEGER
}

// Definicja skrzynki
class CsCase {
  guildId: string            // per-guild lub globalny (guildId: 'global')
  name: string               // "Deezy Case"
  imageUrl: string
  keyPrice: number           // INTEGER
  contents: {
    skinId: string
    weight: number           // im wyższy, tym częściej
  }[]
}

// Zdobyty skin w inventory
class InventoryItem {
  guildId: string
  userId: string
  itemType: ItemType         // CS2_SKIN | ROLE | BOOSTER | etc.
  skinId?: string            // ref → CsSkin (gdy CS2_SKIN)
  itemId?: string            // ref → ShopItem (gdy inne)
  quantity: number           // stack dla surowców, 1 dla skinów
  meta?: {
    wear?: string            // FN/MW/FT/WW/BS
    float?: number           // 0.0000–1.0000
    obtainedFrom?: string    // 'case_open' | 'case_battle' | 'shop' | 'collect' | 'fish' etc.
    caseId?: string
  }
  obtainedAt: Date
}
```

Dane skinów: baza CS2 skinów jest publiczna — zaciągnąć z csgostash lub lokalny JSON z nazwami, rzadkościami i Steam CDN imageUrls.

---

### `/inventory` — UX i interakcje

**Wyświetlanie:** embed z kategoriami, pod spodem `StringSelectMenu` z itemami strony + przyciski akcji.

```
📦 Inventory — Dominik           [◀ Strona 1/3 ▶]

CS2 Skiny (3) | Złom (2) | Przyroda (7) | Boostery (1)

  🔴 AK-47 Wild Lotus · Covert · FT · 0.2341 · 850🪙
  🟣 AWP Redline · Classified · FN · 0.0123 · 320🪙
  🔵 MP9 Setting Sun · Mil-Spec · WW · 0.4210 · 45🪙

Łączna wartość: 2 085🪙

[Select Menu: "Wybierz przedmiot..."]
[Sprzedaj ___🪙] [Użyj] [Przekaż] [Inspekcja]   ← aktywne po wyborze w menu
```

**Limit inventory:** 50 slotów bazowo. Surowce stackują się (`Karp ×12`). Skiny i unikaty nie stackują.

**Rozszerzenie limitu:** booster „Większy plecak" z `/shop` (+25 slotów, 7 dni).

**Implementacja przycisków:**

```typescript
// 1. Strona inventory → select menu z itemami
const selectMenu = new StringSelectMenuBuilder()
  .setCustomId('inventory_select')
  .setPlaceholder('Wybierz przedmiot...')
  .addOptions(pageItems.map(item => ({
    label: item.displayName,
    description: `Wartość: ${item.value}🪙`,
    value: item._id.toString(),
    emoji: item.emoji,
  })));

// 2. Przyciski zablokowane dopóki nic nie wybrano
// Po wyborze w select menu → bot edytuje wiadomość, odblokowuje przyciski z ceną

// 3. /sell, /use, /give mają autocomplete przeszukujący inventory
if (interaction.isAutocomplete()) {
  const query = interaction.options.getFocused();
  const items = await inventoryService.search(guildId, userId, query);
  await interaction.respond(
    items.map(i => ({ name: `${i.displayName} · ${i.value}🪙`, value: i._id.toString() }))
  );
}
```

**Auto-sell dla złomu:** opcja per-user w `/settings` — znaleziska z `/collect` mogą od razu trafiać na coins bez zajmowania slotów inventory.

---

### Faza 5 — Przedmioty (ItemType)

```typescript
enum ItemType {
  CS2_SKIN,       // skin z /open lub /case-battle
  ROLE,           // stała rola
  TEMP_ROLE,      // rola na N dni
  BOOSTER,        // efekt mnożnikowy (2× daily, +luck, +collect etc.)
  LOOTBOX,        // skrzynka do otwarcia przez /open
  BADGE,          // odznaka na profil
  COLLECTIBLE,    // ryba, zwierzyna, trofeum, złom
  CONSUMABLE,     // jednorazowy efekt
  BACKGROUND,     // tło profilu
}
```

Przykłady itemów ze sklepu: VIP Role · 2× Daily Booster · Crime Booster · Lucky Charm · Złomiarz Pro (bonus collect) · Golden Badge · Mystery Box · Większy plecak

---

### Faza 6 — Profil i statystyki

| Komenda | Opis |
|---|---|
| `/profile [@user]` | Net worth · Eco Level · Badges · Achievements · Inventory showcase (top 3 skiny) |
| `/stats [@user]` | Pełne statystyki: earned, spent, won, lost, games played, cases opened |
| `/history [@user]` | Ostatnie N transakcji z ledgera |
| `/networth [@user]` | Breakdown: wallet + bank + inventory value |
| `/rank [@user]` | Pozycja rankingowa (wealth/gambling/cases/etc.) |
| `/richest` | Alias `/leaderboard wealth` |

---

### Faza 7 — Questy i osiągnięcia

**Questy** (resety co 24h / 7 dni / 30 dni):
- „Wykonaj /work 3 razy" → 300 🪙
- „Wygraj 2 gry w kasynie" → 500 🪙
- „Wyślij komuś 100 🪙" → 200 🪙
- „Zbierz 10 puszek" → 150 🪙
- „Wygraj case battle" → 1000 🪙

| Komenda | Opis |
|---|---|
| `/quest` | Aktywne questy |
| `/missions` | Lista misji (dłuższe questy) |
| `/claim` | Odbierz nagrodę za ukończone |
| `/achievements` | Odznaki i postęp |

**Osiągnięcia przykłady:**
First Million · First Gambling Win · 100 Dailies · Case Battle Champion · Eko-wojownik (50 puszek/tydzień) · Złomiarz (znajdź kabel/kaloryfer/akumulator/felgę) · Nóż z pierwszej skrzynki · Top 10 Wealth

Nagrody: Coins + Badge + Title

---

### Faza 8 — Poziomy ekonomiczne i Prestige

**Economy Level** (osobny od XP poziomu — komenda `/economy level` żeby uniknąć konfliktu z `/level` XP):
- Awans za: zarabianie, wydawanie, aktywność dzienną
- Odblokowuje: większe daily/work, wyższe limity, nowe lokacje (`budowa` eco3, `złomowisko` eco5), nowe typy skrzynek

| Komenda | Opis |
|---|---|
| `/economy level [@user]` | Poziom ekonomiczny + postęp do następnego |
| `/economy config` | Admin: nazwa waluty, limity, nagrody (adminOnly) |
| `/prestige` | Reset progresu za ekskluzywne nagrody (badge · bonus coinów · kolor profilu) |

---

### Faza 9 — Społecznościowe

| Komenda | Opis |
|---|---|
| `/rps <@user> <bet>` | Kamień papier nożyczki — zakłady |
| `/duel <@user> <bet>` | Pojedynek — 50/50, winner takes all |
| `/horse-race <bet> <horse>` | Wyścig koni, losowy zwycięzca |
| `/lottery` | Losowanie raz dziennie, wspólna pula |
| `/jackpot <amount>` | Każdy wrzuca, jeden wygrywa po osiągnięciu progu |
| `/trade <@user>` | Wymiana przedmiotów (interaktywne okno z potwierdzeniem obu stron) |
| `/pay <@user> <amount>` | Alias `/send` |

---

### Faza 10 — Administracja

| Komenda | Opis |
|---|---|
| `/add-money <@user> <amount>` | Dodaj do wallet (adminOnly) |
| `/remove-money <@user> <amount>` | Zabierz z wallet (adminOnly) |
| `/reset-user <@user>` | Reset: wallet · bank · inventory · stats (adminOnly) |

---

### Faza 11 — Dashboard

Sekcja „Economy" w panelu admina:

**General:** nazwa waluty · emoji · starting balance · włącz/wyłącz moduł

**Rewards:** daily/weekly/monthly kwoty · streak bonus % · premium mnożnik

**Work:** cooldown · min/max reward · lista zawodów

**Crime:** cooldown · success chance · reward/penalty range

**Rob:** cooldown · success chance · max steal % · immunity duration

**Gambling:** min/max bet per gra · RTP per gra · daily loss limit

**Cases:** CRUD skrzynek (nazwa, cena klucza, zawartość z wagami drop rate per skin)

**Shop:** zarządzanie itemami (CRUD: rola, temp rola, booster, lootbox)

**Anti-Abuse:** rate limits · inflation monitoring · audit log viewer

---

## Anti-Abuse

- **Cooldowns** per (guild, user, command) — istniejący `cooldownHelpers.ts`
- **Anti-inflation monitor:** coins generated/day vs coins destroyed/day → alert gdy nierównowaga
- **Alt detection:** nowe konta (<7 dni) nie mogą /rob ani /send do starszych kont
- **Rate limiting:** max N transakcji na minutę per user
- **Transfer anomaly:** alert przy transferach >50% dziennej produkcji coinów gildii
- **Case battle:** wynik pre-generowany server-side, coins blokowane przy tworzeniu lobby
- **Audit log:** każda operacja admin (add/remove/reset) → `AuditLog` model

---

## Kolejność implementacji

```
Faza 1 (Core)     →  Faza 2 (Zarabianie + /collect)  →  Faza 3 (Hazard)
       ↓
Faza 4 (Sklep + /open CS2 + /case-battle)  →  Faza 5 (Itemy + /inventory UX)
       ↓
Faza 6 (Profil)   →  Faza 7 (Questy)       →  Faza 8 (Prestige)
       ↓
Faza 9 (Social)   →  Faza 10 (Admin)        →  Faza 11 (Dashboard)
```

MVP do pokazania: **Fazy 1-3** (core + zarabianie + hazard z animacją slots).
Drugi milestone: **Faza 4** (/open CS2 + /case-battle + /inventory).

---

## Nowe modele (plan)

```
src/models/
  Economy.ts            — konto użytkownika
  EconomyTransaction.ts — ledger
  EconomyConfig.ts      — konfiguracja per-guild
  CsCase.ts             — definicja skrzynki (zawartość, cena klucza)
  CsSkin.ts             — definicja skina CS2 (nazwa, rarity, imageUrl, baseValue)
  CaseBattle.ts         — aktywna/zakończona rozgrywka case battle
  ShopItem.ts           — przedmioty w sklepie (role, boostery, consumables)
  InventoryItem.ts      — posiadane przedmioty (skiny, złom, ryby, boostery)
  Achievement.ts        — definicje osiągnięć
  UserAchievement.ts    — osiągnięcia użytkownika
  Quest.ts              — definicje questów
  UserQuest.ts          — aktywne questy użytkownika
  AuctionItem.ts        — aktywne aukcje
```

---

## Nowe serwisy

```
src/services/
  economyService.ts       — core operacje finansowe (atomowe $inc)
  gamblingService.ts      — hazard + house edge
  lootboxService.ts       — /open: losowanie skina, animacja, inventory
  caseBattleService.ts    — /case-battle: lobby, state machine, rozstrzygnięcie
  shopService.ts          — sklep, buy/sell
  inventoryService.ts     — zarządzanie inventory, search (autocomplete), sell
  questService.ts         — questy i misje
  achievementService.ts   — osiągnięcia

src/utils/
  economyVideoRenderer.ts — canvas + FFmpeg animacje (slots, lootbox /open)
  economyEmbeds.ts        — createBalanceEmbed, createInventoryEmbed, createCaseEmbed etc.
```
