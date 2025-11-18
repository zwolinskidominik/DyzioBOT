import {
  Client,
  GuildMember,
  Interaction,
  MessageFlags,
  ApplicationCommandData,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  type ApplicationCommand,
  type InteractionReplyOptions,
} from 'discord.js';
import type { ICommand, ICommandHandlerConfig } from '../interfaces/Command';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger';

type CommandInteraction =
  | ChatInputCommandInteraction
  | MessageContextMenuCommandInteraction
  | UserContextMenuCommandInteraction;

export class CommandHandler {
  private readonly client: Client;
  private readonly commands: Map<string, ICommand> = new Map();
  private readonly validations: Array<
    (interaction: CommandInteraction, command: ICommand) => Promise<string | null>
  > = [];
  private readonly config: ICommandHandlerConfig;

  public constructor(client: Client, config: ICommandHandlerConfig = {}) {
    this.client = client;
    this.config = config;

    this.loadCommands(join(__dirname, '..', 'commands'));
    this.loadValidations(join(__dirname, '..', 'validations'));

    this.client.on('interactionCreate', this.handleInteraction.bind(this));
    this.client.once('clientReady', async () => {
      if (this.config.bulkRegister) {
        await this.clearCommands()
          .then(() => console.log('✅ Wyczyszczono wszystkie komendy.'))
          .catch((err) => logger.error(`❌ Błąd czyszczenia komend: ${err}`));
      }

      await this.registerCommands()
        .then(() => console.log('✅ Zarejestrowano komendy aplikacji.'))
        .catch((err) => logger.error(`❌ Błąd rejestracji komend: ${err}`));
    });
  }

  private loadCommands(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        this.loadCommands(fullPath);
        continue;
      }

      if (!entry.endsWith('.ts') && !entry.endsWith('.js')) continue;

      const commandModule = require(fullPath);

      if (!commandModule.data || !commandModule.run) {
        console.warn(`❕ Pominięto ${entry} (brak eksportu 'data' lub 'run')`);
        continue;
      }

      const command: ICommand = {
        data: commandModule.data,
        run: commandModule.run,
        options: commandModule.options || {},
      };

      if (commandModule.autocomplete) {
        command.autocomplete = commandModule.autocomplete;
      }

      const commandName = command.data.name;
      this.commands.set(commandName, command);
    }
  }

  private loadValidations(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        this.loadValidations(fullPath);
      }

      if (!entry.endsWith('.ts') && !entry.endsWith('.js')) continue;

      const validationModule = require(fullPath);
      if (typeof validationModule.default === 'function') {
        this.validations.push(validationModule.default);
      }
    }
  }

  public async registerCommands(): Promise<void> {
    if (!this.client.application) {
      throw new Error('Klient Discord jeszcze nie gotowy (brak client.application)');
    }
    const globalCommands: ApplicationCommandData[] = [];
    const devCommands: ApplicationCommandData[] = [];

    for (const command of this.commands.values()) {
      if (command.options?.deleted) {
        console.log(`⏩ Pominięto komendę "${command.data.name}" - oznaczona jako usunięta.`);
        continue;
      }

      const json = command.data.toJSON() as unknown as ApplicationCommandData;
      (command.options?.devOnly ? devCommands : globalCommands).push(json);
    }

    if (this.config.bulkRegister) {
      if (globalCommands.length) {
        await this.client.application.commands.set(globalCommands);
        console.log(`✅ Załadowano globalnie ${globalCommands.length} komend.`);
      }

      if (devCommands.length && this.config.devGuildIds?.length) {
        for (const guildId of this.config.devGuildIds) {
          const guild = await this.client.guilds.fetch(guildId);
          if (!guild) {
            console.warn(
              `⚠️ Nie udało się pobrać gildii o ID ${guildId} do rejestracji komend dev.`
            );
            continue;
          }
          await guild.commands.set(devCommands);
          console.log(
            `✅ Załadowano ${devCommands.length} deweloperskich komend na serwerze "${guild.name}".`
          );
        }
      }
      return;
    }

    if (globalCommands.length) {
      const existing = await this.client.application.commands.fetch();
      for (const cmdData of globalCommands) {
        const found = existing.find((cmd) => cmd.name === cmdData.name);
        if (!found) {
          await this.client.application.commands.create(cmdData);
          console.log(`✅ Utworzono globalnie "${cmdData.name}".`);
          continue;
        }
        if (this.commandChanged(found, cmdData)) {
          await this.client.application.commands.edit(found.id, cmdData);
          console.log(`✅ Zaktualizowano globalnie "${cmdData.name}".`);
        }
      }
    }

    if (devCommands.length && this.config.devGuildIds?.length) {
      for (const guildId of this.config.devGuildIds) {
        const guild = await this.client.guilds.fetch(guildId);
        if (!guild) {
          console.warn(`⚠️ Nie udało się pobrać gildii o ID ${guildId} do rejestracji komend dev.`);
          continue;
        }

        const existing = await guild.commands.fetch();

        for (const cmdData of devCommands) {
          const found = existing.find((cmd) => cmd.name === cmdData.name);
          if (!found) {
            await guild.commands.create(cmdData);
            console.log(`✅ Utworzono "${cmdData.name}" na serwerze "${guild.name}".`);
            continue;
          }
          if (this.commandChanged(found, cmdData)) {
            await guild.commands.edit(found.id, cmdData);
            console.log(`✅ Zaktualizowano "${cmdData.name}" na serwerze "${guild.name}".`);
          }
        }
      }
    }
  }

  public async clearCommands(): Promise<void> {
    if (!this.client.application) {
      throw new Error('Klient Discord jeszcze nie gotowy (brak client.application)');
    }

    await this.client.application.commands.set([]);
    console.log('🧹 Wyczyszczono globalne komendy');

    if (this.config.devGuildIds?.length) {
      for (const guildId of this.config.devGuildIds) {
        try {
          const guild = await this.client.guilds.fetch(guildId);
          if (guild) {
            await guild.commands.set([]);
            console.log(`🧹 Wyczyszczono komendy na serwerze "${guild.name}"`);
          }
        } catch (error) {
          console.warn(`⚠️ Nie udało się wyczyścić komend na serwerze ${guildId}:`, error);
        }
      }
    }
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
      await this.executeCommand(interaction);
    } else if (interaction.isAutocomplete()) {
      await this.handleAutocomplete(interaction);
    }
  }

  private async executeCommand(interaction: CommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    for (const validate of this.validations) {
      const errorMessage = await validate(interaction, command);
      if (errorMessage) {
        await this.respond(interaction, { content: errorMessage, flags: MessageFlags.Ephemeral });
        return;
      }
    }

    if (command.options?.devOnly && !this.isDeveloper(interaction)) {
      await this.respond(interaction, {
        content: '⛔ Ta komenda jest dostępna tylko dla deweloperów.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (command.options?.userPermissions && interaction.memberPermissions) {
      const perms = Array.isArray(command.options.userPermissions)
        ? command.options.userPermissions
        : [command.options.userPermissions];
      const missing = perms.filter((perm) => !interaction.memberPermissions?.has(perm));
      if (missing.length > 0) {
        await this.respond(interaction, {
          content: `⛔ Potrzebujesz uprawnień do wykonania tej komendy.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }
    if (command.options?.botPermissions && interaction.guild?.members.me) {
      const botPerms = interaction.guild.members.me;
      const perms = Array.isArray(command.options.botPermissions)
        ? command.options.botPermissions
        : [command.options.botPermissions];
      const missing = perms.filter((perm) => !botPerms.permissions.has(perm));
      if (missing.length > 0) {
        await this.respond(interaction, {
          content: `⛔ Bot potrzebuje uprawnień do wykonania tej komendy.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    try {
      await command.run({
        interaction: interaction as ChatInputCommandInteraction,
        client: this.client,
      });
    } catch (error) {
      logger.error(`❌ Błąd podczas wykonywania komendy "${interaction.commandName}": ${error}`);
      
      // Sprawdź czy można jeszcze odpowiedzieć
      try {
        await this.respond(interaction, {
          content: 'Wystąpił błąd podczas wykonywania komendy.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (replyError) {
        logger.error(`❌ Nie udało się wysłać komunikatu o błędzie: ${replyError}`);
      }
    }
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command?.autocomplete) return;

    try {
      await command.autocomplete({ interaction, client: this.client });
    } catch (error) {
  logger.error(`❌ Błąd autocomplete "${interaction.commandName}": ${error}`);
    }
  }

  private isDeveloper(interaction: CommandInteraction): boolean {
    const devUserIds = this.config.devUserIds || [];
    const devRoleIds = this.config.devRoleIds || [];
    const member = interaction.member as GuildMember | null;

    if (devUserIds.includes(interaction.user.id)) return true;
    if (member && devRoleIds.some((roleId) => member.roles.cache.has(roleId))) return true;

    return false;
  }

  private commandChanged(existing: ApplicationCommand, next: ApplicationCommandData): boolean {
    const existingSummary = this.summarize(existing);
    const nextSummary = this.summarize(next);
    return existingSummary !== nextSummary;
  }

  private summarize(cmd: ApplicationCommand | ApplicationCommandData): string {
    const base: any = {
      name: (cmd as any).name,
      description: (cmd as any).description || '',
      type: (cmd as any).type || 1,
    };
    const opts = (cmd as any).options || [];
    if (opts.length) {
      base.options = opts.map((o: any) => {
        const opt: any = {
          name: o.name,
          type: o.type,
          description: o.description || '',
          required: !!o.required,
        };
        if (o.choices?.length) {
          opt.choices = o.choices.map((c: any) => ({ name: c.name, value: c.value }));
        }
        return opt;
      });
    }
    return JSON.stringify(base, (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce((sorted: any, k) => {
            sorted[k] = value[k];
            return sorted;
          }, {});
      }
      return value;
    });
  }

  private async respond(interaction: CommandInteraction, payload: InteractionReplyOptions) {
    if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
    return interaction.reply(payload);
  }
}
