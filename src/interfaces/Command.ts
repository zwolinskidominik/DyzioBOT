import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  Client,
} from 'discord.js';

export interface ICommand {
  data: SlashCommandBuilder;
  options?: ICommandConfig;
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
  guildOnly?: boolean;
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
