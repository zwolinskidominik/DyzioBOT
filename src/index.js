require('dotenv').config();
const guildMemberAddEvent = require('./events/guildMemberAdd/autoRole.js');
const { Client, IntentsBitField } = require('discord.js');
const { CommandKit } = require('commandkit');
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
});

client.on('guildMemberAdd', member => {
  guildMemberAddEvent(client, member);
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
console.log('Połączono z bazą danych.');

client.login(process.env.TOKEN);
});