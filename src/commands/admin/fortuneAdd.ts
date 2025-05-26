import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { FortuneModel, FortuneDocument } from '../../models/Fortune';
import type { IFortune } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('wrozba-dodaj')
  .setDescription('Dodaj nową wróżbę do bazy danych')
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
  .setDMPermission(false)
  .addStringOption((option) =>
    option.setName('tekst').setDescription('Tekst wróżby').setRequired(true)
  );

export const options = {
  userPermissions: [PermissionFlagsBits.MuteMembers],
  botPermissions: [PermissionFlagsBits.MuteMembers],
  deleted: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const fortuneText = interaction.options.getString('tekst', true);
    if (!fortuneText) {
      await interaction.editReply({ content: 'Nie podano tekstu wróżby.' });
      return;
    }

    const newEntry = await createFortuneEntry(fortuneText, interaction.user.id);

    const raw: IFortune = {
      content: newEntry.content,
      addedBy: newEntry.addedBy,
    };

    const embed = createSuccessEmbed(raw.content);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd podczas dodawania wróżby: ${error}`);
    await interaction.editReply({ content: 'Wystąpił błąd podczas dodawania wróżby.' });
  }
}

async function createFortuneEntry(content: string, userId: string): Promise<FortuneDocument> {
  const entry = await FortuneModel.create({ content, addedBy: userId });
  return entry;
}

function createSuccessEmbed(fortuneText: string): EmbedBuilder {
  return createBaseEmbed({
    title: '✨ Nowa wróżba dodana!',
    description: 'Pomyślnie dodano nową wróżbę do bazy danych.',
    color: COLORS.FORTUNE_ADD,
  }).addFields({ name: 'Treść', value: fortuneText });
}
