/**
 * Skrypt do całkowitego wyczyszczenia wszystkich komend Discord
 */
import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!TOKEN || !CLIENT_ID) {
  throw new Error('Brak TOKEN lub CLIENT_ID w pliku .env');
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function clearAll() {
  try {
    console.log('🧹 Czyszczę globalne komendy...');
    await rest.put(Routes.applicationCommands(CLIENT_ID!), { body: [] });
    console.log('✅ Usunięto wszystkie globalne komendy');

    if (GUILD_ID) {
      console.log(`🧹 Czyszczę komendy na serwerze ${GUILD_ID}...`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID), { body: [] });
      console.log('✅ Usunięto wszystkie komendy z serwera');
    }

    console.log('\n✅ Wszystkie komendy zostały usunięte!');
    console.log('💡 Teraz restart bota aby załadował nowe komendy');
    process.exit(0);
  } catch (error) {
    console.error('❌ Błąd:', error);
    process.exit(1);
  }
}

clearAll();
