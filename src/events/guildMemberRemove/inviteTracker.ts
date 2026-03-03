import { GuildMember, Client, TextChannel, EmbedBuilder } from 'discord.js';
import { getConfig, recordLeave, getInviterStats } from '../../services/inviteTrackerService';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

/**
 * Records when a member leaves and optionally sends a log message.
 */
export default async function run(member: GuildMember, _client: Client): Promise<void> {
  try {
    const { guild } = member;
    if (!guild) return;

    const configResult = await getConfig(guild.id);
    if (!configResult.ok || !configResult.data.enabled) return;

    const config = configResult.data;

    // Record the leave
    const leaveResult = await recordLeave(guild.id, member.id);
    if (!leaveResult.ok) return;

    const inviterId = leaveResult.data.inviterId;

    // Send log message if channel configured
    if (!config.logChannelId) return;

    const logChannel = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (!logChannel) return;

    // Get inviter stats
    let statsText = '';
    let activeCount = 0;
    if (inviterId) {
      const statsResult = await getInviterStats(guild.id, inviterId);
      if (statsResult.ok) {
        const s = statsResult.data;
        activeCount = s.active;
        statsText = `**${s.active}** aktywnych, **${s.left}** opuściło, **${s.fake}** fałszywych`;
      }
    }

    let message = config.leaveMessage || '';
    if (message) {
      message = replaceVariables(message, member, inviterId, statsText, activeCount);
      await logChannel.send(message);
    } else {
      // Default embed
      const embed = new EmbedBuilder()
        .setColor(COLORS.LEAVE)
        .setAuthor({
          name: member.user.tag,
          iconURL: member.user.displayAvatarURL({ size: 64 }),
        })
        .setDescription(
          `📤 <@${member.id}> opuścił/a serwer.\n` +
          (inviterId
            ? `📨 Był/a zaproszony/a przez: <@${inviterId}>\n`
            : '📨 Zapraszający: *nieznany*\n') +
          (statsText ? `📊 Statystyki zapraszającego: ${statsText}` : ''),
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error(`[InviteTracker] Błąd w guildMemberRemove: ${error}`);
  }
}

function replaceVariables(
  template: string,
  member: GuildMember,
  inviterId: string | null,
  statsText: string,
  activeCount: number,
): string {
  return template
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{username}/g, member.user.username)
    .replace(/{tag}/g, member.user.tag)
    .replace(/{server}/g, member.guild.name)
    .replace(/{memberCount}/g, `${member.guild.memberCount}`)
    .replace(/{inviter}/g, inviterId ? `<@${inviterId}>` : '*nieznany*')
    .replace(/{activeCount}/g, `${activeCount}`)
    .replace(/{stats}/g, statsText || '*brak danych*');
}
