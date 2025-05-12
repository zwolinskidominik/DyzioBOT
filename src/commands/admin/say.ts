import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalSubmitInteraction,
  TextChannel,
  MessageFlags,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

const CUSTOM_IDS = {
  MESSAGE: 'sayMessage',
  EMBED_MODE: 'embedMode',
};
const MODAL_TIMEOUT = 300_000;

export const data = new SlashCommandBuilder()
  .setName('say')
  .setDescription('Napisz coś za pomocą bota.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({
      content: 'Ta komenda może być używana tylko na kanale tekstowym.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const modal = createSayModal();

  await interaction.showModal(modal);

  try {
    const response = await interaction.awaitModalSubmit({ time: MODAL_TIMEOUT });
    await handleModalSubmit(response, channel);
  } catch (error) {
    logger.error(`Błąd podczas wysyłania wiadomości w /say: ${error}`);
    await interaction.followUp({
      content: 'Nie udało się wysłać wiadomości. Spróbuj ponownie.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

function createSayModal(): ModalBuilder {
  const messageInput = new TextInputBuilder()
    .setCustomId(CUSTOM_IDS.MESSAGE)
    .setLabel('Napisz coś')
    .setPlaceholder('Wpisz cokolwiek...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const embedModeInput = new TextInputBuilder()
    .setCustomId(CUSTOM_IDS.EMBED_MODE)
    .setLabel('Tryb embed: (on/off)')
    .setPlaceholder('on/off')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const messageRow = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
  const embedRow = new ActionRowBuilder<TextInputBuilder>().addComponents(embedModeInput);

  return new ModalBuilder()
    .setCustomId('sayModal')
    .setTitle('Napisz coś poprzez bota')
    .addComponents(messageRow, embedRow);
}

async function handleModalSubmit(
  response: ModalSubmitInteraction,
  channel: TextChannel
): Promise<void> {
  const messageContent = response.fields.getTextInputValue(CUSTOM_IDS.MESSAGE);
  const embedMode = response.fields.getTextInputValue(CUSTOM_IDS.EMBED_MODE);

  if (embedMode && embedMode.toLowerCase() === 'on') {
    const embed = createBaseEmbed({ description: messageContent });
    await channel.send({ embeds: [embed] });
  } else {
    await channel.send(messageContent);
  }

  await response.reply({
    content: 'Twoja wiadomość została wysłana',
    flags: MessageFlags.Ephemeral,
  });
}
