import { Message, Client, GuildMember, Collection, PermissionFlagsBits } from 'discord.js';
import {
  getConfig,
  trackMessage,
  trackFlood,
  clearUserHistory,
  clearFloodHistory,
  startCleanup,
  AntiSpamSettings,
} from '../../services/antiSpamService';
import { addWarn } from '../../services/warnService';
import { sendLog } from '../../utils/logHelpers';
import logger from '../../utils/logger';

let cleanupStarted = false;

/**
 * Anti-spam handler for messageCreate.
 *
 * Returns `true` to short-circuit the handler chain when a message is
 * identified as spam (the message is already dealt with).
 */
export default async function run(message: Message, client: Client): Promise<boolean | void> {
  // Ignore bots, DMs, system messages
  if (message.author.bot || !message.guild || !message.member) return;

  // Lazily start the periodic cleanup
  if (!cleanupStarted) {
    startCleanup();
    cleanupStarted = true;
  }

  const settings = await getConfig(message.guild.id);
  if (!settings.enabled) return;

  // Skip ignored channels
  if (settings.ignoredChannels.includes(message.channelId)) return;

  // Skip members with ignored roles
  if (hasIgnoredRole(message.member, settings)) return;

  // Skip members with administrator permission (always exempt)
  if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  // ── Mass mention detection ────────────────────────────────────
  if (settings.blockMassMentions) {
    const blocked = await checkMassMentions(message, client, settings);
    if (blocked) return true;
  }

  // ── Invite link detection ─────────────────────────────────────
  if (settings.blockInviteLinks) {
    const blocked = await checkInviteLinks(message, client, settings);
    if (blocked) return true;
  }

  // ── Flood detection (duplicate messages across channels) ──────
  if (settings.blockFlood && message.content.length > 0) {
    const floodResult = trackFlood(
      message.guild.id,
      message.author.id,
      message.content,
      message.channelId,
      settings
    );
    if (floodResult.isFlood) {
      logger.warn(
        `🛡️ Anti-Spam: wykryto flood od ${message.author.tag} (${message.author.id}) — ` +
          `${floodResult.duplicateCount}x ta sama wiadomość na ${floodResult.channels.length} kanałach`
      );

      clearFloodHistory(message.guild.id, message.author.id);

      await message.delete().catch(() => {});

      const actionLabel = await executeAction(message, client, settings);

      const channelMentions = floodResult.channels.map((ch) => `<#${ch}>`).join(', ');
      await sendLog(client, message.guild.id, 'antiSpam', {
        title: '🛡️ Wykryto flood',
        description:
          `**Użytkownik:** <@${message.author.id}> (${message.author.tag})\n` +
          `**Powtórzona treść:** \`${message.content.slice(0, 100)}${message.content.length > 100 ? '...' : ''}\`\n` +
          `**Powtórzeń:** ${floodResult.duplicateCount} w ${settings.floodWindowMs / 1000}s\n` +
          `**Kanały:** ${channelMentions}\n` +
          `**Akcja:** ${actionLabel}`,
        footer: `ID: ${message.author.id}`,
        timestamp: true,
      });

      return true;
    }
  }

  // Track the message and check for spam
  const result = trackMessage(message.guild.id, message.author.id, settings);
  if (!result.isSpam) return;

  // ── Spam detected — take action ───────────────────────────────
  logger.warn(
    `🛡️ Anti-Spam: wykryto spam od ${message.author.tag} (${message.author.id}) ` +
      `na serwerze ${message.guild.name} (${message.guild.id}) — ` +
      `${result.messageCount} wiadomości w ${settings.timeWindowMs}ms`
  );

  // Clear user history so they don't keep re-triggering immediately
  clearUserHistory(message.guild.id, message.author.id);

  // Delete recent spam messages
  if (settings.deleteMessages) {
    await deleteRecentMessages(message);
  }

  // Execute the configured action
  const actionLabel = await executeAction(message, client, settings);

  // Log to the guild's log channel
  await sendLog(client, message.guild.id, 'antiSpam', {
    description:
      `**Użytkownik:** <@${message.author.id}> (${message.author.tag})\n` +
      `**Kanał:** <#${message.channelId}>\n` +
      `**Wykryto:** ${result.messageCount} wiadomości w ${settings.timeWindowMs / 1000}s\n` +
      `**Akcja:** ${actionLabel}`,
    footer: `ID: ${message.author.id}`,
    timestamp: true,
  });

  // Short-circuit — don't process this message further (no XP, no suggestions, etc.)
  return true;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function hasIgnoredRole(member: GuildMember, settings: AntiSpamSettings): boolean {
  return settings.ignoredRoles.some((roleId) => member.roles.cache.has(roleId));
}

/**
 * Tries to bulk-delete recent messages from the spammer in the same channel.
 */
async function deleteRecentMessages(message: Message): Promise<void> {
  try {
    const channel = message.channel;
    if (!('messages' in channel)) return;

    const fetched = (await channel.messages.fetch({ limit: 20 })) as Collection<string, Message>;
    const spam = fetched.filter((m) => m.author.id === message.author.id);

    if (spam.size > 1 && 'bulkDelete' in channel) {
      await (channel as any).bulkDelete(spam, true);
    } else if (spam.size === 1) {
      await spam.first()!.delete().catch(() => {});
    }
  } catch (error) {
    logger.error(`Anti-Spam: błąd usuwania wiadomości: ${error}`);
  }
}

/**
 * Executes the configured punishment and returns a human-readable label.
 */
async function executeAction(
  message: Message,
  client: Client,
  settings: AntiSpamSettings
): Promise<string> {
  const member = message.member!;
  const guild = message.guild!;

  try {
    switch (settings.action) {
      case 'timeout': {
        if (member.moderatable) {
          await member.timeout(settings.timeoutDurationMs, 'Anti-Spam: automatyczne wyciszenie');
          const secs = Math.round(settings.timeoutDurationMs / 1000);
          const mins = Math.round(secs / 60);
          return `Wyciszenie na ${mins} min`;
        }
        return 'Wyciszenie (brak uprawnień)';
      }

      case 'warn': {
        const botUser = client.user;
        await addWarn({
          guildId: guild.id,
          userId: member.id,
          reason: 'Anti-Spam: automatyczne ostrzeżenie za spam',
          moderatorId: botUser?.id ?? 'system',
          moderatorTag: botUser?.tag ?? 'System',
        });
        // Also apply a short timeout to stop the spam immediately
        if (member.moderatable) {
          await member.timeout(60_000, 'Anti-Spam: krótkie wyciszenie po ostrzeżeniu');
        }
        return 'Ostrzeżenie + 1 min wyciszenia';
      }

      case 'kick': {
        if (member.kickable) {
          await member.kick('Anti-Spam: automatyczne wyrzucenie za spam');
          return 'Wyrzucenie z serwera';
        }
        return 'Wyrzucenie (brak uprawnień)';
      }

      case 'ban': {
        if (member.bannable) {
          await member.ban({
            reason: 'Anti-Spam: automatyczny ban za spam',
            deleteMessageSeconds: 60,
          });
          return 'Ban';
        }
        return 'Ban (brak uprawnień)';
      }

      default:
        return 'Nieznana akcja';
    }
  } catch (error) {
    logger.error(`Anti-Spam: błąd wykonania akcji "${settings.action}": ${error}`);
    return `Błąd: ${settings.action}`;
  }
}

/* ── Invite link detection ───────────────────────────────────────── */

/** Regex matching Discord invite URLs (discord.gg, discord.com/invite, discordapp.com/invite). */
const INVITE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]+)/gi;

/**
 * Extracts invite codes from a message, resolves them, and blocks
 * invites that point to a different guild than the current one.
 *
 * @returns `true` if the message was blocked (invite to another server).
 */
async function checkInviteLinks(
  message: Message,
  client: Client,
  settings: AntiSpamSettings
): Promise<boolean> {
  const matches = message.content.matchAll(INVITE_REGEX);
  const codes = [...matches].map((m) => m[1]);
  if (codes.length === 0) return false;

  for (const code of codes) {
    try {
      const invite = await client.fetchInvite(code);
      if (invite.guild && invite.guild.id !== message.guild!.id) {
        logger.warn(
          `🛡️ Anti-Spam: zablokowano zaproszenie do innego serwera od ${message.author.tag} ` +
            `(${message.author.id}) → ${invite.guild.name} (${invite.guild.id})`
        );

        // Delete the message
        await message.delete().catch(() => {});

        // Execute punishment
        const actionLabel = await executeAction(message, client, settings);

        // Log event
        await sendLog(client, message.guild!.id, 'antiSpam', {
          title: '🛡️ Zablokowane zaproszenie',
          description:
            `**Użytkownik:** <@${message.author.id}> (${message.author.tag})\n` +
            `**Kanał:** <#${message.channelId}>\n` +
            `**Zaproszenie do:** ${invite.guild.name} (\`${invite.guild.id}\`)\n` +
            `**Kod:** \`${code}\`\n` +
            `**Akcja:** ${actionLabel}`,
          footer: `ID: ${message.author.id}`,
          timestamp: true,
        });

        return true;
      }
    } catch {
      // Invalid/expired invite — ignore
    }
  }

  return false;
}

/* ── Mass mention detection ──────────────────────────────────────── */

/**
 * Checks whether a message contains too many mentions (@user) or
 * forbidden @everyone / @here pings.
 *
 * @returns `true` if the message was blocked.
 */
async function checkMassMentions(
  message: Message,
  client: Client,
  settings: AntiSpamSettings
): Promise<boolean> {
  const mentionedUsers = message.mentions.users.size;
  const mentionedRoles = message.mentions.roles.size;
  const totalMentions = mentionedUsers + mentionedRoles;

  const mentionsEveryone = message.mentions.everyone; // true for @everyone or @here

  // Check @everyone / @here
  if (settings.blockEveryoneHere && mentionsEveryone) {
    return await blockMention(
      message,
      client,
      settings,
      'Użycie @everyone / @here',
      `@everyone/@here`,
    );
  }

  // Check user/role mention count
  if (totalMentions > settings.maxMentionsPerMessage) {
    return await blockMention(
      message,
      client,
      settings,
      `Zbyt wiele wzmianek (${totalMentions})`,
      `${mentionedUsers} użytkowników, ${mentionedRoles} ról`,
    );
  }

  return false;
}

/**
 * Handles a blocked mention — deletes, punishes, logs.
 */
async function blockMention(
  message: Message,
  client: Client,
  settings: AntiSpamSettings,
  reason: string,
  details: string,
): Promise<boolean> {
  logger.warn(
    `🛡️ Anti-Spam: zablokowano masowe wzmianki od ${message.author.tag} ` +
      `(${message.author.id}) — ${reason}`
  );

  await message.delete().catch(() => {});

  const actionLabel = await executeAction(message, client, settings);

  await sendLog(client, message.guild!.id, 'antiSpam', {
    title: '🛡️ Zablokowane wzmianki',
    description:
      `**Użytkownik:** <@${message.author.id}> (${message.author.tag})\n` +
      `**Kanał:** <#${message.channelId}>\n` +
      `**Powód:** ${reason}\n` +
      `**Szczegóły:** ${details}\n` +
      `**Akcja:** ${actionLabel}`,
    footer: `ID: ${message.author.id}`,
    timestamp: true,
  });

  return true;
}
