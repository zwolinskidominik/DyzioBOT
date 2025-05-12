import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  APIEmbedField,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import type { IEmbedField } from '../../interfaces/Embed';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Stwórz embed.')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option.setName('title').setDescription('Tytuł embeda').setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('description').setDescription('Opis embeda').setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('color')
      .setDescription('Kolor embeda w formacie HEX (#000000)')
      .setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('title2').setDescription('Tytuł drugiego pola').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('description2').setDescription('Opis drugiego pola').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('title3').setDescription('Tytuł trzeciego pola').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('description3').setDescription('Opis trzeciego pola').setRequired(false)
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply();

    if (!interaction.guild) {
      await interaction.editReply({ content: 'Ta komenda może być użyta tylko na serwerze.' });
      return;
    }

    const embed = buildEmbed(interaction);
    if (!embed) {
      await interaction.editReply({ content: 'Nie udało się utworzyć embeda.' });
      return;
    }

    const embedFields = getEmbedFields(interaction);
    if (embedFields.length > 0) {
      embed.addFields(...embedFields);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd podczas tworzenia embeda: ${error}`);
    await interaction.editReply({ content: 'Wystąpił błąd podczas tworzenia embeda.' });
  }
}

function getEmbedFields(interaction: ChatInputCommandInteraction): APIEmbedField[] {
  const fields: IEmbedField[] = [
    {
      title: interaction.options.getString('title2'),
      description: interaction.options.getString('description2'),
    },
    {
      title: interaction.options.getString('title3'),
      description: interaction.options.getString('description3'),
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

  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const color = interaction.options.getString('color') || COLORS.EMBED;

  return createBaseEmbed({
    title: title || undefined,
    description: description || undefined,
    color,
    footerText: interaction.guild.name,
    footerIcon: interaction.guild.iconURL() ?? undefined,
  });
}
