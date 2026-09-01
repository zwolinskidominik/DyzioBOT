import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  Client,
} from 'discord.js';

export interface ICommand {
  data: SlashCommandBuilder;
  options?: ICommandConfig;
  /** Nazwa folderu nadrzędnego w src/commands/ (np. "fun", "misc") — nadawana automatycznie przez CommandHandler. */
  category?: string | undefined;
  run: (options: ICommandOptions) => Promise<void>;
  autocomplete?: (options: {
    interaction: AutocompleteInteraction;
    client: Client;
  }) => Promise<void>;
}

export interface ICommandConfig {
  userPermissions?: bigint | bigint[];
  botPermissions?: bigint | bigint[];
  deleted?: boolean;
  cooldown?: number;
  devOnly?: boolean;
  /**
   * Ogranicza komendę do właściciela bota (OWNER_IDS z config/constants/owner.ts),
   * niezależnie od uprawnień Discorda czy konfiguracji DEV_USER_IDS. Sprawdzane
   * centralnie w CommandHandler — NIE dodawaj ręcznego `if (OWNER_IDS.includes(...))`
   * w run() komendy.
   */
  ownerOnly?: boolean;
  guildOnly?: boolean;
  /**
   * Rejestruje komendę WYŁĄCZNIE na wymienionych serwerach (guild-scoped) i blokuje jej
   * użycie gdziekolwiek indziej — bez wymogu bycia deweloperem (w przeciwieństwie do `devOnly`).
   * Przeznaczone dla publicznych, ale prywatnych dla jednego serwera funkcji (np. OWNER_GUILD_IDS).
   */
  restrictedGuildIds?: string[];
}

export interface ICommandHandlerConfig {
  devGuildIds?: string[];
  devUserIds?: string[];
  devRoleIds?: string[];
  bulkRegister?: boolean;
}

export interface ICommandOptions {
  interaction: ChatInputCommandInteraction;
  client: Client;
}
