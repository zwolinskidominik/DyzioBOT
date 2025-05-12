import { Client, Partials, GatewayIntentBits } from 'discord.js';
import { CommandHandler } from './handlers/CommandHandler';
import { EventHandler } from './handlers/EventHandler';
import logger from './utils/logger';
import { env } from './config';
import mongoose from 'mongoose';

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

    // import { REST, Routes } from 'discord.js';
    // const rest = new REST({ version: "10" }).setToken(TOKEN);
    // rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] })
    //     .then(() => logger.info("Commands cleared."))
    //     .catch((err) => logger.error(`Błąd przy czyszczeniu komend: ${err}`));

    client
      .login(TOKEN)
      .then(async () => {
        if (!client.user) return;
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

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function gracefulShutdown() {
  if (client && client.isReady()) {
    logger.info('Wylogowywanie klienta Discord...');
    await client.destroy();
  }

  if (mongoose.connection.readyState) {
    logger.info('Zamykanie połączenia z bazą danych...');
    await mongoose.connection.close();
  }

  logger.info('Zamykanie zakończone. Do widzenia!');
  process.exit(0);
}
