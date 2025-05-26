import { SlashCommandBuilder, User, MessageFlags, Guild } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

type AvatarSize = 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096;

export const data = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription('Wyświetla avatar użytkownika w większym formacie.')
  .addUserOption((option) =>
    option
      .setName('uzytkownik')
      .setDescription('Użytkownik, którego avatar chcesz zobaczyć.')
      .setRequired(false)
  );

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    const targetUser: User = interaction.options.getUser('uzytkownik') || interaction.user;
    const avatarURL: string = getUserAvatarURL(targetUser);
    const guild: Guild = interaction.guild!;
    const embed = createAvatarEmbed(targetUser, avatarURL, guild);
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd podczas wyświetlania avataru: ${error}`);
    await interaction.reply({
      content: 'Wystąpił błąd podczas próby wyświetlenia avataru użytkownika.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

function getUserAvatarURL(user: User): string {
  return user.displayAvatarURL({
    extension: 'png' as const,
    size: 1024 as AvatarSize,
  });
}

function createAvatarEmbed(user: User, avatarURL: string, guild: Guild) {
  return createBaseEmbed({
    footerText: guild.name,
    footerIcon: `${guild.iconURL()}`,
    title: `Avatar użytkownika ${user.tag}`,
    image: avatarURL,
  });
}
