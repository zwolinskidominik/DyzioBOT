import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  APIEmbedField,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import type { IEmbedField } from '../../interfaces/Embed';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Stwórz embed.')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option.setName('tytul').setDescription('Tytuł embeda').setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('opis').setDescription('Opis embeda').setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('kolor')
      .setDescription('Kolor embeda w formacie HEX (#000000)')
      .setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('tytul2').setDescription('Tytuł drugiego pola').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('opis2').setDescription('Opis drugiego pola').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('tytul3').setDescription('Tytuł trzeciego pola').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('opis3').setDescription('Opis trzeciego pola').setRequired(false)
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
  guildOnly: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply();

    const embed = buildEmbed(interaction);
    if (!embed) {
      await interaction.editReply({ embeds: [createErrorEmbed('Nie udało się utworzyć embeda.')] });
      return;
    }

    const embedFields = getEmbedFields(interaction);
    if (embedFields.length > 0) {
      embed.addFields(...embedFields);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd podczas tworzenia embeda: ${error}`);
    await interaction.editReply({ embeds: [createErrorEmbed('Wystąpił błąd podczas tworzenia embeda.')] });
  }
}

function getEmbedFields(interaction: ChatInputCommandInteraction): APIEmbedField[] {
  const fields: IEmbedField[] = [
    {
      title: interaction.options.getString('tytul2'),
      description: interaction.options.getString('opis2'),
    },
    {
      title: interaction.options.getString('tytul3'),
      description: interaction.options.getString('opis3'),
    },
  ];

  const validFields = fields.filter(
    (field): field is Required<IEmbedField> =>
      typeof field.title === 'string' && typeof field.description === 'string'
  );

  return validFields.map((field) => ({
    name: field.title!,
    value: field.description!,
    inline: true,
  }));
}

function buildEmbed(interaction: ChatInputCommandInteraction): EmbedBuilder | null {
  if (!interaction.guild) return null;

  const title = interaction.options.getString('tytul');
  const description = interaction.options.getString('opis');
  const color = interaction.options.getString('kolor') || COLORS.EMBED;

  return createBaseEmbed({
    title: title || undefined,
    description: description || undefined,
    color,
    footerText: interaction.guild.name,
    footerIcon: interaction.guild.iconURL() ?? undefined,
  });
}
