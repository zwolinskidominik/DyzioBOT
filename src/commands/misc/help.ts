import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { COLORS } from '../../config/constants/colors';
import { OWNER_GUILD_IDS } from '../../config/constants/owner';
import { getMinecraftConfig } from '../../config/minecraft';
import { CONTACT_EMAIL, PRIVACY_URL, SITE_URL, STATUS_URL, SUPPORT_SERVER_URL, TERMS_URL } from '../../config/constants/links';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { getBotConfig } from '../../config/bot';
import logger from '../../utils/logger';
import { helpMessages } from '../../i18n/messages/help';
import { getGuildLanguage } from '../../i18n/guildLanguage';

const COLLECTION_TIMEOUT = 120_000;

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('See the available commands and how to use them').setDescriptionLocalizations({ pl: 'Sprawdź dostępne komendy i dowiedz się, jak ich używać' });

export const options = {};

type HelpCommand = keyof (typeof helpMessages)['pl']['descriptions'];

interface CommandInfo {
  name: HelpCommand;
  /** Sposób użycia; `u` = zapis wzmianki użytkownika w języku serwera. Nazwy opcji są angielskie. */
  usage: (u: string) => string;
  /** Komenda dostępna tylko na serwerach właściciela - nie pokazuj jej nigdzie indziej. */
  ownerGuildsOnly?: boolean;
}

const ALL_COMMANDS: CommandInfo[] = [
  { name: 'avatar', usage: (u) => `/avatar [${u}]` },
  { name: 'birthday', usage: (u) => `/birthday [${u}]` },
  { name: 'birthday-remember', usage: () => '/birthday-remember <date>' },
  { name: 'birthdays-next', usage: () => '/birthdays-next' },
  { name: 'cat', usage: () => '/cat' },
  { name: 'dog', usage: () => '/dog' },
  { name: 'emoji', usage: () => '/emoji' },
  { name: 'faceit', usage: () => '/faceit <nick>' },
  { name: 'level', usage: (u) => `/level [${u}]` },
  { name: 'meme', usage: () => '/meme', ownerGuildsOnly: true },
  { name: 'ping', usage: () => '/ping' },
  { name: 'roll', usage: () => '/roll [sides]' },
  { name: 'serverinfo', usage: () => '/serverinfo' },
  { name: 'toplvl', usage: () => '/toplvl [page]' },
  { name: 'warnings', usage: (u) => `/warnings [${u}]` },
];

const MINECRAFT_HELP: CommandInfo = { name: 'minecraft', usage: () => '/minecraft' };

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const t = helpMessages[await getGuildLanguage(interaction.guildId)];
  try {
    const isOwnerGuild = (OWNER_GUILD_IDS as readonly string[]).includes(interaction.guildId ?? '');
    // /minecraft istnieje tylko na serwerze GameZone (MC_GUILD_ID).
    const isMinecraftGuild = getMinecraftConfig()?.guildId === interaction.guildId;
    const commands = [
      ...ALL_COMMANDS.filter((cmd) => !cmd.ownerGuildsOnly || isOwnerGuild),
      ...(isMinecraftGuild ? [MINECRAFT_HELP] : []),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const totalPages = Math.ceil(commands.length / 5);
    let currentPage = 0;

    const botConfig = getBotConfig(interaction.client.application!.id);
    const { next: NEXT, previous: PREVIOUS } = botConfig.emojis;

    const createEmbed = (page: number): EmbedBuilder => {
      const start = page * 5;
      const end = start + 5;
      const pageCommands = commands.slice(start, end);

      const embed = createBaseEmbed({
        title: t.title,
        description: t.legend,
        color: COLORS.DEFAULT,
        footerText: t.footer(page + 1, totalPages),
      });

      pageCommands.forEach((cmd) => {
        const fieldValue = `${t.descriptions[cmd.name]}\n↪ ${t.usage}: \`${cmd.usage(t.userPlaceholder)}\``;
        embed.addFields({ name: `**/${cmd.name}**`, value: fieldValue, inline: false });
      });

      embed.addFields({
        name: t.contactTitle,
        value: t.contact(SUPPORT_SERVER_URL, CONTACT_EMAIL),
        inline: false,
      });

      return embed;
    };

    // Linki do panelu, regulaminu i polityki prywatności (wymóg Discord Developer Terms §5a:
    // polityka prywatności musi być łatwo dostępna z poziomu aplikacji). Przyciski-linki nie
    // wysyłają interakcji, więc nie trzeba ich wyłączać po upływie czasu kolektora.
    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel(t.buttons.panel).setStyle(ButtonStyle.Link).setURL(SITE_URL),
      new ButtonBuilder().setLabel(t.buttons.support).setStyle(ButtonStyle.Link).setURL(SUPPORT_SERVER_URL),
      new ButtonBuilder().setLabel(t.buttons.terms).setStyle(ButtonStyle.Link).setURL(TERMS_URL),
      new ButtonBuilder().setLabel(t.buttons.privacy).setStyle(ButtonStyle.Link).setURL(PRIVACY_URL),
      new ButtonBuilder().setLabel(t.buttons.status).setStyle(ButtonStyle.Link).setURL(STATUS_URL)
    );

    const createButtons = (disabled = false) => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('help_previous')
          .setEmoji(PREVIOUS)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId('help_next')
          .setEmoji(NEXT)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      );
    };

    await interaction.reply({
      embeds: [createEmbed(0)],
      components: [createButtons(), linkRow],
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: COLLECTION_TIMEOUT,
    });

    collector.on('collect', async (i: ButtonInteraction) => {
      if (i.customId === 'help_previous') {
        currentPage = (currentPage - 1 + totalPages) % totalPages;
      } else if (i.customId === 'help_next') {
        currentPage = (currentPage + 1) % totalPages;
      }

      await i.update({
        embeds: [createEmbed(currentPage)],
        components: [createButtons(), linkRow],
      });
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [createButtons(true), linkRow] });
      } catch {
        
      }
    });
  } catch (error) {
    logger.error(`[help] Błąd wykonania komendy: ${error}`);
    const errorEmbed = createErrorEmbed(t.error);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
    }
  }
}
