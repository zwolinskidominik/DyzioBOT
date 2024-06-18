require("dotenv").config();
const {
  TOKEN,
  CLIENT_ID,
  DEV_GUILD_IDS,
  DEV_USER_IDS,
  DEV_ROLE_IDS,
  MONGODB_URI,
} = process.env;
const guildMemberAddEvent = require("./events/guildMemberAdd/autoRole.js");
const { Client, IntentsBitField, REST, Routes } = require("discord.js");
const { CommandKit } = require("commandkit");
const mongoose = require("mongoose");

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.MessageContent,
  ],
});

const parsedDevGuildIds = DEV_GUILD_IDS
  ? DEV_GUILD_IDS.split(",").map((id) => id.trim())
  : [];
const parsedDevUserIds = DEV_USER_IDS
  ? DEV_USER_IDS.split(",").map((id) => id.trim())
  : [];
const parsedDevRoleIds = DEV_ROLE_IDS
  ? DEV_ROLE_IDS.split(",").map((id) => id.trim())
  : [];

new CommandKit({
  client,
  commandsPath: `${__dirname}/commands`,
  eventsPath: `${__dirname}/events`,
  validationsPath: `${__dirname}/validations`,
  devGuildIds: parsedDevGuildIds,
  devUserIds: parsedDevUserIds,
  devRoleIds: parsedDevRoleIds,
  bulkRegister: false,
});

client.on("guildMemberAdd", (member) => {
  guildMemberAddEvent(client, member);
});

mongoose.connect(MONGODB_URI).then(() => {
  console.log("Połączono z bazą danych.");

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // Clear commands globally.
  console.log("Clearing commands...");

  // Clear the commands.
  rest
    .put(Routes.applicationCommands(CLIENT_ID), { body: [] })
    .then(() => console.log("Commands cleared."))
    .catch(console.error);

  client.login(TOKEN);
});
