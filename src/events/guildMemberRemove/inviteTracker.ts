import { GuildMember, Client, TextChannel, EmbedBuilder, ColorResolvable } from 'discord.js';
import {
  getConfig,
  recordLeave,
  buildInviteMessage,
  LEAVE_SITUATIONS,
  LeaveSituation,
  MessageContext,
  ResolvedMessage,
} from '../../services/inviteTrackerService';
import logger from '../../utils/logger';

/**
 * Records when a member leaves (lub czy to usunięcie bota / vanity / nieznany zapraszający)
 * i wysyła odpowiedni szablon wiadomości do skonfigurowanego kanału.
 */
export default async function run(member: GuildMember, _client: Client): Promise<void> {
  try {
    const { guild } = member;
    if (!guild) return;

    const configResult = await getConfig(guild.id);
    if (!configResult.ok || !configResult.data.enabled) return;
    const config = configResult.data;

    if (member.user.bot) {
      await handleBotRemove(member, config.leave.enabled, config.leave.logChannelId, config.leave.messages.botRemove, config.leave.embed, config.leave.embedColor);
      return;
    }

    // Record the leave (zawsze, niezależnie od tego czy wiadomość zostanie wysłana)
    const leaveResult = await recordLeave(guild.id, member.id);
    if (!leaveResult.ok) return;
    const { inviterId, inviteCode } = leaveResult.data;

    if (!config.leave.enabled || !config.leave.logChannelId) return;
    const logChannel = guild.channels.cache.get(config.leave.logChannelId) as TextChannel | undefined;
    if (!logChannel) return;

    const isVanity = inviteCode != null && guild.vanityURLCode != null && inviteCode === guild.vanityURLCode;
    const situationKey: LeaveSituation = isVanity ? 'vanity' : inviterId ? 'normal' : 'unknown';
    const situation = LEAVE_SITUATIONS[situationKey];

    let inviterName = 'nieznany';
    if (isVanity) {
      inviterName = 'niestandardowe zaproszenie';
    } else if (inviterId) {
      const inviterMember = await guild.members.fetch(inviterId).catch(() => null);
      inviterName = inviterMember?.displayName ?? 'nieznany';
    }

    const ctx: MessageContext = {
      memberMention: `<@${member.id}>`,
      memberName: member.displayName,
      inviterName,
      inviteCount: '0',
      inviteCode: inviteCode ?? '—',
    };

    const template = config.leave.messages[situationKey];
    const resolved = buildInviteMessage(template, situation, ctx, config.leave.embed, config.leave.embedColor);
    await sendResolved(logChannel, resolved);
  } catch (error) {
    logger.error(`[InviteTracker] Błąd w guildMemberRemove: ${error}`);
  }
}

async function handleBotRemove(
  member: GuildMember,
  sectionEnabled: boolean,
  logChannelId: string | null,
  template: string,
  useEmbed: boolean,
  embedColor?: string,
): Promise<void> {
  if (!sectionEnabled || !logChannelId) return;
  const logChannel = member.guild.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (!logChannel) return;

  const ctx: MessageContext = {
    memberMention: `<@${member.id}>`,
    memberName: member.user.username,
    inviterName: 'nieznany',
    inviteCount: '0',
    inviteCode: '—',
  };

  const resolved = buildInviteMessage(template, LEAVE_SITUATIONS.botRemove, ctx, useEmbed, embedColor);
  await sendResolved(logChannel, resolved);
}

async function sendResolved(channel: TextChannel, resolved: ResolvedMessage): Promise<void> {
  if (resolved.embed) {
    const embed = new EmbedBuilder()
      .setColor(resolved.embed.color as ColorResolvable)
      .setTitle(resolved.embed.title)
      .setDescription(resolved.text)
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } else {
    await channel.send(resolved.text);
  }
}
