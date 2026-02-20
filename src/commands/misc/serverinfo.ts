import { SlashCommandBuilder, Guild, GuildMember, EmbedBuilder } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

const VERIFICATION_LEVELS = ['Żaden', 'Niski', 'Średni', 'Wysoki', 'Bardzo wysoki'];

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Wyświetla informacje o serwerze.')
  .setDMPermission(false);

export const options = {
  guildOnly: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  await interaction.deferReply();

  try {
    const guild = interaction.guild!;
    const member = interaction.member as GuildMember;

    const embed = createServerInfoEmbed(guild, member);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd podczas wyświetlania informacji o serwerze: ${error}`);
    await interaction.editReply({
      embeds: [createErrorEmbed('Wystąpił błąd podczas wyświetlania informacji o serwerze.')],
    });
  }
}

function formatTimestamp(timestamp: number): string {
  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

function getVerificationLevelText(level: number): string {
  return VERIFICATION_LEVELS[level] || 'Nieznany';
}

function createServerInfoEmbed(guild: Guild, member: GuildMember): EmbedBuilder {
  const {
    name,
    ownerId,
    memberCount,
    roles,
    emojis,
    id,
    createdTimestamp,
    premiumSubscriptionCount,
    verificationLevel,
  } = guild;

  const icon = guild.iconURL();
  const joinedAt = member.joinedAt;

  if (!joinedAt) {
    throw new Error('Nie udało się pobrać daty dołączenia.');
  }

  const verificationLevelText = getVerificationLevelText(verificationLevel);

  return createBaseEmbed({
    footerText: `Server ID: ${id}`,
    footerIcon: icon || undefined,
    thumbnail: icon || undefined,
  }).addFields(
    { name: 'Nazwa', value: name, inline: false },
    { name: 'Właściciel', value: `<@!${ownerId}>`, inline: true },
    { name: 'Data utworzenia', value: formatTimestamp(createdTimestamp), inline: true },
    { name: 'Dołączono', value: formatTimestamp(joinedAt.getTime()), inline: true },
    { name: 'Członkowie', value: `${memberCount}`, inline: true },
    { name: 'Role', value: `${roles.cache.size}`, inline: true },
    { name: 'Emoji', value: `${emojis.cache.size}`, inline: true },
    { name: 'Stopień weryfikacji', value: verificationLevelText, inline: true },
    { name: 'Boosty', value: `${premiumSubscriptionCount || 0}`, inline: true }
  );
}
