import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createErrorEmbed } from '../../utils/embedHelpers';
import { collectWrappedData, renderWrappedCanvas, resolveWrappedTheme } from '../../services/serverWrappedService';
import { WrappedConfigModel } from '../../models/WrappedConfig';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('wrapped-test')
  .setDescription('Wygeneruj testowy Server Wrapped')
  .addBooleanOption((option) =>
    option
      .setName('publicznie')
      .setDescription('Wyślij na skonfigurowany kanał Wrapped zamiast tylko podglądu dla Ciebie (domyślnie: nie)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
  cooldown: 30,
  guildOnly: true,
  ownerOnly: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  if (!interaction.guild) return;

  const guild = interaction.guild;
  const postPublicly = interaction.options.getBoolean('publicznie') ?? false;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const wrappedConfigForTheme = await WrappedConfigModel.findOne({ guildId: guild.id }).lean();
    const wrappedData = await collectWrappedData(guild);
    const imageBuffer = await renderWrappedCanvas(wrappedData, resolveWrappedTheme(wrappedConfigForTheme?.colorTheme));
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'server-wrapped-test.png' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wrapped:personal')
        .setLabel('🎁 TWOJE WRAPPED!')
        .setStyle(ButtonStyle.Primary)
    );

    if (!postPublicly) {
      await interaction.editReply({
        content: '🧪 Podgląd testowy Server Wrapped (widoczny tylko dla Ciebie):',
        files: [attachment],
        components: [row],
      });
      logger.info(`[WRAPPED-TEST] Podgląd wygenerowany przez ${interaction.user.id} w guild=${guild.id}.`);
      return;
    }

    const wrappedConfig = await WrappedConfigModel.findOne({ guildId: guild.id }).lean();
    if (!wrappedConfig?.channelId) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Skonfiguruj najpierw kanał Wrapped w dashboardzie (moduł Server Wrapped), zanim wyślesz publicznie.'
          ),
        ],
      });
      return;
    }

    const channel = guild.channels.cache.get(wrappedConfig.channelId) as TextChannel | undefined;
    if (!channel?.send) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Skonfigurowany kanał Wrapped nie istnieje lub bot nie ma do niego dostępu.')],
      });
      return;
    }

    await channel.send({
      content: `# 🧪 [TEST] Server Wrapped — **${guild.name}**\nTo jest testowa wysyłka wywołana przez ${interaction.user}. Prawdziwy Wrapped wyśle się automatycznie 11 listopada.`,
      files: [attachment],
      components: [row],
    });

    await interaction.editReply({ content: `✅ Testowy Server Wrapped wysłany na ${channel}.` });
    logger.info(`[WRAPPED-TEST] Publiczny test wysłany przez ${interaction.user.id} na #${channel.name} (guild=${guild.id}).`);
  } catch (error) {
    logger.error(`[WRAPPED-TEST] Błąd wykonania komendy w guild=${guild.id}: ${error}`);
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie udało się wygenerować testowego Server Wrapped. Spróbuj ponownie.')],
    });
  }
}
