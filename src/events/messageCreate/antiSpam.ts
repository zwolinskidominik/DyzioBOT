import {
  Message,
  Client,
  GuildMember,
  Collection,
  PermissionFlagsBits,
  ApplicationIntegrationType,
  User,
  escapeMarkdown,
} from 'discord.js';
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
 * Kto odpowiada za wiadomość. Zwykle autor, ale przy aplikacjach instalowanych na koncie
 * użytkownika („APL.", np. boty do raidów) autorem jest aplikacja, a sprawcą osoba, która
 * użyła jej komendy na tym serwerze - to ją karzemy, nie aplikację.
 */
interface SpamSource {
  member: GuildMember;
  user: User;
  /** Aplikacja zewnętrzna, przez którą wysłano wiadomość; null dla zwykłych wiadomości. */
  viaApp: User | null;
}

/**
 * Ustala sprawcę wiadomości. Zwraca null dla wiadomości, których Anti-Spam nie ocenia:
 * DM-y, wiadomości systemowe, zwykłe boty i aplikacje zainstalowane NA SERWERZE (te dodali
 * administratorzy, więc im ufamy).
 */
export async function resolveSpamSource(message: Message): Promise<SpamSource | null> {
  if (!message.guild) return null;

  if (!message.author.bot) {
    return message.member ? { member: message.member, user: message.author, viaApp: null } : null;
  }

  const meta = message.interactionMetadata;
  if (!meta) return null;
  const owners = meta.authorizingIntegrationOwners;
  const userInstalled = owners[ApplicationIntegrationType.UserInstall] !== undefined;
  const guildInstalled = owners[ApplicationIntegrationType.GuildInstall] !== undefined;
  if (!userInstalled || guildInstalled) return null;

  const member = await message.guild.members.fetch(meta.user.id).catch(() => null);
  if (!member) return null;
  return { member, user: meta.user, viaApp: message.author };
}

/** Linia „Użytkownik" do logu + informacja o aplikacji zewnętrznej, jeśli jej użyto. */
function sourceLines(source: SpamSource): string {
  const userLine = `**Użytkownik:** <@${source.user.id}> (${source.user.tag})\n`;
  if (!source.viaApp) return userLine;
  return userLine + `**Przez aplikację:** ${escapeMarkdown(source.viaApp.username)} (\`${source.viaApp.id}\`)\n`;
}

/**
 * Anti-spam handler for messageCreate.
 *
 * Returns `true` to short-circuit the handler chain when a message is
 * identified as spam (the message is already dealt with).
 */
export default async function run(message: Message, client: Client): Promise<boolean | void> {
  // Ignore DMs, system messages, bots and server-installed apps (see resolveSpamSource)
  if (!message.guild) return;
  const source = await resolveSpamSource(message);
  if (!source) return;
  const guild = message.guild;

  // Lazily start the periodic cleanup
  if (!cleanupStarted) {
    startCleanup();
    cleanupStarted = true;
  }

  const settings = await getConfig(guild.id);
  if (!settings.enabled) return;

  // Skip ignored channels
  if (settings.ignoredChannels.includes(message.channelId)) return;

  // Skip members with ignored roles
  if (hasIgnoredRole(source.member, settings)) return;

  // Skip members with administrator permission (always exempt)
  if (source.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  // ── Masowe wzmianki ─────────────────────────────────────────────
  if (settings.mentions.on) {
    const blocked = await checkMassMentions(message, client, source, settings.mentions);
    if (blocked) return true;
  }

  // ── Linki z zaproszeniami ────────────────────────────────────────
  if (settings.invites.on) {
    const blocked = await checkInviteLinks(message, client, source, settings.invites);
    if (blocked) return true;
  }

  // ── Powtarzające się wiadomości ──────────────────────────────────
  if (settings.repeat.on && message.content.length > 0) {
    const floodResult = trackFlood(
      guild.id,
      source.user.id,
      message.content,
      message.channelId,
      settings.repeat
    );
    if (floodResult.isFlood) {
      logger.warn(
        `🛡️ Anti-Spam: wykryto powtarzające się wiadomości od ${source.user.tag} (${source.user.id}) - ` +
          `${floodResult.duplicateCount}x ta sama wiadomość na ${floodResult.channels.length} kanałach`
      );

      clearFloodHistory(guild.id, source.user.id);

      if (settings.repeat.deleteMessage) {
        await message.delete().catch(() => {});
      }

      const actionLabel = await applyRulePunishment(guild.id, client, source, 'repeat', settings.repeat);

      const channelMentions = floodResult.channels.map((ch) => `<#${ch}>`).join(', ');
      await sendLog(client, guild.id, 'antiSpam', {
        title: '🛡️ Wykryto powtarzające się wiadomości',
        description:
          sourceLines(source) +
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
    const result = trackMessage(guild.id, source.user.id, settings.rate);
    if (result.isSpam) {
      logger.warn(
        `🛡️ Anti-Spam: wykryto spam od ${source.user.tag} (${source.user.id}) ` +
          `na serwerze ${guild.name} (${guild.id}) - ` +
          `${result.messageCount} wiadomości w ${settings.rate.windowSeconds}s`
      );

      // Clear rate history so they don't keep re-triggering immediately
      clearUserHistory(guild.id, source.user.id);

      if (settings.rate.deleteMessage) {
        await deleteRecentMessages(message, source.user.id);
      }

      const actionLabel = await applyRulePunishment(guild.id, client, source, 'rate', settings.rate);

      await sendLog(client, guild.id, 'antiSpam', {
        title: '🛡️ Wykryto zbyt szybkie wiadomości',
        description:
          sourceLines(source) +
          `**Kanał:** <#${message.channelId}>\n` +
          `**Wykryto:** ${result.messageCount} wiadomości w ${settings.rate.windowSeconds}s\n` +
          `**Akcja:** ${actionLabel}`,
      });

      // Short-circuit - don't process this message further (no XP, no suggestions, etc.)
      return true;
    }
  }
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function hasIgnoredRole(member: GuildMember, settings: AntiSpamSettings): boolean {
  return settings.ignoredRoles.some((roleId) => member.roles.cache.has(roleId));
}

/** Wiadomość napisana przez tę osobę albo wysłana przez aplikację zewnętrzną na jej komendę. */
function isFromUser(m: Message, userId: string): boolean {
  return m.author.id === userId || m.interactionMetadata?.user.id === userId;
}

/**
 * Tries to bulk-delete recent messages from the spammer in the same channel.
 */
async function deleteRecentMessages(message: Message, userId: string): Promise<void> {
  try {
    const channel = message.channel;
    if (!('messages' in channel)) return;

    const fetched = (await channel.messages.fetch({ limit: 20 })) as Collection<string, Message>;
    const spam = fetched.filter((m) => isFromUser(m, userId));

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
  guildId: string,
  client: Client,
  source: SpamSource,
  ruleId: AntiSpamRuleId,
  rule: AntiSpamRuleSettings
): Promise<string> {
  const punishment = await getNextPunishment(guildId, source.user.id, ruleId, rule);
  const label = await executeAction(source.member, client, punishment, rule.muteDuration);
  await recordIncident(guildId, source.user.id, ruleId, punishment);
  return label;
}

/**
 * Executes the given punishment and returns a human-readable label.
 */
async function executeAction(
  member: GuildMember,
  client: Client,
  punishment: AntiSpamPunishment,
  muteDurationMinutes: string
): Promise<string> {

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

        // Anti-Spam wpina się w TĘ SAMĄ konfigurowalną drabinkę co /warn (Rule Engine bez LLM) -
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
          // Stała etykieta zamiast botUser.tag - nick bota na serwerze może się zmieniać
          // (np. przez Ustawienia → Profil), a to ostrzeżenie jest automatyczne, nie ludzkie.
          moderatorTag: 'Anti-Spam (automatycznie)',
          steps,
        });

        if (!result.ok) {
          logger.error(`Anti-Spam: nie udało się zapisać ostrzeżenia dla ${member.id}: ${result.message}`);
          return 'Ostrzeżenie (błąd zapisu)';
        }

        // To ostrzeżenie może realnie oznaczać auto-ban, auto-kick albo timeout wg poziomu kary -
        // user dostaje DM i realną karę, nie tylko wpis w bazie.
        const { count, step, nextStep, isFinal } = result.data;
        const limit = steps.length;

        if (step.action === 'ban') {
          try {
            await member.ban({ reason: `Auto-ban: osiągnięto limit ostrzeżeń (${count}) - Anti-Spam` });
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
                  `⚠️ **Osiągnięto ${count}/${limit} ostrzeżeń** - zostałeś wyrzucony z serwera.`,
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
 * Extracts invite codes from a message, resolves them, and blocks invites -
 * z wyjątkiem zaproszeń do TEGO serwera, jeśli `rule.allowOwnServerInvites` jest włączone.
 *
 * @returns `true` if the message was blocked.
 */
async function checkInviteLinks(
  message: Message,
  client: Client,
  source: SpamSource,
  rule: AntiSpamRuleSettings
): Promise<boolean> {
  const matches = message.content.matchAll(INVITE_REGEX);
  const codes = [...matches].map((m) => m[1]);
  if (codes.length === 0) return false;

  for (const code of codes) {
    try {
      const invite = await client.fetchInvite(code);
      if (!invite.guild) continue; // np. zaproszenie do group DM - nie da się porównać serwera

      const isOwnServer = invite.guild.id === message.guild!.id;
      if (isOwnServer && rule.allowOwnServerInvites) continue;

      logger.warn(
        `🛡️ Anti-Spam: zablokowano zaproszenie od ${source.user.tag} ` +
          `(${source.user.id}) → ${invite.guild.name} (${invite.guild.id})`
      );

      if (rule.deleteMessage) {
        await message.delete().catch(() => {});
      }

      const actionLabel = await applyRulePunishment(message.guild!.id, client, source, 'invites', rule);

      await sendLog(client, message.guild!.id, 'antiSpam', {
        title: '🛡️ Zablokowane zaproszenie',
        description:
          sourceLines(source) +
          `**Kanał:** <#${message.channelId}>\n` +
          `**Zaproszenie do:** ${invite.guild.name} (\`${invite.guild.id}\`)\n` +
          `**Kod:** \`${code}\`\n` +
          `**Akcja:** ${actionLabel}`,
      });

      return true;
    } catch {
      // Invalid/expired invite - ignore
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
  source: SpamSource,
  rule: AntiSpamRuleSettings
): Promise<boolean> {
  const mentionedUsers = message.mentions.users.size;
  const mentionedRoles = message.mentions.roles.size;
  const totalMentions = mentionedUsers + mentionedRoles;
  const mentionsEveryone = message.mentions.everyone; // true for @everyone or @here

  if (mentionsEveryone) {
    return await blockMention(message, client, source, rule, 'Użycie @everyone / @here', '@everyone/@here');
  }

  if (totalMentions > rule.threshold) {
    return await blockMention(
      message,
      client,
      source,
      rule,
      `Zbyt wiele wzmianek (${totalMentions})`,
      `${mentionedUsers} użytkowników, ${mentionedRoles} ról`
    );
  }

  return false;
}

/**
 * Handles a blocked mention - deletes, punishes, logs.
 */
async function blockMention(
  message: Message,
  client: Client,
  source: SpamSource,
  rule: AntiSpamRuleSettings,
  reason: string,
  details: string
): Promise<boolean> {
  logger.warn(
    `🛡️ Anti-Spam: zablokowano masowe wzmianki od ${source.user.tag} ` +
      `(${source.user.id}) - ${reason}`
  );

  if (rule.deleteMessage) {
    await message.delete().catch(() => {});
  }

  const actionLabel = await applyRulePunishment(message.guild!.id, client, source, 'mentions', rule);

  await sendLog(client, message.guild!.id, 'antiSpam', {
    title: '🛡️ Zablokowane wzmianki',
    description:
      sourceLines(source) +
      `**Kanał:** <#${message.channelId}>\n` +
      `**Powód:** ${reason}\n` +
      `**Szczegóły:** ${details}\n` +
      `**Akcja:** ${actionLabel}`,
  });

  return true;
}
