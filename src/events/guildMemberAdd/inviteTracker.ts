import { GuildMember, Client, TextChannel, EmbedBuilder } from 'discord.js';
import { detectUsedInvite } from '../../cache/inviteCache';
import { getConfig, recordJoin, getInviterStats } from '../../services/inviteTrackerService';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

/**
 * Detects which invite was used when a member joins and records it.
 * Optionally sends a log message to the configured channel.
 */
export default async function run(member: GuildMember, _client: Client): Promise<void> {
  try {
    const { guild } = member;
    if (!guild) return;

    const configResult = await getConfig(guild.id);
    if (!configResult.ok || !configResult.data.enabled) return;

    const config = configResult.data;

    // Detect which invite was used
    let inviterId: string | null = null;
    let inviteCode: string | null = null;

    try {
      const invites = await guild.invites.fetch();
      const detected = await detectUsedInvite(guild.id, invites);
      if (detected) {
        inviterId = detected.inviterId;
        inviteCode = detected.code;
      }
    } catch (err) {
      logger.warn(`[InviteTracker] Nie można pobrać zaproszeń dla ${guild.name}: ${err}`);
    }

    // Record the join
    const joinResult = await recordJoin({
      guildId: guild.id,
      joinedUserId: member.id,
      inviterId,
      inviteCode,
      accountCreatedAt: member.user.createdAt,
    });

    if (!joinResult.ok) return;

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

    // Pick the right template based on join scenario
    const isVanity = inviteCode != null && guild.vanityURLCode != null && inviteCode === guild.vanityURLCode;
    let template = '';
    if (isVanity) {
      template = config.joinMessageVanity || '';
    } else if (inviterId) {
      template = config.joinMessage || '';
    } else {
      template = config.joinMessageUnknown || '';
    }

    if (template) {
      const message = replaceVariables(template, member, inviterId, inviteCode, statsText, activeCount);
      await logChannel.send(message);
    } else {
      // Default embed
      const embed = new EmbedBuilder()
        .setColor(COLORS.JOIN)
        .setAuthor({
          name: member.user.tag,
          iconURL: member.user.displayAvatarURL({ size: 64 }),
        })
        .setDescription(
          `📥 <@${member.id}> dołączył/a do serwera!\n` +
          (isVanity
            ? `📨 Dołączył/a używając niestandardowego zaproszenia \`${inviteCode}\`\n`
            : inviterId
              ? `📨 Zaproszony/a przez: <@${inviterId}> (kod: \`${inviteCode ?? '?'}\`)\n`
              : '📨 Zaproszenie: *nieznane*\n') +
          (joinResult.data.fake ? '⚠️ Konto młodsze niż 7 dni — oznaczone jako fałszywe.\n' : '') +
          (statsText ? `📊 Statystyki zapraszającego: ${statsText}` : ''),
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error(`[InviteTracker] Błąd w guildMemberAdd: ${error}`);
  }
}

function replaceVariables(
  template: string,
  member: GuildMember,
  inviterId: string | null,
  inviteCode: string | null,
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
    .replace(/{inviteCode}/g, inviteCode ?? '*brak*')
    .replace(/{activeCount}/g, `${activeCount}`)
    .replace(/{stats}/g, statsText || '*brak danych*');
}
