import { GuildMember, Client, TextChannel, EmbedBuilder, AuditLogEvent, ColorResolvable } from 'discord.js';
import { detectUsedInvite } from '../../cache/inviteCache';
import {
  getConfig,
  recordJoin,
  getInviterStats,
  buildInviteMessage,
  JOIN_SITUATIONS,
  JoinSituation,
  MessageContext,
  ResolvedMessage,
} from '../../services/inviteTrackerService';
import logger from '../../utils/logger';

/**
 * Detects which invite was used when a member joins (lub czy to dodanie bota / samo-zaproszenie /
 * vanity link / nieznane źródło) i wysyła odpowiedni szablon wiadomości do skonfigurowanego kanału.
 */
export default async function run(member: GuildMember, _client: Client): Promise<void> {
  try {
    const { guild } = member;
    if (!guild) return;

    const configResult = await getConfig(guild.id);
    if (!configResult.ok || !configResult.data.enabled) return;
    const config = configResult.data;

    if (member.user.bot) {
      await handleBotAdd(member, config.join.enabled, config.join.logChannelId, config.join.messages.botAdd, config.join.embed, config.join.embedColor);
      return;
    }

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

    // Record the join (zawsze, niezależnie od tego czy wiadomość zostanie wysłana — statystyki/leaderboard to osobna sprawa)
    const joinResult = await recordJoin({
      guildId: guild.id,
      joinedUserId: member.id,
      inviterId,
      inviteCode,
      accountCreatedAt: member.user.createdAt,
    });
    if (!joinResult.ok) return;

    if (!config.join.enabled || !config.join.logChannelId) return;
    const logChannel = guild.channels.cache.get(config.join.logChannelId) as TextChannel | undefined;
    if (!logChannel) return;

    const isVanity = inviteCode != null && guild.vanityURLCode != null && inviteCode === guild.vanityURLCode;
    const isSelfInvite = inviterId === member.id;
    const situationKey: JoinSituation = isVanity ? 'vanity' : isSelfInvite ? 'selfInvite' : inviterId ? 'normal' : 'unknown';
    const situation = JOIN_SITUATIONS[situationKey];

    let inviterName = 'nieznany';
    let inviteCountText = '0';

    if (isVanity) {
      inviterName = 'niestandardowe zaproszenie';
    } else if (inviterId) {
      const inviterMember = await guild.members.fetch(inviterId).catch(() => null);
      inviterName = inviterMember?.displayName ?? 'nieznany';
      const statsResult = await getInviterStats(guild.id, inviterId);
      if (statsResult.ok) inviteCountText = `${statsResult.data.active}`;
    }

    const ctx: MessageContext = {
      memberMention: `<@${member.id}>`,
      memberName: member.displayName,
      inviterName,
      inviteCount: inviteCountText,
      inviteCode: inviteCode ?? '—',
    };

    const template = config.join.messages[situationKey];
    const resolved = buildInviteMessage(template, situation, ctx, config.join.embed, config.join.embedColor);
    await sendResolved(logChannel, resolved);
  } catch (error) {
    logger.error(`[InviteTracker] Błąd w guildMemberAdd: ${error}`);
  }
}

/** Bota dodano na serwer — próbujemy (best-effort) ustalić kto go dodał przez audit log. */
async function handleBotAdd(
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

  let inviterName = 'nieznany';
  try {
    const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
    const entry = logs.entries.find((e) => e.target?.id === member.id);
    if (entry?.executor?.username) inviterName = entry.executor.username;
  } catch {
    // brak uprawnień do audit logu — zostaw "nieznany"
  }

  const ctx: MessageContext = {
    memberMention: `<@${member.id}>`,
    memberName: member.user.username,
    inviterName,
    inviteCount: '0',
    inviteCode: '—',
  };

  const resolved = buildInviteMessage(template, JOIN_SITUATIONS.botAdd, ctx, useEmbed, embedColor);
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
