# DyzioBOT

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

Easy-to-use Discord bot with many features including moderation, fun commands, leveling system, Twitch integration, and more.

## 📋 Table of Contents

- [Features](#-features)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Bot](#-running-the-bot)
- [Project Structure](#-project-structure)
- [Available Commands](#-available-commands)
- [Testing](#-testing)
- [Development](#-development)
- [Technologies](#-technologies)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 🛡️ Moderation

- Warning system with persistent storage
- Temporary user muting (timeout)
- Kick and ban/unban management
- Auto-moderation features

### 🎮 Fun & Entertainment

- Meme generator from Reddit
- Fortune telling system
- Animal pictures (cats and dogs)
- Custom embed creator
- Dice rolling game
- Faceit CS2 player statistics

### 📊 Statistics & Tracking

- Channel statistics tracking (members, bots, voice users)
- Member join/leave statistics
- Server information display
- Ticket system statistics

### 🎁 Community Features

- Giveaway system
- Question of the day
- Suggestion system with voting
- Birthday announcements
- Welcome/goodbye cards with Canvas

### 🎥 Twitch Integration

- Stream notifications
- Auto-role assignment for streamers
- Boost detection and rewards

### 🎪 Temporary Voice Channels

- Auto-create temporary voice channels
- Customizable channel settings
- Auto-cleanup when empty

### 🎟️ Ticket System

- Support ticket creation
- Ticket management
- Persistent ticket state
- Ticket statistics tracking

### 🤖 Auto-Role System

- Automatic role assignment for new members
- Separate roles for bots and users
- Configurable per server

## 📦 Requirements

- **Node.js** >= 18.x
- **npm** >= 9.x
- **MongoDB** (local or cloud instance)
- **Discord Bot Token** ([Create one here](https://discord.com/developers/applications))

## 🚀 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/zwolinskidominik/DyzioBOT.git
   cd DyzioBOT
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the project:**

   ```bash
   npm run build
   ```

## ⚙️ Configuration

1. **Create a `.env` file** in the root directory:

   ```env
   # Required
   TOKEN=your_discord_bot_token
   MONGODB_URI=mongodb://localhost:27017/dyziobot

   # Optional - Development mode
   DEV_GUILD_IDS=123456789,987654321
   DEV_USER_IDS=123456789
   DEV_ROLE_IDS=123456789

   # Optional - External APIs
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

## 📁 Project Structure

```text
DyzioBOT/
 src/
    commands/             # Command implementations
       admin/             # Admin-only commands
       fun/               # Fun/entertainment commands
       misc/              # Miscellaneous commands
       moderation/        # Moderation commands
    events/               # Discord event handlers
       clientReady/       # Bot ready events
       messageCreate/     # Message events
       interactionCreate/ # Button/select menu interactions
       guildMemberAdd/    # Member join events
       guildMemberRemove/ # Member leave events
       voiceStateUpdate/  # Voice state events
    handlers/             # Command and event loaders
    models/               # MongoDB/Mongoose schemas
    utils/                # Helper functions and utilities
    validations/          # Command validation middleware
    interfaces/           # TypeScript interfaces
    config/               # Bot configuration
    index.ts              # Main entry point
 tests/
    unit/                 # Unit tests
    integration/          # Integration/E2E tests
    mongo/                # MongoDB test setup
 dist/                    # Compiled JavaScript (after build)
 coverage/                # Test coverage reports
 logs/                    # Application logs
 assets/                  # Images and static files
```

## 🎯 Available Commands

### Admin Commands

- `/config-autorole` - Configure automatic role assignment for new members
- `/config-birthday` - Setup birthday announcements and roles
- `/config-greetings` - Configure welcome/goodbye messages channel
- `/config-question` - Setup question of the day system
- `/config-stats` - Configure server statistics channels
- `/config-suggestions` - Setup suggestion system
- `/config-twitch` - Configure Twitch stream notifications
- `/emoji-steal` - Copy emojis from other servers
- `/fortune-add` - Add new fortune messages to the database
- `/giveaway` - Manage giveaways (create, edit, remove, end, list, reroll)
- `/question` - Manage daily questions (add, list, remove)
- `/say` - Make the bot send a message
- `/setup-ticket` - Setup ticket system for support
- `/temp-channel` - Configure temporary voice channels (add, list, remove)
- `/ticket-stats` - View ticket system statistics
- `/twitch` - Manage Twitch streamers (add, list, remove)

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
- `/ping` - Check bot latency
- `/roll` - Roll a random number
- `/serverinfo` - Display server information
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

### Core

- **[Discord.js v14](https://discord.js.org/)** - Discord API wrapper
- **[TypeScript 5.8](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Node.js 18+](https://nodejs.org/)** - JavaScript runtime

### Database

- **[MongoDB](https://www.mongodb.com/)** - NoSQL database
- **[Mongoose](https://mongoosejs.com/)** - MongoDB ODM
- **[Typegoose](https://typegoose.github.io/typegoose/)** - TypeScript decorators for Mongoose

### External APIs

- **[Twurple](https://twurple.js.org/)** - Twitch API integration
- **[Faceit API](https://developers.faceit.com/)** - CS2 player statistics
- **[Cheerio](https://cheerio.js.org/)** - Web scraping for memes
- **[Canvas](https://www.npmjs.com/package/canvas)** - Image manipulation
- **[Canvacord](https://www.npmjs.com/package/canvacord)** - Discord card generation

### Testing & Quality

- **[Jest](https://jestjs.io/)** - Testing framework
- **[Stryker](https://stryker-mutator.io/)** - Mutation testing
- **[MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)** - In-memory MongoDB for tests

### Development Tools

- **[tsx](https://www.npmjs.com/package/tsx)** - TypeScript execution
- **[nodemon](https://nodemon.io/)** - Hot reload
- **[Winston](https://github.com/winstonjs/winston)** - Logging
- **[Zod](https://zod.dev/)** - Schema validation
- **[dotenv](https://www.npmjs.com/package/dotenv)** - Environment variables

### Utilities

- **[node-cron](https://www.npmjs.com/package/node-cron)** - Task scheduling for automated jobs
- **[ms](https://www.npmjs.com/package/ms)** - Time string parsing
- **[pretty-ms](https://www.npmjs.com/package/pretty-ms)** - Human-readable time formatting
- **[lodash](https://lodash.com/)** - Utility functions for data manipulation

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
