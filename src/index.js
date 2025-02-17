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

const logger = require("./utils/logger");

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
  logger.info("Połączono z bazą danych.");

  // const rest = new REST({ version: "10" }).setToken(TOKEN);
  // logger.info("Clearing commands...");
  // rest
  //   .put(Routes.applicationCommands(CLIENT_ID), { body: [] })
  //   .then(() => logger.info("Commands cleared."))
  //   .catch((err) => logger.error(`Błąd przy czyszczeniu komend: ${err}`));

  client
    .login(TOKEN)
    .then(() => logger.info("Bot zalogowany pomyślnie!"))
    .catch((err) => logger.error(`Nie udało się zalogować: ${err}`));
});

process.on("unhandledRejection", (reason, promise) => {
  logger.warn("Unhandled Rejection Error");
  logger.warn(`Powód: ${reason}`, promise);
});

process.on("uncaughtException", (err, origin) => {
  logger.error("Uncaught Exception Error!");
  logger.error(`Błąd: ${err}\nPochodzenie: ${origin}`);
});
