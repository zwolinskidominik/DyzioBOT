# DyzioBOT — Security Standards & Threat Model

> OWASP ASVS Level 2 target. Secure-by-default, deny-by-default.  
> **Każda zmiana dotycząca auth / API / DB / webhooków wymaga przejrzenia tego dokumentu.**

---

## 1. ZASADY NADRZĘDNE (NEVER NEGOTIATE)

1. **Deny-by-default** — każda akcja wymaga jawnego zezwolenia, nie zakazu
2. **Least privilege everywhere** — minimal Discord intents, minimal DB permissions, minimal API scopes
3. **Zero trust** — każdy request weryfikowany niezależnie, brak "zaufanego wewnętrznego" ruchu
4. **Fail secure** — przy błędzie odmów dostępu, nie udzielaj
5. **Defense in depth** — wiele warstw; żadna nie jest jedyną barierą
6. **Secure by default** — nowe feature = domyślnie wyłączone, wymagaj opt-in
7. **Hostile environment assumption** — traktuj każdy input jako potencjalnie złośliwy

---

## 2. THREAT MODEL

### 2.1 Aktorzy zagrożeń

| Aktor | Motywacja | Przykładowe ataki |
|---|---|---|
| Malicious guild member | Privilege escalation | Command injection, parameter tampering |
| Malicious guild admin | Data exfiltration other guilds | Cross-tenant data access |
| External attacker | Bot takeover, data theft | Credentials theft, API abuse, SSRF |
| Automated scanner | Vulnerability discovery | Next-Action probing, path traversal |
| Insider threat | Unauthorized access | Direct DB query, token abuse |

### 2.2 Krytyczne zasoby do ochrony

- `DISCORD_BOT_TOKEN` — pełna kontrola nad botem
- `MONGODB_URI` — dostęp do wszystkich danych
- `NEXTAUTH_SECRET` — fałszowanie sesji
- Discord OAuth access tokens użytkowników
- Dane moderacyjne (bany, mute, warn history)
- Dane osobowe (userId, username — pseudonimizacja)

### 2.3 Attack surface

```
Internet → Nginx → Dashboard (port 3000)
                      ├── /api/* (API routes)
                      ├── /login (OAuth flow)
                      └── /(dashboard)/* (protected pages)

Discord Gateway → Bot → Commands / Events
                    └── External APIs (Twitch)
```

---

## 3. OWASP TOP 10 MITIGACJE

### A01 — Broken Access Control

**Ryzyko:** User X uzyskuje dostęp do danych gildii Y.

**Mitigacje:**
```typescript
// ZAWSZE w API routes:
const session = await getServerSession(authOptions);
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

// ZAWSZE guildId z URL, nie z body:
const guildId = params.guildId;  // ✅

// ZAWSZE sprawdź czy user należy do gildii:
const userGuild = session.user.guilds?.find(g => g.id === guildId);
if (!userGuild || !(parseInt(userGuild.permissions) & 0x20)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Bot:**
```typescript
// ZAWSZE guildId scope w MongoDB:
await Model.findOne({ guildId: interaction.guildId! });  // ✅
await Model.findOne({ userId });  // ❌ brak tenanta!
```

### A02 — Cryptographic Failures

**Ryzyko:** Wycieklanie tokenów, słabe szyfrowanie sesji.

**Mitigacje:**
- `NEXTAUTH_SECRET`: minimum 32 znaki losowe (`openssl rand -base64 32`)
- Cookies: `httpOnly`, `secure` (prod), `sameSite: 'lax'`
- Discord access tokens: w JWT (encrypted by NextAuth), nigdy w logach
- MongoDB URI: w `.env` (gitignored), docker secret na produkcji
- Nigdy nie loguj: token, hasło, MONGODB_URI, sekret

### A03 — Injection

**NoSQL Injection:**
```typescript
// Mongoose: sanitizeFilter: true w połączeniu
mongoose.set('sanitizeFilter', true);

// Nigdy raw query z user input:
await Model.find({ $where: `this.guildId === '${userInput}'` });  // ❌ SSJI

// Zawsze typed Mongoose queries:
await Model.find({ guildId, userId: interaction.user.id });  // ✅
```

**Command injection (Node.js):**
```typescript
// Nigdy exec() z user inputem
import { exec } from 'child_process';
exec(`process ${userContent}`);  // ❌ NIGDY

// Jeśli potrzebujesz shell — użyj execFile z argumentami
```

**XSS w embedach:**
```typescript
// Discord renderuje markdown — escape potencjalnie niebezpiecznych znaków
function sanitizeEmbed(text: string): string {
  return text.replace(/@(everyone|here)/g, '@\u200b$1');  // zero-width space
}
```

### A04 — Insecure Design

**Privilege escalation:**
```typescript
// OWNER_IDS musi być hardcoded — nie z DB!
// src/lib/owner.ts
export const OWNER_IDS = ['548177225661546496', '548182827532025897'] as const;

// NIGDY:
const owners = await BotConfig.findOne({}).select('ownerIds');
if (owners.ownerIds.includes(userId)) { /* można manipulować */ }
```

**Bot command security:**
```typescript
// Każda komenda sprawdza uprawnienia przed logiką:
if (command.ownerOnly && !OWNER_IDS.includes(interaction.user.id)) {
  return interaction.reply({ content: 'Brak uprawnień.', ephemeral: true });
}
if (command.permissions && !interaction.memberPermissions?.has(command.permissions)) {
  return interaction.reply({ content: 'Brak uprawnień.', ephemeral: true });
}
```

### A05 — Security Misconfiguration

**Env validation przy starcie:**
```typescript
// src/config/env.schema.ts
const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(50),
  MONGODB_URI: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

// Crash przy starcie jeśli brak wymaganego env:
export const config = envSchema.parse(process.env);
// Nigdy: process.env.DISCORD_BOT_TOKEN bezpośrednio
```

**Security headers (next.config.ts):**
```typescript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
```

### A06 — Vulnerable Components

**Dependency security:**
```bash
# W każdym CI run:
npm audit --audit-level=high   # fail jeśli high/critical vulnerability
# Regularnie:
npm outdated                   # sprawdzaj stare paczki
```

**Supply chain:**
- Lockfile (`package-lock.json`) zawsze commitowany
- Nie instaluj paczek z nieznanego źródła
- Przed `npm install <pkg>` sprawdź: npm strona, GitHub, weekly downloads, last publish date
- Preferuj paczki z >1M weekly downloads lub weryfikowanymi maintainerami

### A07 — Authentication Failures

**NextAuth session security:**
```typescript
// authOptions w src/lib/auth.config.ts:
{
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  cookies: {
    sessionToken: {
      options: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
    }
  },
  callbacks: {
    async jwt({ token, account }) {
      // Nigdy nie loguj token.accessToken
      if (account) token.accessToken = account.access_token;
      return token;
    }
  }
}
```

**Rate limiting na auth endpoints:**
- `/api/auth/*` — NextAuth obsługuje natively
- `/api/*` — proxy.ts: ioredis sliding window, 100 req/15min per IP

### A07b — Next-Action CSRF (dashboard-specific)

**Zagrożenie:** Zewnętrzne skanery (i atakujący) wysyłają `Next-Action: x/dx/1/...` headers próbując wywołać Server Actions.

**Mitigacja w proxy.ts:**
```typescript
const nextAction = req.headers.get('Next-Action');
if (nextAction !== null) {
  const origin = req.headers.get('Origin');
  const allowedOrigins = [process.env.NEXTAUTH_URL, `https://${req.headers.get('Host')}`]
    .filter(Boolean);
  if (!origin || !allowedOrigins.includes(origin)) {
    return new NextResponse(null, { status: 403 });
  }
}
```

### A08 — SSRF

**Zagrożenie:** Discord proxy endpoint może być nadużyty do fetchowania wewnętrznych URL.

**Mitigacja:**
```typescript
// /api/discord/* endpoints — whitelist URL patterns:
const ALLOWED_DISCORD_DOMAINS = [
  'https://discord.com/api/',
  'https://cdn.discordapp.com/',
];

function validateDiscordUrl(url: string): boolean {
  return ALLOWED_DISCORD_DOMAINS.some(allowed => url.startsWith(allowed));
}
```

### A09 — Logging Failures

**Audit log dla mod actions:**
```typescript
// Każda akcja moderacyjna → AuditLog w MongoDB:
interface AuditLogEntry {
  guildId: string;
  actorId: string;      // kto wykonał akcję
  action: ModAction;    // BAN, KICK, WARN, MUTE, UNMUTE, etc.
  targetId: string;     // na kim
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;      // timestamps: true
}
```

**Log redaction — nigdy w logach:**
```typescript
// winston format redaktor:
const redactedFields = ['token', 'accessToken', 'password', 'secret', 'mongoUri'];
// Zawsze loguj: guildId, userId, action — nie ID wrażliwych danych
```

### A10 — SSRF/Request Forgery (webhooks)

Jeśli w przyszłości pojawią się incoming webhooks (np. z zewnętrznych systemów):
```typescript
// HMAC verification — zawsze:
import { createHmac, timingSafeEqual } from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const sig = Buffer.from(signature, 'hex');
  const exp = Buffer.from(expected, 'hex');
  return sig.length === exp.length && timingSafeEqual(sig, exp);
}
```

---

## 4. DISCORD BOT SECURITY

### 4.1 Minimal Intents

Deklaruj tylko intenty których faktycznie używasz:

```typescript
// ❌ ZA DUŻO:
const client = new Client({ intents: [GatewayIntentBits.GuildMembers, ...everything] });

// ✅ MINIMAL:
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,               // podstawowe guild info
    GatewayIntentBits.GuildMessages,         // tylko jeśli używamy messageCreate
    GatewayIntentBits.GuildMembers,          // tylko jeśli invite tracking / levels
    GatewayIntentBits.GuildVoiceStates,      // tylko jeśli temp channels
    // NIE dodawaj DirectMessages jeśli nie jest potrzebne
  ]
});
```

### 4.2 Interaction Verification

discord.js v14 weryfikuje Ed25519 signature każdej interakcji automatycznie. Nie wyłączaj, nie obchodź.

### 4.3 Mention Sanitization

```typescript
// Embedy nie mogą pingować @everyone/@here:
const embed = createBaseEmbed()
  .setDescription(sanitizeContent(userInput));

// allowedMentions jako default we wszystkich komendach:
await interaction.reply({
  embeds: [embed],
  allowedMentions: { parse: [] }  // żadnych pingów
});
```

### 4.4 Anti-Spam / Cooldowns

```typescript
// Per-user cooldown w każdej komendzie:
interface ICommand {
  cooldown?: number;      // sekundy, domyślnie 3
  globalCooldown?: number; // cooldown niezależnie od gildii
}

// Implementacja: src/utils/cooldownHelpers.ts
// Mapa: userId:commandName → timestamp
```

### 4.5 Permission Validation

```typescript
// Sprawdzaj uprawnienia ZANIM wykonasz akcję:
async function banMember(guild: Guild, targetId: string): Promise<ServiceResult<void>> {
  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
    return { ok: false, error: 'Bot nie ma uprawnienia BAN_MEMBERS.', code: 'FORBIDDEN' };
  }
  // wykonaj ban
}
```

---

## 5. RBAC (Role-Based Access Control)

### 5.1 Bot permissions hierarchy

```
OWNER (OWNER_IDS)
  ├── Pełny dostęp: wszystkie komendy, config bota, debug
  └── Może zarządzać każdą gildią

Guild Admin (adminRoles z GuildConfig)
  ├── Może zarządzać modułami gildii
  ├── Może zarządzać modroles
  └── Może używać komend administracyjnych

Guild Mod (modRoles z GuildConfig)
  ├── Może używać komend moderacyjnych (ban, kick, warn, mute)
  └── Nie może zmieniać konfiguracji gildii

Regular User
  └── Komendy publiczne (stats, profile, fun)
```

### 5.2 Dashboard permissions

```typescript
// Sprawdzanie dostępu do gildii:
function canAccessGuild(userGuilds: UserGuild[], guildId: string): boolean {
  const guild = userGuilds.find(g => g.id === guildId);
  if (!guild) return false;
  const MANAGE_GUILD = 0x20;
  return Boolean(parseInt(guild.permissions) & MANAGE_GUILD) || guild.owner === true;
}
```

---

## 6. SECRETS MANAGEMENT

### 6.1 Lokalne środowisko

```
.env                 — lokalna konfiguracja (GITIGNORED)
.env.example         — template bez wartości (committed)
```

Każdy developer tworzy własny `.env` na podstawie `.env.example`.

### 6.2 Produkcja (VPS)

```bash
# Docker secrets (preferred):
docker secret create discord_token /path/to/token.txt
docker secret create mongodb_uri /path/to/uri.txt

# Lub env_file: (akceptowalne, nie environment: inline):
# docker-compose.yml
services:
  bot:
    env_file: .env.production  # nie w repozytorium!
```

### 6.3 CI/CD

```yaml
# GitHub Actions — secrets:
# Settings → Secrets → Actions:
# DISCORD_BOT_TOKEN, MONGODB_URI, NEXTAUTH_SECRET, etc.

# Użycie w workflow:
- name: Deploy
  env:
    BOT_TOKEN: ${{ secrets.DISCORD_BOT_TOKEN }}
```

### 6.4 Rotation procedure

1. Wygeneruj nowy token/sekret
2. Zaktualizuj w docker secret / GitHub Secrets / VPS .env
3. `docker compose up --force-recreate -d` (nowy container z nowym sekretem)
4. Zweryfikuj health check
5. Usuń stary secret

---

## 7. SECURITY CHECKLIST

### Przy każdej nowej funkcji

- [ ] Input walidowany przez Zod zanim trafi do serwisu
- [ ] Output nie zawiera danych z innych tenantów
- [ ] MongoDB query zawiera `guildId` scope
- [ ] Nowy API route ma `getServerSession` check jako pierwsza operacja
- [ ] Żadne dane wrażliwe nie trafiają do logów
- [ ] Cooldown / rate limit dla nowej komendy

### Przy zmianach auth/session

- [ ] `authOptions` zmieniane tylko w `src/lib/auth.config.ts`
- [ ] Cookies pozostają httpOnly + secure (prod)
- [ ] CSRF protection nie jest wyłączona
- [ ] Nowe OAuth scopes uzasadnione i minimalne

### Przy dodawaniu zewnętrznego API

- [ ] Otwórz skill `api-rate-limiting`
- [ ] Token przechowywany w `.env`, nigdy hardcoded
- [ ] Rate limiting po stronie klienta (nie czekaj na 429)
- [ ] SSRF validation jeśli URL pochodzi od usera
- [ ] Timeout ustawiony (nigdy indefinite hang)

### Przy deploy

- [ ] `npm audit --audit-level=high` — brak critical/high
- [ ] Nowe `.env` zmienne dodane do `.env.example` (bez wartości)
- [ ] Sekrety zaktualizowane na VPS
- [ ] Security headers obecne w response (sprawdź curl -I)
</content>
</invoke>