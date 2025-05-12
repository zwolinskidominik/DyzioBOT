import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  Client,
  PermissionsBitField,
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
  userPermissions?: Array<keyof typeof PermissionsBitField.Flags>;
  botPermissions?: Array<keyof typeof PermissionsBitField.Flags>;
  deleted?: boolean;
  cooldown?: number;
  devOnly?: boolean;
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
