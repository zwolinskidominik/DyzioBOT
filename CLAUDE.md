# CLAUDE.md — Deezy Bot (DyzioBOT)

> Czytaj NA POCZĄTKU każdej sesji. Pełna dokumentacja: `docs/` · Master ref: `AGENTS.md`

---

## Stack

| Warstwa | Technologia |
|---|---|
| Bot | Node.js 20 LTS · TypeScript strict · discord.js v14 · CommonJS |
| ORM | Mongoose 9 + Typegoose 13 — modele w `src/models/` |
| DB | MongoDB Atlas (multi-tenant — każda query **MUSI** mieć `guildId`) |
| Serwisy | Plain functions → `ServiceResult<T>` (nigdy throw na zewnątrz) |
| Logger | Winston — wyłącznie `logger.*`, zero `console.*` |
| Testy | Jest 29 + ts-jest + `mongodb-memory-server` |
| Dashboard | Next.js App Router + NextAuth Discord OAuth2 + Shadcn/ui + Redis |

---

## Komendy

```bash
npm run check:types   # tsc src + tsc tests — ZAWSZE przed commitem
npm test              # Jest
npm run test:coverage # min 90% statements/functions/lines, 80% branches
npm run build         # tsc build
npm run dev           # nodemon
npm run sync-commands # rejestracja slash commands w Discord
```

---

## Wzorce kodu (twarde zasady)

### ServiceResult — jedyny sposób zwracania z serwisu

```typescript
import { ServiceResult, ok, fail } from '../types/serviceResult';

async function doSomething(guildId: string, userId: string): Promise<ServiceResult<Thing>> {
  try {
    const data = await ThingModel.findOne({ guildId, userId }); // ZAWSZE guildId
    if (!data) return fail('NOT_FOUND', 'Nie znaleziono.');
    return ok(data);
  } catch (err) {
    logger.error('doSomething failed', { guildId, err });
    return fail('INTERNAL_ERROR', 'Błąd serwera.');
  }
}

// Caller ZAWSZE sprawdza ok przed data
const result = await doSomething(guildId, userId);
if (!result.ok) {
  await interaction.reply({ embeds: [createErrorEmbed(result.message)], flags: MessageFlags.Ephemeral });
  return;
}
const thing = result.data;
```

### Modele Typegoose

```typescript
@modelOptions({ schemaOptions: { timestamps: true, collection: 'things' } })
@index({ guildId: 1, userId: 1 }, { unique: true })
class Thing {
  @prop({ required: true, type: () => String }) guildId!: string;
  @prop({ required: true, type: () => String }) userId!: string;
}
export const ThingModel = getModelForClass(Thing);
```

- Atomowe update: `findOneAndUpdate` z `$inc`/`$set` + `{ new: true, upsert: true }`
- **NIGDY nie aktualizuj salda bezpośrednio** — zawsze przez `EconomyTransaction` (ledger)

### Komendy Discord

```typescript
const command: ICommand = {
  data: new SlashCommandBuilder().setName('balance').setDescription('...'),
  options: { cooldown: 5, guildOnly: true },
  async run({ interaction }: ICommandOptions) {
    const result = await economyService.getBalance(interaction.guildId!, interaction.user.id);
    if (!result.ok) {
      await interaction.reply({ embeds: [createErrorEmbed(result.message)], flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ embeds: [createBalanceEmbed(result.data)] });
  },
};
export default command;
```

---

## Zakazy (lista absolutna)

```
❌ console.*          — tylko logger.*
❌ any                — TypeScript strict
❌ find({}) bez guildId — zawsze scope do tenanta
❌ ServiceResult ignorowany — sprawdź ok przed data
❌ float dla pieniędzy — wallet/bank to INTEGER (całe żetony)
❌ as X cast          — użyj type guard
❌ hardcoded tokeny   — tylko przez env
❌ aktualizacja salda bez EconomyTransaction — zawsze ledger
❌ npm install bez sprawdzenia stack
❌ *.md podsumowania bez prośby
```

---

## Kolory dla ekonomii (`src/config/constants/colors.ts`)

```typescript
ECONOMY, ECONOMY_WIN, ECONOMY_LOSE, ECONOMY_NEUTRAL,
GAMBLING, DAILY, SHOP, ROB_SUCCESS, ROB_FAIL
```

---

## Aktualny cel: System Ekonomii

Szczegółowy plan: `docs/ECONOMY_PLAN.md`

### Architektura

```
Economy (konto) + EconomyTransaction (ledger) + EconomyConfig (per-guild)
```

Konto ma: `wallet` · `bank` · `netWorth` · `totalEarned/Spent/Won/Lost`  
            · `dailyStreak` · `weeklyStreak` · `monthlyStreak` · `economyLevel` · `reputation`

Ledger: **każda** operacja = wpis w `EconomyTransaction`. Nigdy direct update salda.

### Fazy (kolejność)

**Faza 1 — Core** (zacznij tutaj)
- [ ] `Economy.ts` · `EconomyTransaction.ts` · `EconomyConfig.ts`
- [ ] `economyService.ts` — getOrCreateWallet, deposit, withdraw, send, getLeaderboard
- [ ] `/balance` · `/deposit` · `/withdraw` · `/send` · `/leaderboard`
- [ ] Testy >90% coverage

**Faza 2 — Zarabianie**
- [ ] `/daily` (streak) · `/weekly` · `/monthly` · `/work` · `/crime` · `/rob`
- [ ] `/beg` · `/search` · `/fish` · `/hunt` · `/mine`

**Faza 3 — Hazard** (canvas + FFmpeg animacje)
- [ ] `/coin-flip` · `/dice` · `/slots` (animacja MP4) · `/blackjack` (buttons)
- [ ] `/roulette` · `/higher-lower` · `/wheel` · `/coin-war` (PvP)
- [ ] `economyVideoRenderer.ts` — canvas 500×140px → FFmpeg ultrafast pipe → MP4

**Faza 4 — Sklep**
- [ ] `ShopItem.ts` · `InventoryItem.ts`
- [ ] `/shop` · `/buy` · `/sell` · `/inventory` · `/use` · `/give`
- [ ] `/open` (lootbox, animacja jak DisGo) · `/market` · `/auction` · `/bid`

**Faza 5 — Profil**
- [ ] `/profile` · `/stats` · `/history` · `/networth` · `/rank` · `/richest`

**Faza 6 — Questy i Osiągnięcia**
- [ ] `Quest.ts` · `Achievement.ts`
- [ ] `/quest` · `/missions` · `/claim` · `/achievements`

**Faza 7 — Prestige i Poziomy**
- [ ] `/level` (economy level, osobny od XP) · `/prestige`

**Faza 8 — Social / PvP**
- [ ] `/rps` · `/duel` · `/horse-race` · `/lottery` · `/jackpot` · `/trade`

**Faza 9 — Administracja**
- [ ] `/add-money` · `/remove-money` · `/reset-user` (adminOnly)
- [ ] Anti-abuse: rate limits, inflation monitor, alt detection

**Faza 10 — Dashboard**
- [ ] Panel admina: config waluty, nagrody, sklep, anti-abuse, audit log

### Nowe serwisy

```
src/services/
  economyService.ts       — core finansowe (atomowe $inc)
  gamblingService.ts      — hazard + house edge
  shopService.ts          — sklep, buy/sell/inventory
  questService.ts         — questy i misje
  achievementService.ts   — osiągnięcia

src/utils/
  economyVideoRenderer.ts — canvas + FFmpeg → MP4 dla slots/lootbox
  economyEmbeds.ts        — createBalanceEmbed, createShopEmbed etc.
```

---

## Struktura plików (quick-ref)

```
src/
  commands/
    economy/    — balance, deposit, withdraw, send, leaderboard, daily, weekly,
                  monthly, work, crime, rob, beg, search, fish, hunt, mine,
                  shop, buy, sell, inventory, use, give, open, market, auction,
                  bid, profile, stats, history, rank, quest, missions, claim,
                  achievements, level, prestige, pay, richest, networth, add-money,
                  remove-money, reset-user
    gambling/   — coin-flip, dice, slots, blackjack, roulette, higher-lower,
                  wheel, coin-war, rps, duel, horse-race, lottery, jackpot
    fun/        — 8ball, wisielec, wordle, meme itp.
    admin/      — ownerOnly komendy
    misc/       — pogoda, ciekawostka
    moderation/ — warn, role
    user/       — level (XP), toplvl
  models/
    Economy.ts · EconomyTransaction.ts · EconomyConfig.ts
    ShopItem.ts · InventoryItem.ts · Achievement.ts
    Quest.ts · AuctionItem.ts
    (+ istniejące: Level, Giveaway, Ticket, etc.)
  services/
    economyService.ts · gamblingService.ts · shopService.ts
    questService.ts · achievementService.ts
    (+ istniejące: xpService, giveawayService, etc.)
  utils/
    economyVideoRenderer.ts · economyEmbeds.ts
    (+ istniejące: embedHelpers, cooldownHelpers, logger, etc.)
```
