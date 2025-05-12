import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Message,
  ButtonInteraction,
  GuildEmoji,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { chunk } from 'lodash';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { getGuildConfig } from '../../config/guild';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

const CONFIG = {
  PAGE_SIZE: 10,
  COLLECTOR_TIMEOUT: 60_000,
};

export const data = new SlashCommandBuilder()
  .setName('emoji')
  .setDescription('Wyświetla listę emoji na serwerze.')
  .setDMPermission(false);

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Ta komenda działa tylko na serwerze.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const emojis = interaction.guild.emojis.cache.map((e: GuildEmoji) => `${e} | \`${e}\``);
    const pages = chunk(emojis, CONFIG.PAGE_SIZE);
    const totalPages = Math.max(1, pages.length);
    const totalEmojis = emojis.length;

    const createEmbed = (page: number): EmbedBuilder => {
      const slice = pages[page] || [];
      return createBaseEmbed({
        title: `Emoji`,
        description:
          slice.length > 0 ? slice.join('\n\n') : 'Ten serwer nie posiada żadnych emoji.',
        color: COLORS.DEFAULT,
        footerText: `Strona ${page + 1}/${totalPages} • Emoji: ${totalEmojis}`,
      });
    };

    if (totalPages <= 1) {
      await interaction.reply({ embeds: [createEmbed(0)] });
      return;
    }

    const {
      emojis: { next: NEXT, previous: PREVIOUS },
    } = getGuildConfig(interaction.guild.id);

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('previous')
        .setEmoji(PREVIOUS)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setEmoji(NEXT).setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [createEmbed(0)],
      components: [navRow],
    });
    const message = (await interaction.fetchReply()) as Message;

    let currentPage = 0;
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: CONFIG.COLLECTOR_TIMEOUT,
    });

    collector.on('collect', async (btn: ButtonInteraction) => {
      if (btn.customId === 'previous') {
        currentPage = (currentPage - 1 + totalPages) % totalPages;
      } else {
        currentPage = (currentPage + 1) % totalPages;
      }
      await btn.update({ embeds: [createEmbed(currentPage)] });
    });

    collector.on('end', () =>
      message.edit({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('previous')
              .setEmoji(PREVIOUS)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('next')
              .setEmoji(NEXT)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          ),
        ],
      })
    );
  } catch (error) {
    logger.error(`Błąd podczas wyświetlania emoji: ${error}`);
    await interaction.reply({
      content: 'Wystąpił błąd podczas wyświetlania emoji.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
