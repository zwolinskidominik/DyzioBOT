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

(async () => {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Połączono z bazą danych.');

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

    client.login(process.env.TOKEN);
  } catch (error) {
    console.log(`Wystąpił błąd: ${error} łącząc się z bazą danych.`);
  }
})();