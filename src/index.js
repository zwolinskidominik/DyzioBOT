require("dotenv").config();
const {
  TOKEN,
  CLIENT_ID,
  DEV_GUILD_IDS,
  DEV_USER_IDS,
  DEV_ROLE_IDS,
  MONGODB_URI,
} = process.env;

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} = require("discord.js");
const { CommandKit } = require("commandkit");
const mongoose = require("mongoose");

const guildMemberAddEvent = require("./events/guildMemberAdd/autoRole.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessagePolls,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const parseEnvVar = (envVar) =>
  envVar ? envVar.split(",").map((id) => id.trim()) : [];
const parsedDevGuildIds = parseEnvVar(DEV_GUILD_IDS);
const parsedDevUserIds = parseEnvVar(DEV_USER_IDS);
const parsedDevRoleIds = parseEnvVar(DEV_ROLE_IDS);

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

  console.log("Clearing commands...");

  rest
    .put(Routes.applicationCommands(CLIENT_ID), { body: [] })
    .then(() => console.log("Commands cleared."))
    .catch(console.error);

  client.login(TOKEN);
});

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled Rejection Error");
  console.log(reason, promise);
});

process.on("uncaughtException", (err, origin) => {
  console.log("Uncaught Exeception Error");
  console.log(err, origin);
});
