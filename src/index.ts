import { Client, Partials, GatewayIntentBits } from 'discord.js';
import { CommandHandler } from './handlers/CommandHandler';
import { EventHandler } from './handlers/EventHandler';
import flushXp, { startXpFlushScheduler } from './events/clientReady/xpFlush';
import { startMonthlyStatsFlushScheduler } from './events/clientReady/monthlyStatsFlush';
import xpCache from './cache/xpCache';
import { flushMonthlyStats } from './cache/monthlyStatsCache';
import logger from './utils/logger';
import { env } from './config';
import mongoose from 'mongoose';
import 'reflect-metadata';

const { TOKEN, MONGODB_URI, DEV_GUILD_IDS, DEV_USER_IDS, DEV_ROLE_IDS } = env();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

new CommandHandler(client, {
  devGuildIds: DEV_GUILD_IDS,
  devUserIds: DEV_USER_IDS,
  devRoleIds: DEV_ROLE_IDS,
  bulkRegister: false,
});

new EventHandler(client);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    logger.info('Połączono z bazą.');

    client
      .login(TOKEN)
      .then(async () => {
        if (!client.user) return;
        await xpCache.setClient(client);
        startXpFlushScheduler();
        startMonthlyStatsFlushScheduler();
        logger.info(`${client.user.tag} jest online.`);
      })
      .catch((err) => logger.error(`❌ Nie udało się zalogować: ${err}`));
  })
  .catch((err) => logger.error(`❌ Błąd połączenia z MongoDB:, ${err}`));

process.on('unhandledRejection', (reason, promise) => {
  logger.warn('Unhandled Rejection Error');
  logger.warn(`Powód: ${reason}`, promise);
});

process.on('uncaughtException', (err, origin) => {
  logger.error('Uncaught Exception Error!');
  logger.error(`Błąd: ${err}\nPochodzenie: ${origin}`);
});

async function gracefulShutdown() {
  console.log('⚙️  Received shutdown signal — flushing caches…');
  
  try {
    await flushXp();
    console.log('✅ XP cache flushed');
  } catch (err) {
    console.error('❌ Błąd podczas ostatniego flushu XP:', err);
  }

  try {
    await flushMonthlyStats();
    console.log('✅ Monthly stats cache flushed');
  } catch (err) {
    console.error('❌ Błąd podczas ostatniego flushu monthly stats:', err);
  }

  if (client && client.isReady()) {
    logger.info('Wylogowywanie klienta Discord...');
    await client.destroy();
  }

  if (mongoose.connection.readyState) {
    logger.info('Zamykanie połączenia z bazą danych...');
    await mongoose.connection.close();
  }

  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('beforeExit', gracefulShutdown);
