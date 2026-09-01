import { Message, Client, GuildMember, Collection, PermissionFlagsBits } from 'discord.js';
import {
  getConfig,
  trackMessage,
  trackFlood,
  clearUserHistory,
  clearFloodHistory,
  startCleanup,
  getNextPunishment,
  recordIncident,
  AntiSpamSettings,
  AntiSpamRuleSettings,
  AntiSpamRuleId,
} from '../../services/antiSpamService';
import { AntiSpamPunishment } from '../../models/AntiSpamConfig';
import { addWarn, WarnStep } from '../../services/warnService';
import { getOrCreateModerationConfig } from '../../services/moderationConfigService';
import { sendLog, truncate } from '../../utils/logHelpers';
import { applyTimeoutSafely } from '../../utils/moderationHelpers';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
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

  // ── Masowe wzmianki ─────────────────────────────────────────────
  if (settings.mentions.on) {
    const blocked = await checkMassMentions(message, client, settings.mentions);
    if (blocked) return true;
  }

  // ── Linki z zaproszeniami ────────────────────────────────────────
  if (settings.invites.on) {
    const blocked = await checkInviteLinks(message, client, settings.invites);
    if (blocked) return true;
  }

  // ── Powtarzające się wiadomości ──────────────────────────────────
  if (settings.repeat.on && message.content.length > 0) {
    const floodResult = trackFlood(
      message.guild.id,
      message.author.id,
      message.content,
      message.channelId,
      settings.repeat
    );
    if (floodResult.isFlood) {
      logger.warn(
        `🛡️ Anti-Spam: wykryto powtarzające się wiadomości od ${message.author.tag} (${message.author.id}) — ` +
          `${floodResult.duplicateCount}x ta sama wiadomość na ${floodResult.channels.length} kanałach`
      );

      clearFloodHistory(message.guild.id, message.author.id);

      if (settings.repeat.deleteMessage) {
        await message.delete().catch(() => {});
      }

      const actionLabel = await applyRulePunishment(message, client, 'repeat', settings.repeat);

      const channelMentions = floodResult.channels.map((ch) => `<#${ch}>`).join(', ');
      await sendLog(client, message.guild.id, 'antiSpam', {
        title: '🛡️ Wykryto powtarzające się wiadomości',
        description:
          `**Użytkownik:** <@${message.author.id}> (${message.author.tag})\n` +
          `**Powtórzona treść:** \`${truncate(message.content, 100)}\`\n` +
          `**Powtórzeń:** ${floodResult.duplicateCount} w ${settings.repeat.windowSeconds}s\n` +
          `**Kanały:** ${channelMentions}\n` +
          `**Akcja:** ${actionLabel}`,
      });

      return true;
    }
  }

  // ── Za szybkie pisanie (rate-limit) ──────────────────────────────
  if (settings.rate.on) {
    const result = trackMessage(message.guild.id, message.author.id, settings.rate);
    if (result.isSpam) {
      logger.warn(
        `🛡️ Anti-Spam: wykryto spam od ${message.author.tag} (${message.author.id}) ` +
          `na serwerze ${message.guild.name} (${message.guild.id}) — ` +
          `${result.messageCount} wiadomości w ${settings.rate.windowSeconds}s`
      );

      // Clear rate history so they don't keep re-triggering immediately
      clearUserHistory(message.guild.id, message.author.id);

      if (settings.rate.deleteMessage) {
        await deleteRecentMessages(message);
      }

      const actionLabel = await applyRulePunishment(message, client, 'rate', settings.rate);

      await sendLog(client, message.guild.id, 'antiSpam', {
        title: '🛡️ Wykryto zbyt szybkie wiadomości',
        description:
          `**Użytkownik:** <@${message.author.id}> (${message.author.tag})\n` +
          `**Kanał:** <#${message.channelId}>\n` +
          `**Wykryto:** ${result.messageCount} wiadomości w ${settings.rate.windowSeconds}s\n` +
          `**Akcja:** ${actionLabel}`,
      });

      // Short-circuit — don't process this message further (no XP, no suggestions, etc.)
      return true;
    }
  }
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
 * Ustala karę (single lub kolejny stopień drabinki), stosuje ją i zapisuje incydent.
 * Zwraca czytelną etykietę do logów.
 */
async function applyRulePunishment(
  message: Message,
  client: Client,
  ruleId: AntiSpamRuleId,
  rule: AntiSpamRuleSettings
): Promise<string> {
  const punishment = await getNextPunishment(message.guild!.id, message.author.id, ruleId, rule);
  const label = await executeAction(message, client, punishment, rule.muteDuration);
  await recordIncident(message.guild!.id, message.author.id, ruleId, punishment);
  return label;
}

/**
 * Executes the given punishment and returns a human-readable label.
 */
async function executeAction(
  message: Message,
  client: Client,
  punishment: AntiSpamPunishment,
  muteDurationMinutes: string
): Promise<string> {
  const member = message.member!;

  try {
    switch (punishment) {
      case 'none':
        return 'Brak dodatkowej kary';

      case 'mute': {
        if (member.moderatable) {
          const ms = Number(muteDurationMinutes) * 60 * 1000;
          await member.timeout(ms, 'Anti-Spam: automatyczne wyciszenie');
          return `Wyciszenie na ${muteDurationMinutes} min`;
        }
        return 'Wyciszenie (brak uprawnień)';
      }

      case 'warn': {
        const botUser = client.user;
        const reason = 'Anti-Spam: automatyczne ostrzeżenie za spam';

        // Anti-Spam wpina się w TĘ SAMĄ konfigurowalną drabinkę co /warn (Rule Engine bez LLM) —
        // steps pochodzą z ModerationConfig serwera, nie z hardcoded stałych.
        const modConfig = await getOrCreateModerationConfig(member.guild.id);
        const steps: WarnStep[] =
          modConfig.warnMode === 'single'
            ? [{ action: modConfig.warnSingle.action, durationMinutes: modConfig.warnSingle.durationMinutes }]
            : modConfig.warnSteps.map((s) => ({ action: s.action, durationMinutes: s.durationMinutes }));

        const result = await addWarn({
          guildId: member.guild.id,
          userId: member.id,
          reason,
          moderatorId: botUser?.id ?? 'system',
          // Stała etykieta zamiast botUser.tag — nick bota na serwerze może się zmieniać
          // (np. przez Ustawienia → Profil), a to ostrzeżenie jest automatyczne, nie ludzkie.
          moderatorTag: 'Anti-Spam (automatycznie)',
          steps,
        });

        if (!result.ok) {
          logger.error(`Anti-Spam: nie udało się zapisać ostrzeżenia dla ${member.id}: ${result.message}`);
          return 'Ostrzeżenie (błąd zapisu)';
        }

        // To ostrzeżenie może realnie oznaczać auto-ban, auto-kick albo timeout wg poziomu kary —
        // user dostaje DM i realną karę, nie tylko wpis w bazie.
        const { count, step, nextStep, isFinal } = result.data;
        const limit = steps.length;

        if (step.action === 'ban') {
          try {
            await member.ban({ reason: `Auto-ban: osiągnięto limit ostrzeżeń (${count}) — Anti-Spam` });
          } catch (err) {
            logger.error(`Anti-Spam: błąd przy auto-banie ${member.id}: ${err}`);
            return `Ostrzeżenie ${count}/${limit} (nie udało się zbanować)`;
          }
          try {
            await member.user.send({
              embeds: [createBaseEmbed({
                title: '🚫 Zostałeś zbanowany',
                description:
                  `**Serwer:** ${member.guild.name}\n` +
                  `**Powód:** Zbyt szybkie wysyłanie wiadomości (Anti-Spam)\n\n` +
                  `⚠️ **Osiągnięto limit ostrzeżeń (${count}/${limit})**\n` +
                  `Zostałeś permanentnie zbanowany z serwera.`,
                color: COLORS.ERROR,
              })],
            });
          } catch {
            logger.debug(`Anti-Spam: nie można wysłać DM (ban) do ${member.id}`);
          }
          return `Auto-ban (${count}/${limit})`;
        }

        if (step.action === 'kick') {
          try {
            await member.user.send({
              embeds: [createBaseEmbed({
                title: '👢 Zostałeś wyrzucony',
                description:
                  `**Serwer:** ${member.guild.name}\n` +
                  `**Powód:** Zbyt szybkie wysyłanie wiadomości (Anti-Spam)\n\n` +
                  `⚠️ **Osiągnięto ${count}/${limit} ostrzeżeń** — zostałeś wyrzucony z serwera.`,
                color: COLORS.ERROR,
              })],
            });
          } catch {
            logger.debug(`Anti-Spam: nie można wysłać DM (kick) do ${member.id}`);
          }
          try {
            await member.kick('Anti-Spam: automatyczne wyrzucenie po ostrzeżeniach');
          } catch (err) {
            logger.error(`Anti-Spam: błąd przy auto-kicku ${member.id}: ${err}`);
            return `Ostrzeżenie ${count}/${limit} (nie udało się wyrzucić)`;
          }
          return `Auto-kick (${count}/${limit})`;
        }

        const muteDurationMs = step.action === 'mute' ? step.durationMs : 0;
        const { muteEndTs, muteFailed } = await applyTimeoutSafely(member, muteDurationMs, reason);

        try {
          const consequencesText = !isFinal
            ? `\n\n⚠️ **Kolejne ostrzeżenie:** ${nextStep.label}`
            : '';
          await member.user.send({
            embeds: [createBaseEmbed({
              title: '⚠️ Otrzymałeś ostrzeżenie (Anti-Spam)',
              description:
                `**Serwer:** ${member.guild.name}\n` +
                `**Powód:** Zbyt szybkie wysyłanie wiadomości (automatyczna reguła Anti-Spam)\n` +
                `**Kara:** ${muteEndTs ? `${step.label} wyciszenia` : muteFailed ? 'nie udało się nałożyć wyciszenia (brak uprawnień)' : 'Brak wyciszenia'}\n` +
                `**Ostrzeżenia:** ${count}/${limit}` +
                consequencesText,
              color: COLORS.WARN,
            })],
          });
        } catch {
          logger.debug(`Anti-Spam: nie można wysłać DM (ostrzeżenie) do ${member.id}`);
        }

        if (muteEndTs) return `Ostrzeżenie + wyciszenie (${count}/${limit})`;
        if (muteFailed) return `Ostrzeżenie (${count}/${limit}, wyciszenie nieudane)`;
        return `Ostrzeżenie (${count}/${limit})`;
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
    logger.error(`Anti-Spam: błąd wykonania kary "${punishment}": ${error}`);
    return `Błąd: ${punishment}`;
  }
}

/* ── Linki z zaproszeniami ────────────────────────────────────────── */

/** Regex matching Discord invite URLs (discord.gg, discord.com/invite, discordapp.com/invite). */
const INVITE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]+)/gi;

/**
 * Extracts invite codes from a message, resolves them, and blocks invites —
 * z wyjątkiem zaproszeń do TEGO serwera, jeśli `rule.allowOwnServerInvites` jest włączone.
 *
 * @returns `true` if the message was blocked.
 */
async function checkInviteLinks(
  message: Message,
  client: Client,
  rule: AntiSpamRuleSettings
): Promise<boolean> {
  const matches = message.content.matchAll(INVITE_REGEX);
  const codes = [...matches].map((m) => m[1]);
  if (codes.length === 0) return false;

  for (const code of codes) {
    try {
      const invite = await client.fetchInvite(code);
      if (!invite.guild) continue; // np. zaproszenie do group DM — nie da się porównać serwera

      const isOwnServer = invite.guild.id === message.guild!.id;
      if (isOwnServer && rule.allowOwnServerInvites) continue;

      logger.warn(
        `🛡️ Anti-Spam: zablokowano zaproszenie od ${message.author.tag} ` +
          `(${message.author.id}) → ${invite.guild.name} (${invite.guild.id})`
      );

      if (rule.deleteMessage) {
        await message.delete().catch(() => {});
      }

      const actionLabel = await applyRulePunishment(message, client, 'invites', rule);

      await sendLog(client, message.guild!.id, 'antiSpam', {
        title: '🛡️ Zablokowane zaproszenie',
        description:
          `**Użytkownik:** <@${message.author.id}> (${message.author.tag})\n` +
          `**Kanał:** <#${message.channelId}>\n` +
          `**Zaproszenie do:** ${invite.guild.name} (\`${invite.guild.id}\`)\n` +
          `**Kod:** \`${code}\`\n` +
          `**Akcja:** ${actionLabel}`,
      });

      return true;
    } catch {
      // Invalid/expired invite — ignore
    }
  }

  return false;
}

/* ── Masowe wzmianki ──────────────────────────────────────────────── */

/**
 * Checks whether a message contains too many mentions (@user/@role) or
 * @everyone / @here pings (zawsze blokowane, gdy reguła jest włączona).
 *
 * @returns `true` if the message was blocked.
 */
async function checkMassMentions(
  message: Message,
  client: Client,
  rule: AntiSpamRuleSettings
): Promise<boolean> {
  const mentionedUsers = message.mentions.users.size;
  const mentionedRoles = message.mentions.roles.size;
  const totalMentions = mentionedUsers + mentionedRoles;
  const mentionsEveryone = message.mentions.everyone; // true for @everyone or @here

  if (mentionsEveryone) {
    return await blockMention(message, client, rule, 'Użycie @everyone / @here', '@everyone/@here');
  }

  if (totalMentions > rule.threshold) {
    return await blockMention(
      message,
      client,
      rule,
      `Zbyt wiele wzmianek (${totalMentions})`,
      `${mentionedUsers} użytkowników, ${mentionedRoles} ról`
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
  rule: AntiSpamRuleSettings,
  reason: string,
  details: string
): Promise<boolean> {
  logger.warn(
    `🛡️ Anti-Spam: zablokowano masowe wzmianki od ${message.author.tag} ` +
      `(${message.author.id}) — ${reason}`
  );

  if (rule.deleteMessage) {
    await message.delete().catch(() => {});
  }

  const actionLabel = await applyRulePunishment(message, client, 'mentions', rule);

  await sendLog(client, message.guild!.id, 'antiSpam', {
    title: '🛡️ Zablokowane wzmianki',
    description:
      `**Użytkownik:** <@${message.author.id}> (${message.author.tag})\n` +
      `**Kanał:** <#${message.channelId}>\n` +
      `**Powód:** ${reason}\n` +
      `**Szczegóły:** ${details}\n` +
      `**Akcja:** ${actionLabel}`,
  });

  return true;
}
