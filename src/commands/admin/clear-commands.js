require('dotenv/config'); // Import environment variables.
const { REST, Routes } = require('discord.js'); // Import Routes and the REST class.
const { TOKEN, CLIENT_ID } = process.env; // These are the same we wrote in the .env file.

// Create a REST instance. Make sure to set the token.
const rest = new REST({ version: '10' }).setToken(TOKEN);

// Clear commands globally.
function clearGlobalCommands() {
  console.log('Clearing commands...');

  // Clear the commands.
  rest
    .put(Routes.applicationCommands(CLIENT_ID), { body: [] })
    .then(() => console.log('Commands cleared.'))
    .catch(console.error); // Make sure to catch any errors.
}

// Clear commands for a specific guild.
function clearGuildCommands(guildId) {
  if (!guildId) throw new Error('You must provide a guild id.');

  console.log('Clearing commands...');

  // Clear the commands.
  rest
    .put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: [] })
    .then(() => console.log(`Commands cleared for guild "${guildId}".`))
    .catch(console.error); // Make sure to catch any errors.
}

// Uncomment the next line to clear global commands.
clearGlobalCommands();

// Uncomment the next line to clear commands for a guild.
// clearGuildCommands('ENTER GUILD ID HERE');