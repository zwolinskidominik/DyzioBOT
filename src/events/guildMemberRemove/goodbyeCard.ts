import { GuildMember, EmbedBuilder } from 'discord.js';
import { GreetingsConfigurationModel } from '../../models/GreetingsConfiguration';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export default async function run(member: GuildMember): Promise<void> {
  try {
    const guild = member.guild;
    if (!guild) return;

    const config = await GreetingsConfigurationModel.findOne({ guildId: guild.id });
    if (!config?.greetingsChannelId || !config.goodbyeEnabled) return;
    
    const channel = guild.channels.cache.get(config.greetingsChannelId);
    if (!channel || !('send' in channel)) return;

    const botMember = guild.members.cache.get(guild.client.user.id);
    if (!botMember) return;

    const permissions = channel.permissionsFor(botMember);
    if (!permissions || !permissions.has(['SendMessages', 'EmbedLinks'])) {
      logger.debug(`Bot nie ma uprawnień do wysyłania wiadomości w kanale ${channel.id}`);
      return;
    }

    const avatar = member.user.displayAvatarURL({ size: 128 });

    const embed = new EmbedBuilder()
      .setColor(COLORS.LEAVE)
      .setAuthor({ name: `${member.user.tag} opuścił/a serwer. `, iconURL: avatar })
      .setDescription(
        `Dziękujemy za wspólnie spędzony czas. Do zobaczenia! 👋`
      );

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd w goodbyeCard.ts przy userId=${member?.user?.id}: ${error}`);
  }
}
