require('dotenv').config();
const { TOKEN, CLIENT_ID, MONGODB_URI } = process.env; // These are the same we wrote in the .env file.
const guildMemberAddEvent = require('./events/guildMemberAdd/autoRole.js');
const { Client, IntentsBitField } = require('discord.js');
const { CommandKit } = require('commandkit');
const { REST, Routes } = require('discord.js'); // Import Routes and the REST class.
const mongoose = require('mongoose');


const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.MessageContent,
  ],
});

new CommandKit({
  client,
  commandsPath: `${__dirname}/commands`,
  eventsPath: `${__dirname}/events`,
  validationsPath: `${__dirname}/validations`,
  devGuildIds: ['1119330659127795822'],
  devUserIds: ['548177225661546496'],
  devRoleIds: ['1209504337412235347'],
  bulkRegister: true,
});

client.on('guildMemberAdd', member => {
  guildMemberAddEvent(client, member);
});

mongoose.connect(MONGODB_URI).then(() => {
  console.log('Połączono z bazą danych.');

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  // Clear commands globally.
  console.log('Clearing commands...');

  // Clear the commands.
  rest
    .put(Routes.applicationCommands(CLIENT_ID), { body: [] })
    .then(() => console.log('Commands cleared.'))
    .catch(console.error); // Make sure to catch any errors.

  client.login(TOKEN);
});