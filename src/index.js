require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const { CommandKit } = require('commandkit');
const mongoose = require('mongoose');
const path = require('path');

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
      commandsPath: path.join(__dirname, 'commands'),
      eventsPath: path.join(__dirname, 'events'),
      validationsPath: path.join(__dirname, 'validations'),
      devGuildIds: ['1119330659127795822'],
      devUserIds: ['548177225661546496'],
      devRoleIds: ['1209504337412235347'],
    })

    client.login(process.env.TOKEN);
  } catch (error) {
    console.log(`Wystąpił błąd: ${error} łącząc się z bazą danych.`);
  }
})();