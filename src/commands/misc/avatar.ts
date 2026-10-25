import { SlashCommandBuilder, User, Guild, GuildMember } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

type AvatarSize = 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096;

export const data = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription('Wyświetl avatar użytkownika w pełnym rozmiarze')
  .addUserOption((option) =>
    option
      .setName('uzytkownik')
      .setDescription('Użytkownik, którego avatar chcesz zobaczyć.')
      .setRequired(false)
  );

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  await interaction.deferReply();

  try {
    const targetUser: User = interaction.options.getUser('uzytkownik') || interaction.user;
    const guild: Guild = interaction.guild!;
    const globalAvatarURL: string = getUserAvatarURL(targetUser);
    // Avatar ustawiony na TYM serwerze (np. bot z profilem per-serwer z dashboardu, albo
    // użytkownik z avatarem serwerowym Nitro) ma pierwszeństwo - tak jak pokazuje go Discord.
    // force: true, bo cache członka (zwłaszcza samego bota) może trzymać stary avatar.
    const member = await fetchMember(guild, targetUser.id);
    const serverAvatarURL = member?.avatar ? getMemberAvatarURL(member) : null;
    const embed = createAvatarEmbed(targetUser, serverAvatarURL ?? globalAvatarURL, guild, serverAvatarURL ? globalAvatarURL : null);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd podczas wyświetlania avataru: ${error}`);
    await interaction.editReply({
      embeds: [createErrorEmbed('Wystąpił błąd podczas próby wyświetlenia avataru użytkownika.')],
    });
  }
}

async function fetchMember(guild: Guild | null, userId: string): Promise<GuildMember | null> {
  if (!guild?.members?.fetch) return null;
  return guild.members.fetch({ user: userId, force: true }).catch(() => null);
}

function getMemberAvatarURL(member: GuildMember): string {
  return member.displayAvatarURL({ extension: 'png' as const, size: 1024 as AvatarSize });
}

function getUserAvatarURL(user: User): string {
  return user.displayAvatarURL({
    extension: 'png' as const,
    size: 1024 as AvatarSize,
  });
}

function createAvatarEmbed(user: User, avatarURL: string, guild: Guild, globalAvatarURL: string | null) {
  return createBaseEmbed({
    footerText: guild.name,
    footerIcon: `${guild.iconURL()}`,
    title: `Avatar użytkownika ${user.tag}`,
    ...(globalAvatarURL
      ? { description: `Avatar ustawiony na tym serwerze · [avatar globalny](${globalAvatarURL})` }
      : {}),
    image: avatarURL,
  });
}
