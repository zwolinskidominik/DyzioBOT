import { Client, GatewayIntentBits } from 'discord.js';
import { CommandHandler } from '../handlers/CommandHandler';
import dotenv from 'dotenv';

dotenv.config();

const { TOKEN, DEV_GUILD_IDS, DEV_USER_IDS, DEV_ROLE_IDS } = process.env;

if (!TOKEN) {
  throw new Error('Brak TOKEN w pliku .env');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

new CommandHandler(client, {
  devGuildIds: DEV_GUILD_IDS?.split(',') || [],
  devUserIds: DEV_USER_IDS?.split(',') || [],
  devRoleIds: DEV_ROLE_IDS?.split(',') || [],
  bulkRegister: true,
});

client.once('ready', async () => {
  console.log('✅ Bot zalogowany, synchronizuję komendy...');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('✅ Komendy zsynchronizowane! Zamykam bota...');
  client.destroy();
  process.exit(0);
});

client.login(TOKEN);
