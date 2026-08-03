# GitHub Copilot — instrukcje projektu DyzioBOT

> **Ten plik jest ładowany automatycznie przez Copilot do każdego promptu w tym workspace.**
> Pełne instrukcje — patrz [AGENTS.md](../AGENTS.md). Poniżej skrót obowiązkowy.

## Reguła #1 — master skill

Przed nietrywialną zmianą **przeczytaj**:

```
c:\Users\Chickenen\.agents\skills\deezybot-project\SKILL.md
```

Sekcja routing mówi które dodatkowe skille otworzyć dla danego zadania.

## Reguła #2 — zewnętrzne API

Każde zadanie dotykające **Discord REST API / Twitch API** wymaga otwarcia:
1. `deezybot-discord-commands` lub `api-rate-limiting` (przy Twitch/bulk)
2. **Zawsze** `api-rate-limiting` gdy jest możliwość 429 / rate limitów

## Reguła #3 — twardy stack

**Bot:**
- discord.js v14 + TypeScript strict
- Mongoose 9 + @typegoose/typegoose 13, modele w `src/models/`
- Serwisy: `ServiceResult<T>` pattern (ok/fail), nigdy throw
- Embedy: `createBaseEmbed()` / `createErrorEmbed()`
- Logger: **tylko** `src/utils/logger.ts` (winston), zero `console.log`
- Testy: **Jest 29** + mongodb-memory-server, coverage ≥ 90/80/90/90
- `OWNER_IDS = ['548177225661546496', '548182827532025897']`

**Dashboard (`dashboard-nextjs/`):**
- Next.js 16 App Router, `--webpack`, TypeScript strict
- NextAuth.js v4 Discord OAuth — `authOptions` w `src/lib/auth.config.ts`
- Shadcn/ui + Tailwind CSS, kolory brand (`bot-primary` gradient)
- ioredis singleton — `src/lib/redis.ts`
- Proxy guard: `src/proxy.ts` (auth + rate limit + Next-Action CSRF)
- Testy: **Vitest** w `src/tests/`, `npm test`
- ownerOnly: `useSession` + `OWNER_IDS.includes(userId)`

## Reguła #4 — bezpieczeństwo (zawsze aktywna)

- **Deny-by-default**: każda akcja wymaga jawnego zezwolenia
- **Least privilege**: Discord intenty minimalne; MongoDB scope zawsze `guildId`
- **Zero trust**: każdy API route weryfikuje sesję niezależnie
- Nigdy `find({})` bez `guildId` scope — izolacja tenantów
- Nigdy dane wrażliwe w logach (token, id, hash)
- CORS + CSP + `X-Frame-Options` w next.config.ts i proxy.ts
- Zod validation na każdym wejściu (API body, env, command options)
- `sanitizeFilter: true` w Mongoose (NoSQL injection protection)

## Reguła #5 — testy obowiązkowe

**Po każdej nowej funkcji lub zmianie API** — utwórz lub zaktualizuj test:
- Bot: `tests/unit/services/` (Jest + mongodb-memory-server)
- Dashboard: `dashboard-nextjs/src/tests/` (Vitest)

## Reguła #6 — czego nie robić

- Nie `console.log` w bocie — tylko `logger.*`
- Nie `any`, nie `as` na siłę
- Nie hardcoduj tokenów / ID — tylko `.env`
- Nie twórz `*.md` podsumowań bez prośby
- Nie ignoruj `ServiceResult` — zawsze sprawdź `.ok` przed `.data`
- Nie `Promise.all` na bulk Discord calls — queue + rate limit
- Nie pomijaj `getServerSession` w API routes dashboardu

## Workspace

- Bot: `c:\Dyzio\Deezy\src\`
- Dashboard: `c:\Dyzio\Deezy\dashboard-nextjs\src\`
- Docker: `docker-compose.yml` — bot + dashboard + redis
- Docs: `docs/` — ARCHITECTURE, SECURITY, DEVELOPMENT, TESTING, DEVOPS, DATABASE
- VPS: Ubuntu, Nginx reverse proxy → port 3000

## Komunikacja

PL gdy user pisze PL. Krótko. Edytuj pliki zamiast wklejać kod w czacie.
