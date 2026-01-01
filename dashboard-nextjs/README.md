# 🎮 DyzioBot Dashboard

Profesjonalny panel administracyjny dla bota Discord - DyzioBot. Zbudowany z Next.js 15, TypeScript, TailwindCSS i shadcn/ui.

## 🚀 Technologie

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS + PostCSS
- **UI Components:** Radix UI (shadcn/ui)
- **Icons:** Lucide React
- **Animations:** Framer Motion
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod
- **Authentication:** NextAuth.js (Discord OAuth2)
- **Database:** MongoDB + Mongoose
- **Notifications:** Sonner
- **Data Fetching:** SWR

## 📦 Instalacja

### 1. Zainstaluj zależności

```bash
cd dashboard-nextjs
npm install
```

### 2. Konfiguracja zmiennych środowiskowych

Skopiuj plik `.env.local.example` do `.env.local`:

```bash
cp .env.local.example .env.local
```

Wypełnij wymagane wartości:

```env
# Discord OAuth2
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=wygeneruj_tajny_klucz

# MongoDB
MONGODB_URI=mongodb://localhost:27017/dyziobot
```

#### Generowanie NEXTAUTH_SECRET:

```bash
openssl rand -base64 32
```

#### Uzyskanie Discord Client ID/Secret:

1. Przejdź do [Discord Developer Portal](https://discord.com/developers/applications)
2. Wybierz swoją aplikację (DyzioBot)
3. Przejdź do **OAuth2** → **General**
4. Skopiuj **Client ID** i **Client Secret**
5. Dodaj Redirect URI: `http://localhost:3000/api/auth/callback/discord`

### 3. Uruchom serwer deweloperski

```bash
npm run dev
```

Dashboard będzie dostępny pod adresem: [http://localhost:3000](http://localhost:3000)

## 🏗️ Struktura projektu

```
dashboard-nextjs/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Auth layout group
│   │   │   └── login/           # Strona logowania
│   │   ├── (dashboard)/         # Dashboard layout group
│   │   │   ├── [guildId]/       # Dynamic routes dla serwerów
│   │   │   │   ├── birthdays/   # Moduł urodzin
│   │   │   │   ├── greetings/   # Moduł powitan
│   │   │   │   ├── levels/      # System poziomów
│   │   │   │   ├── autoroles/   # Auto-role
│   │   │   │   ├── suggestions/ # Sugestie
│   │   │   │   └── tickets/     # Tickety
│   │   │   └── guilds/          # Guild selector
│   │   ├── api/                 # API Routes
│   │   │   ├── auth/            # NextAuth endpoints
│   │   │   └── guild/           # Guild API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── dashboard/           # Dashboard components
│   │   ├── forms/               # Form components
│   │   └── charts/              # Chart components
│   ├── lib/
│   │   ├── discord/             # Discord utilities
│   │   ├── mongodb/             # Database models
│   │   ├── validations/         # Zod schemas
│   │   └── utils.ts
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript types
│   └── config/                  # Configuration files
├── public/                      # Static assets
├── .env.local                   # Environment variables
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## 🎨 Funkcjonalności

### Gotowe moduły:
- ✅ Strona logowania Discord OAuth2
- 🚧 Guild Selector (w budowie)
- 🚧 Dashboard Home (w budowie)
- 🚧 Moduł Urodzin
- 🚧 Moduł Powitan
- 🚧 System Poziomów
- 🚧 Auto-role
- 🚧 Sugestie
- 🚧 Tickety

### Planowane:
- Dark/Light mode toggle
- Statystyki i wykresy
- Leaderboard XP
- Role rewards management
- Channel/Role multipliers

## 🔧 Dostępne komendy

```bash
npm run dev         # Uruchom serwer deweloperski
npm run build       # Build aplikacji produkcyjnej
npm run start       # Uruchom build produkcyjny
npm run lint        # Sprawdź kod ESLint
npm run type-check  # Sprawdź typy TypeScript
```

## 🌐 Deploy

### Vercel (zalecane):

1. Push kodu do GitHub
2. Import projektu w Vercel
3. Dodaj zmienne środowiskowe w Settings
4. Deploy!

### Railway:

1. Połącz repo GitHub
2. Dodaj zmienne środowiskowe
3. Deploy automatycznie

**Ważne:** Zaktualizuj `NEXTAUTH_URL` i Discord Redirect URI na URL produkcyjny!

## 📚 Dodatkowe zasoby

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)

## 📝 Licencja

Projekt prywatny - DyzioBot

---

**Autor:** DyzioBot Team  
**Status:** 🚧 W budowie
