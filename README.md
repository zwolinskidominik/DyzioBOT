# DyzioBOT

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)

Advanced Discord bot with comprehensive dashboard, moderation tools, community features, and seamless Twitch integration.

## 📋 Table of Contents

- [Features](#-features)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Bot](#-running-the-bot)
- [Dashboard](#-dashboard)
- [Docker Deployment](#-docker-deployment)
- [Project Structure](#-project-structure)
- [Available Commands](#-available-commands)
- [Testing](#-testing)
- [Development](#-development)
- [Technologies](#-technologies)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 🎨 Web Dashboard

- **Modern Next.js 15 Interface** with App Router and React Server Components
- **Discord OAuth Integration** for secure authentication
- **Real-time Configuration** for all bot modules
- **Audit Logging** tracking all configuration changes
- **Guild Management** with role-based access control
- **shadcn/ui Components** for beautiful, accessible UI
- **Responsive Design** optimized for all devices

### 🛡️ Moderation

- Warning system with persistent storage
- Temporary user muting (timeout)
- Kick and ban/unban management
- Auto-moderation features
- Comprehensive audit logging

### 🎮 Fun & Entertainment

- Meme generator from Reddit
- Fortune telling system (wróżba)
- Animal pictures (cats and dogs)
- Custom embed creator
- Dice rolling game
- Faceit CS2 player statistics

### 📊 Statistics & Tracking

- **Monthly Statistics** - Automated monthly activity leaderboards with voice/message tracking
- **Channel Statistics** - Real-time stats (members, bots, voice users) in voice channel names
- **Level System** - XP-based leveling with configurable rewards and role assignments
- Member join/leave statistics
- Server information display
- Ticket system statistics

### 🎁 Community Features

- **Giveaway System** with role multipliers and custom notes
  - Global role multipliers (dashboard configuration)
  - Per-giveaway role multipliers with merge support
  - Additional notes automatically added to giveaways
- **Tournament Scheduler** - Weekly CS2 tournament announcements with cron scheduling
- **Question of the Day** - Automated daily questions with thread creation
- **Suggestion System** with voting (upvote/downvote)
- **Birthday Announcements** with role assignment
- **Welcome/Goodbye Cards** with Canvas rendering
- **Reaction Roles** - Self-service role assignment via reactions

### 🎥 Twitch Integration

- Stream notifications with customizable messages
- Auto-role assignment for active streamers
- Boost detection and rewards
- Multi-streamer support per guild

### 🎪 Temporary Voice Channels

- Auto-create temporary voice channels
- Full customization (name, limit, privacy)
- Interactive control panel with buttons
- Ownership transfer system
- Auto-cleanup when empty

### 🎟️ Ticket System

- Support ticket creation with categories
- Ticket management (close, reopen, add/remove users)
- Persistent ticket state
- Ticket statistics tracking
- Role-based access control

### 🤖 Auto-Role System

- Automatic role assignment for new members
- Separate roles for bots and users
- Configurable per server

### 🎄 Seasonal Events

- Advent Calendar with daily rewards
- Event-specific features and commands

## 📦 Requirements

- **Node.js** >= 18.x
- **npm** >= 9.x
- **MongoDB** (local or cloud instance like MongoDB Atlas)
- **Discord Bot Token** ([Create one here](https://discord.com/developers/applications))
- **Discord OAuth Application** (for dashboard - same application as bot)

## 🚀 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/zwolinskidominik/DyzioBOT.git
   cd DyzioBOT
   ```

2. **Install bot dependencies:**

   ```bash
   npm install
   ```

3. **Install dashboard dependencies:**

   ```bash
   cd dashboard-nextjs
   npm install
   cd ..
   ```

4. **Build the bot:**

   ```bash
   npm run build
   ```

5. **Build the dashboard:**

   ```bash
   cd dashboard-nextjs
   npm run build
   cd ..
   ```

## ⚙️ Configuration

### Bot Configuration

1. **Create a `.env` file** in the root directory:

   ```env
   # Required
   TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_id
   GUILD_ID=your_main_guild_id
   MONGODB_URI=mongodb://localhost:27017/dyziobot

   # Development mode (optional)
   DEV_GUILD_IDS=123456789,987654321
   DEV_USER_IDS=123456789
   DEV_ROLE_IDS=123456789

   # External APIs (optional)
   TWITCH_CLIENT_ID=your_twitch_client_id
   TWITCH_CLIENT_SECRET=your_twitch_client_secret
   FACEIT_API_KEY=your_faceit_api_key
   ```

2. **Configure guild-specific settings:**
   - Edit `src/config/guild.ts` to customize emoji IDs and guild-specific features
   - Adjust bot configuration in `src/config/bot.ts`

3. **Environment validation:**
   - The bot uses Zod schema validation for environment variables
   - Check `src/config/env.schema.ts` for all available options

### Dashboard Configuration

1. **Create a `.env.local` file** in the `dashboard-nextjs` directory:

   ```env
   # Required
   MONGODB_URI=mongodb://localhost:27017/dyziobot
   NEXTAUTH_SECRET=your_random_secret_key_here
   NEXTAUTH_URL=http://localhost:3000

   # Discord OAuth (same application as bot)
   DISCORD_CLIENT_ID=your_discord_application_id
   DISCORD_CLIENT_SECRET=your_discord_client_secret
   DISCORD_BOT_TOKEN=your_discord_bot_token

   # Production
   # NEXTAUTH_URL=https://your-domain.com
   ```

2. **Generate NEXTAUTH_SECRET:**

   ```bash
   openssl rand -base64 32
   ```

3. **Configure Discord OAuth:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Select your application → OAuth2 → General
   - Add redirect URL: `http://localhost:3000/api/auth/callback/discord`
   - For production: `https://your-domain.com/api/auth/callback/discord`

## 🎨 Dashboard

DyzioBOT includes a modern web dashboard built with Next.js 15 for easy server management.

### Features

- **🔐 Discord OAuth Authentication** - Secure login with Discord
- **📊 Server Statistics** - View detailed analytics and metrics
- **⚙️ Module Configuration** - Enable/disable bot features per server:
  - Auto-role system
  - Birthday announcements
  - Greetings (welcome/goodbye messages)
  - Level system
  - Logging (audit logs, mod logs, server logs)
  - Question of the day
  - Server statistics channels
  - Suggestions system
  - Temporary voice channels
  - Ticket system
  - Twitch notifications
  - Tournament announcements
  - Giveaway configuration (role multipliers, additional notes)
- **📝 Audit Logs** - Complete history of all bot actions and configuration changes
- **🎁 Giveaway Manager** - Configure global role multipliers and additional notes for giveaways
- **📈 Monthly Statistics** - View message activity trends across channels
- **🎯 User-friendly Interface** - Built with shadcn/ui components and Tailwind CSS

### Running the Dashboard

#### Development Mode

```bash
cd dashboard-nextjs
npm run dev
```

Dashboard will be available at `http://localhost:3000`

#### Production Mode

```bash
cd dashboard-nextjs
npm run build
npm start
```

### Dashboard Technologies

- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[NextAuth.js](https://next-auth.js.org/)** - Discord OAuth authentication
- **[shadcn/ui](https://ui.shadcn.com/)** - Modern UI component library
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Radix UI](https://www.radix-ui.com/)** - Headless UI primitives
- **[Framer Motion](https://www.framer.com/motion/)** - Animation library
- **[Recharts](https://recharts.org/)** - Chart library for statistics visualization
- **[Lucide React](https://lucide.dev/)** - Beautiful icon set

## 🏃 Running the Bot

### Development Mode (with hot reload)

```bash
npm run dev
```

### Production Mode

```bash
# Build first
npm run build

# Then start
npm start
```

### Type Checking

```bash
npm run check:types
```

## 🐳 Docker Deployment

DyzioBOT includes Docker support for easy deployment with both the bot and dashboard.

### Prerequisites

- Docker
- Docker Compose
- MongoDB (can be included in docker-compose or use external instance)

### Quick Start

1. **Configure environment files:**
   - Create `.env` in root directory (bot configuration)
   - Create `dashboard-nextjs/.env.local` (dashboard configuration)

2. **Start services:**

   ```bash
   docker-compose up -d
   ```

   This will:
   - Build and start the Discord bot
   - Build and start the Next.js dashboard
   - Setup nginx reverse proxy (if configured)

3. **View logs:**

   ```bash
   # Bot logs
   docker-compose logs -f bot

   # Dashboard logs
   docker-compose logs -f dashboard

   # All logs
   docker-compose logs -f
   ```

4. **Stop services:**

   ```bash
   docker-compose down
   ```

### Production Deployment on VPS

For production deployment, the recommended workflow is:

1. **Initial setup on VPS:**

   ```bash
   # Clone repository
   git clone https://github.com/zwolinskidominik/DyzioBOT.git
   cd DyzioBOT

   # Configure environment variables
   nano .env
   nano dashboard-nextjs/.env.local

   # Build and start
   docker-compose up -d --build
   ```

2. **Updating to latest version:**

   ```bash
   # Pull latest changes
   git pull

   # Rebuild and restart containers
   docker-compose up -d --build

   # Or rebuild specific service
   docker-compose up -d --build bot
   docker-compose up -d --build dashboard
   ```

3. **Viewing logs:**

   ```bash
   # Follow all logs
   docker-compose logs -f

   # View last 100 lines
   docker-compose logs --tail=100
   ```

### Docker Configuration

The project includes:

- **`Dockerfile.bot`** - Multi-stage build for the Discord bot
- **`Dockerfile.dashboard`** - Multi-stage build for the Next.js dashboard
- **`docker-compose.yml`** - Orchestration for both services

### Accessing Services

After deployment:
- **Bot**: Automatically connects to Discord
- **Dashboard**: Available at configured port (default: 3000) or behind nginx reverse proxy
- **Logs**: Stored in `logs/` directory (mounted as volume)

##  📁 Project Structure

```text
DyzioBOT/
├── src/                      # Bot source code
│   ├── commands/             # Command implementations
│   │   ├── admin/            # Admin-only commands (giveaway, config, setup, xp)
│   │   ├── fun/              # Fun/entertainment commands (cat, dog, meme)
│   │   ├── misc/             # Miscellaneous commands (avatar, faceit, serverinfo)
│   │   ├── moderation/       # Moderation commands (ban, kick, warn, mute)
│   │   └── user/             # User commands (level, toplvl)
│   ├── events/               # Discord event handlers
│   │   ├── clientReady/      # Bot ready events (schedulers, startup tasks)
│   │   ├── messageCreate/    # Message events (leveling, suggestions)
│   │   ├── interactionCreate/ # Button/select menu interactions
│   │   ├── guildMemberAdd/   # Member join events (greetings, auto-role)
│   │   ├── guildMemberRemove/ # Member leave events
│   │   ├── voiceStateUpdate/ # Voice events (temp channels, stats)
│   │   └── ...               # Other Discord events (bans, roles, threads)
│   ├── handlers/             # Command and event loaders
│   ├── models/               # MongoDB schemas (Typegoose)
│   ├── utils/                # Helper functions and utilities
│   ├── validations/          # Command validation middleware
│   ├── interfaces/           # TypeScript interfaces
│   ├── config/               # Bot configuration files
│   ├── cache/                # Cache implementations (XP, monthly stats)
│   ├── services/             # External API services (Twitch, Faceit)
│   └── index.ts              # Main entry point
├── dashboard-nextjs/         # Web dashboard
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── (auth)/       # Authentication pages (login, error)
│   │   │   ├── (dashboard)/  # Dashboard pages (per-guild)
│   │   │   │   └── [guildId]/
│   │   │       ├── audit-logs/    # Audit log viewer
│   │   │       ├── giveaway/      # Giveaway config (role multipliers)
│   │   │       ├── modules/       # Module enable/disable
│   │   │       ├── monthly-stats/ # Message statistics charts
│   │   │       └── page.tsx       # Guild overview
│   │   │   └── api/          # API routes
│   │   │       ├── auth/     # NextAuth Discord OAuth
│   │   │       └── guild/    # Guild-specific APIs (config, stats)
│   │   ├── components/       # React components (shadcn/ui)
│   │   │   └── ui/           # UI primitives (button, card, dialog)
│   │   ├── lib/              # Utility functions (MongoDB, auth, utils)
│   │   ├── models/           # MongoDB schemas (Mongoose)
│   │   └── types/            # TypeScript types
│   ├── public/               # Static assets
│   └── ...                   # Config files (next.config, tailwind, components)
├── tests/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration/E2E tests
│   ├── e2e/                  # End-to-end tests
│   └── mongo/                # MongoDB test setup
├── dist/                     # Compiled JavaScript (after build)
├── coverage/                 # Test coverage reports (lcov, HTML)
├── logs/                     # Application logs (Winston)
├── assets/                   # Images and static files
│   ├── adventcalendar/       # Advent calendar images
│   ├── lobby/                # Tournament lobby images
│   ├── thumbnails/           # Embed thumbnails
│   └── tickets/              # Ticket system images
├── Dockerfile.bot            # Docker config for bot (multi-stage build)
├── Dockerfile.dashboard      # Docker config for dashboard (multi-stage build)
├── docker-compose.yml        # Docker Compose orchestration
├── jest.config.js            # Jest testing configuration
├── stryker.conf.json         # Mutation testing configuration
├── tsconfig.json             # TypeScript configuration (bot)
└── ...                       # Other config files (package.json, prettier, etc.)
```

## 🎯 Available Commands

### Admin Commands

- `/config-autorole` - Configure automatic role assignment for new members
- `/config-birthday` - Setup birthday announcements and roles
- `/config-greetings` - Configure welcome/goodbye messages channel
- `/config-level` - Setup leveling system (roles, channel, message)
- `/config-question` - Setup question of the day system
- `/config-stats` - Configure server statistics channels
- `/config-suggestions` - Setup suggestion system
- `/config-twitch` - Configure Twitch stream notifications
- `/emoji-steal` - Copy emojis from other servers
- `/fortune-add` - Add new fortune messages to the database
- `/giveaway` - Manage giveaways with role multipliers:
  - `create` - Create new giveaway with optional per-giveaway role multipliers
  - `edit` - Edit existing giveaway details
  - `remove` - Delete a giveaway
  - `end` - End giveaway early and pick winners
  - `list` - View all active giveaways
  - `reroll` - Reroll winners for ended giveaway
- `/question` - Manage daily questions (add, list, remove)
- `/reaction-role` - Setup reaction roles (create, delete, list)
- `/say` - Make the bot send a message
- `/setup-ticket` - Setup ticket system for support
- `/temp-channel` - Configure temporary voice channels (add, list, remove)
- `/ticket-stats` - View ticket system statistics
- `/tournament` - Manage CS2 tournament system
- `/twitch` - Manage Twitch streamers (add, list, remove)
- `/xp` - Manage user XP (add, remove, set, reset)

### Fun Commands

- `/cat` - Get random cat pictures
- `/dog` - Get random dog pictures
- `/meme` - Generate random memes from Reddit

### Misc Commands

- `/avatar` - Display user avatar
- `/birthday` - Check user's birthday
- `/birthday-remember` - Set your own birthday
- `/birthday-set-user` - Set another user's birthday (admin)
- `/birthdays-next` - View upcoming birthdays
- `/embed` - Create custom embed messages
- `/emoji` - Get emoji information and statistics
- `/faceit` - Check Faceit CS2 player statistics
- `/level` - Display your or another user's level card with rank
- `/ping` - Check bot latency
- `/roll` - Roll a random number
- `/serverinfo` - Display server information
- `/toplvl` - Show server leaderboard (top 10 users by XP)
- `/warnings` - View user warnings
- `/wrozba` - Get your fortune told (Polish)

### Moderation Commands

- `/ban` - Ban a user from the server
- `/kick` - Kick a user from the server
- `/mute` - Temporarily mute a user
- `/unban` - Unban a user by ID
- `/warn` - Warn a user
- `/warn-remove` - Remove a user's warning

## 🧪 Testing

### Run all tests

```bash
npm test
```

### Run tests with coverage (90% threshold)

```bash
npm run test:coverage
```

Coverage report: `coverage/lcov-report/index.html`

### Run mutation tests (70% threshold)

```bash
npm run mutate
```

Mutation report: `reports/mutation/index.html`

### Watch mode (for development)

```bash
npm run test:watch
```

### Test Structure

- **Unit Tests**: Fast, isolated tests for individual functions
- **Integration Tests**: E2E tests with real MongoDB instance
- **Coverage Requirements**: 90% for statements, branches, functions, and lines
- **Mutation Testing**: Stryker with 70% mutation score threshold

## 🛠️ Development

### Code Quality

- **TypeScript** - Strict type checking enabled
- **Prettier** - Code formatting
- **Jest** - Testing framework with ts-jest
- **Stryker** - Mutation testing

### Event-Driven Architecture

The bot uses Discord.js event emitters with automatic handler loading:

```typescript
// Events are automatically loaded from src/events/
client.on(''messageCreate'', async (message) => {
  // Multiple handlers can respond to the same event
  await createSuggestions(message);
  await handleLeveling(message);
});
```

### Database Models

MongoDB schemas using Typegoose for type safety:

```typescript
@modelOptions({ schemaOptions: { collection: ''levels'' } })
export class Level {
  @prop({ required: true })
  public guildId!: string;

  @prop({ required: true })
  public userId!: string;

  @prop({ default: 0 })
  public xp!: number;
}
```

### Logging

Winston-based logging with different levels:

```typescript
import logger from ''@/utils/logger'';

logger.info(''Bot is ready'');
logger.error(''Error occurred'', error);
logger.warn(''Warning message'');
logger.debug(''Debug information'');
```

## 🔧 Technologies

### Bot - Core

- **[Discord.js v14](https://discord.js.org/)** - Discord API wrapper
- **[TypeScript 5.8](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Node.js 18+](https://nodejs.org/)** - JavaScript runtime

### Bot - Database

- **[MongoDB](https://www.mongodb.com/)** - NoSQL database
- **[Typegoose](https://typegoose.github.io/typegoose/)** - TypeScript decorators for Mongoose with auto-pluralization

### Bot - External APIs

- **[Twurple](https://twurple.js.org/)** - Twitch API integration
- **[Faceit API](https://developers.faceit.com/)** - CS2 player statistics
- **[Cheerio](https://cheerio.js.org/)** - Web scraping for memes
- **[Canvas](https://www.npmjs.com/package/canvas)** - Image manipulation
- **[Canvacord](https://www.npmjs.com/package/canvacord)** - Discord card generation

### Bot - Testing & Quality

- **[Jest](https://jestjs.io/)** - Testing framework
- **[Stryker](https://stryker-mutator.io/)** - Mutation testing
- **[MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)** - In-memory MongoDB for tests

### Bot - Development Tools

- **[tsx](https://www.npmjs.com/package/tsx)** - TypeScript execution
- **[nodemon](https://nodemon.io/)** - Hot reload for development
- **[Winston](https://github.com/winstonjs/winston)** - Structured logging
- **[Zod](https://zod.dev/)** - Schema validation for environment variables
- **[dotenv](https://www.npmjs.com/package/dotenv)** - Environment variable management

### Bot - Utilities

- **[node-cron](https://www.npmjs.com/package/node-cron)** - Task scheduling for automated jobs (tournaments, QOTD, birthdays)
- **[ms](https://www.npmjs.com/package/ms)** - Time string parsing
- **[pretty-ms](https://www.npmjs.com/package/pretty-ms)** - Human-readable time formatting
- **[lodash](https://lodash.com/)** - Utility functions for data manipulation

### Dashboard - Frontend

- **[Next.js 15](https://nextjs.org/)** - React framework with App Router and Server Components
- **[React 19](https://react.dev/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)** - Modern UI component library built on Radix UI
- **[Radix UI](https://www.radix-ui.com/)** - Headless accessible UI primitives
- **[Framer Motion](https://www.framer.com/motion/)** - Animation library for smooth transitions
- **[Lucide React](https://lucide.dev/)** - Beautiful icon set

### Dashboard - Backend & Data

- **[NextAuth.js v5](https://next-auth.js.org/)** - Discord OAuth authentication
- **[Mongoose](https://mongoosejs.com/)** - MongoDB ODM with explicit collection names
- **[Recharts](https://recharts.org/)** - Chart library for statistics visualization
- **[Zod](https://zod.dev/)** - Runtime type validation

### Deployment

- **[Docker](https://www.docker.com/)** - Containerization for both bot and dashboard
- **[Docker Compose](https://docs.docker.com/compose/)** - Multi-container orchestration
- **[nginx](https://www.nginx.com/)** (optional) - Reverse proxy for dashboard

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m ''Add some AmazingFeature''`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Coding Standards

- Write tests for new features (minimum 90% coverage)
- Follow TypeScript best practices
- Use Prettier for code formatting
- Write clear commit messages
- Update documentation as needed

## 📄 License

This project is licensed under the **AGPL-3.0-or-later** License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by [Dominik Zwoliński](https://github.com/zwolinskidominik)**
