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
import { OWNER_IDS } from '../config/constants/owner';

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
          .then(() => logger.info('✅ Wyczyszczono wszystkie komendy.'))
          .catch((err) => logger.error(`❌ Błąd czyszczenia komend: ${err}`));
      }

      await this.registerCommands()
        .then(() => logger.info('✅ Zarejestrowano komendy aplikacji.'))
        .catch((err) => logger.error(`❌ Błąd rejestracji komend: ${err}`));
    });
  }

  private loadCommands(dir: string, category?: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        // Kategoria = nazwa najbliższego folderu nadrzędnego (np. "fun", "misc", "birthdays").
        // Zagnieżdżone podfoldery dostają WŁASNĄ kategorię, a nie kategorię rodzica — dzięki temu
        // np. misc/birthdays/* nie trafia do kategorii "misc" (mają już osobny moduł Urodziny).
        this.loadCommands(fullPath, entry);
        continue;
      }

      if (!entry.endsWith('.ts') && !entry.endsWith('.js')) continue;

      const commandModule = require(fullPath);

      if (!commandModule.data || !commandModule.run) {
        logger.warn(`❕ Pominięto ${entry} (brak eksportu 'data' lub 'run')`);
        continue;
      }

      const command: ICommand = {
        data: commandModule.data,
        run: commandModule.run,
        options: commandModule.options || {},
        category,
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
    // guildId -> komendy, które mają być zarejestrowane WYŁĄCZNIE na tym serwerze
    // (dev-only na devGuildIds ORAZ restrictedGuildIds z pojedynczych komend — scalone,
    // bo jeden serwer może dostać komendy z obu źródeł naraz).
    const guildCommands = new Map<string, ApplicationCommandData[]>();

    const addToGuild = (guildId: string, json: ApplicationCommandData) => {
      const list = guildCommands.get(guildId) ?? [];
      list.push(json);
      guildCommands.set(guildId, list);
    };

    for (const command of this.commands.values()) {
      if (command.options?.deleted) {
        logger.info(`⏩ Pominięto komendę "${command.data.name}" - oznaczona jako usunięta.`);
        continue;
      }

      const json = command.data.toJSON() as unknown as ApplicationCommandData;

      if (command.options?.devOnly) {
        for (const guildId of this.config.devGuildIds ?? []) addToGuild(guildId, json);
        continue;
      }

      if (command.options?.restrictedGuildIds?.length) {
        for (const guildId of command.options.restrictedGuildIds) addToGuild(guildId, json);
        continue;
      }

      globalCommands.push(json);
    }

    if (this.config.bulkRegister) {
      if (globalCommands.length) {
        await this.client.application.commands.set(globalCommands);
        logger.info(`✅ Załadowano globalnie ${globalCommands.length} komend.`);
      }

      for (const [guildId, cmds] of guildCommands) {
        const guild = await this.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
          logger.warn(`⚠️ Nie udało się pobrać gildii o ID ${guildId} do rejestracji komend guild-scoped.`);
          continue;
        }
        await guild.commands.set(cmds);
        logger.info(`✅ Załadowano ${cmds.length} komend guild-scoped na serwerze "${guild.name}".`);
      }
      return;
    }

    if (globalCommands.length) {
      const existing = await this.client.application.commands.fetch();
      for (const cmdData of globalCommands) {
        const found = existing.find((cmd) => cmd.name === cmdData.name);
        if (!found) {
          await this.client.application.commands.create(cmdData);
          logger.info(`✅ Utworzono globalnie "${cmdData.name}".`);
          continue;
        }
        if (this.commandChanged(found, cmdData)) {
          await this.client.application.commands.edit(found.id, cmdData);
          logger.info(`✅ Zaktualizowano globalnie "${cmdData.name}".`);
        }
      }
    }

    for (const [guildId, cmds] of guildCommands) {
      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.warn(`⚠️ Nie udało się pobrać gildii o ID ${guildId} do rejestracji komend guild-scoped.`);
        continue;
      }

      const existing = await guild.commands.fetch();

      for (const cmdData of cmds) {
        const found = existing.find((cmd) => cmd.name === cmdData.name);
        if (!found) {
          await guild.commands.create(cmdData);
          logger.info(`✅ Utworzono "${cmdData.name}" na serwerze "${guild.name}".`);
          continue;
        }
        if (this.commandChanged(found, cmdData)) {
          await guild.commands.edit(found.id, cmdData);
          logger.info(`✅ Zaktualizowano "${cmdData.name}" na serwerze "${guild.name}".`);
        }
      }
    }
  }

  public async clearCommands(): Promise<void> {
    if (!this.client.application) {
      throw new Error('Klient Discord jeszcze nie gotowy (brak client.application)');
    }

    await this.client.application.commands.set([]);
    logger.info('🧹 Wyczyszczono globalne komendy');

    const restrictedGuildIds = [...this.commands.values()].flatMap(
      (cmd) => cmd.options?.restrictedGuildIds ?? []
    );
    const guildIds = new Set([...(this.config.devGuildIds ?? []), ...restrictedGuildIds]);

    for (const guildId of guildIds) {
      try {
        const guild = await this.client.guilds.fetch(guildId);
        if (guild) {
          await guild.commands.set([]);
          logger.info(`🧹 Wyczyszczono komendy na serwerze "${guild.name}"`);
        }
      } catch (error) {
        logger.warn(`⚠️ Nie udało się wyczyścić komend na serwerze ${guildId}: ${error}`);
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

    if (command.options?.guildOnly && !interaction.guild) {
      await this.respond(interaction, {
        content: 'Ta komenda działa tylko na serwerze.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (command.options?.devOnly && !this.isDeveloper(interaction)) {
      await this.respond(interaction, {
        content: '⛔ Ta komenda jest dostępna tylko dla deweloperów.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (command.options?.ownerOnly && !OWNER_IDS.includes(interaction.user.id as (typeof OWNER_IDS)[number])) {
      await this.respond(interaction, {
        content: '⛔ Ta komenda jest dostępna tylko dla właściciela bota.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (
      command.options?.restrictedGuildIds?.length &&
      (!interaction.guildId || !command.options.restrictedGuildIds.includes(interaction.guildId))
    ) {
      await this.respond(interaction, {
        content: '⛔ Ta komenda jest dostępna tylko na wybranych serwerach.',
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

  /**
   * Strip Unicode Variation Selector-16 (U+FE0F) that Discord may silently
   * remove from stored command descriptions, causing phantom "changed" diffs.
   */
  private static stripVS16(text: string): string {
    return text.replace(/\uFE0F/g, '');
  }

  private summarizeOption(o: Record<string, unknown>): Record<string, unknown> {
    const opt: Record<string, unknown> = {
      name: o.name,
      type: o.type,
      description: CommandHandler.stripVS16((o.description as string) || ''),
      required: !!o.required,
    };

    const choices = o.choices as Array<Record<string, unknown>> | undefined;
    if (choices?.length) {
      opt.choices = choices.map((c: Record<string, unknown>) => ({
        name: c.name,
        value: c.value,
      }));
    }

    /* Recurse into sub-options (subcommands / subcommand-groups) */
    const subOpts = (o.options as Array<Record<string, unknown>>) || [];
    if (subOpts.length) {
      opt.options = subOpts.map((sub) => this.summarizeOption(sub));
    }

    return opt;
  }

  private summarize(cmd: ApplicationCommand | ApplicationCommandData): string {
    const raw = cmd as unknown as Record<string, unknown>;
    const base: Record<string, unknown> = {
      name: raw.name,
      description: CommandHandler.stripVS16((raw.description as string) || ''),
      type: (raw.type as number) || 1,
    };
    const opts = (raw.options as Array<Record<string, unknown>>) || [];
    if (opts.length) {
      base.options = opts.map((o) => this.summarizeOption(o));
    }
    return JSON.stringify(base, (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce((sorted: Record<string, unknown>, k) => {
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
