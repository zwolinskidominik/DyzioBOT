import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalSubmitInteraction,
  type Attachment,
  TextChannel,
  MessageFlags,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';
import { sayMessages } from '../../i18n/messages/say';
import { getGuildLanguage } from '../../i18n/guildLanguage';

const CUSTOM_IDS = {
  MESSAGE: 'sayMessage',
  EMBED_MODE: 'embedMode',
};
const MODAL_TIMEOUT = 300_000;

/** Obrazek do ogłoszenia: tylko popularne formaty i rozmiar sprawdzony PRZED wysłaniem. */
export const IMAGE_MAX_MB = 8;
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** Bezpieczna nazwa pliku (bez nazwy od użytkownika) albo null, gdy plik nie jest dozwolonym obrazkiem. */
export function imageFileName(image: Pick<Attachment, 'contentType' | 'size'>): string | null {
  const type = image.contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  const ext = IMAGE_TYPES[type];
  if (!ext || image.size > IMAGE_MAX_MB * 1024 * 1024) return null;
  return `deezy-image.${ext}`;
}

export const data = new SlashCommandBuilder()
  .setName('say')
  .setDescription('Send a message in this channel as Deezy').setDescriptionLocalizations({ pl: 'Wyślij wiadomość na wybranym kanale jako Deezy' })
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addAttachmentOption((o) =>
    o
      .setName('image')
      .setDescription('Image to attach to the message (optional)')
      .setDescriptionLocalizations({ pl: 'Obrazek dołączony do wiadomości (opcjonalnie)' })
      .setRequired(false)
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Ta komenda może być używana tylko na kanale tekstowym.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const lang = await getGuildLanguage(interaction.guildId);
  const image = interaction.options.getAttachment('image');
  const imageName = image ? imageFileName(image) : null;
  if (image && !imageName) {
    await interaction.reply({
      embeds: [createErrorEmbed(sayMessages[lang].imageInvalid(IMAGE_MAX_MB))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const modal = createSayModal();

  await interaction.showModal(modal);

  try {
    const response = await interaction.awaitModalSubmit({ time: MODAL_TIMEOUT });
    await handleModalSubmit(response, channel, image && imageName ? { url: image.url, name: imageName } : null, sayMessages[lang].sent);
  } catch (error) {
    logger.error(`Błąd podczas wysyłania wiadomości w /say: ${error}`);
    await interaction.followUp({
      embeds: [createErrorEmbed('Nie udało się wysłać wiadomości. Spróbuj ponownie.')],
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
  channel: TextChannel,
  image: { url: string; name: string } | null,
  sentText: string
): Promise<void> {
  const messageContent = response.fields.getTextInputValue(CUSTOM_IDS.MESSAGE);
  const embedMode = response.fields.getTextInputValue(CUSTOM_IDS.EMBED_MODE);

  // Tekst wpisany przez admina nie może pingować: „@everyone”, <@&rola> czy <@user> w treści
  // (np. w changelogu) mają się wyświetlić, a nie wysłać powiadomienie do całego serwera.
  const allowedMentions = { parse: [] };
  const files = image ? [{ attachment: image.url, name: image.name }] : [];
  if (embedMode && embedMode.toLowerCase() === 'on') {
    const embed = createBaseEmbed({ description: messageContent });
    // Obrazek wewnątrz embeda (pod tekstem) zamiast osobnego załącznika nad nim.
    if (image) embed.setImage(`attachment://${image.name}`);
    await channel.send({ embeds: [embed], files, allowedMentions });
  } else {
    await channel.send({ content: messageContent, files, allowedMentions });
  }

  await response.reply({
    content: sentText,
    flags: MessageFlags.Ephemeral,
  });
}
