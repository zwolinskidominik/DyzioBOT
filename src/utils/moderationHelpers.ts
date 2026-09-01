import { EmbedBuilder, GuildMember, Guild, User, PermissionFlagsBits } from 'discord.js';
import { createBaseEmbed } from '../utils/embedHelpers';
import logger from '../utils/logger';
import prettyMs from 'pretty-ms';
import { parseDuration } from './parseDuration';

export { parseDuration };

// ── Role check (merged from roleHelpers.ts) ─────────────────────────

export type RoleCheckFailReason =
  | 'MISSING_PARAM'
  | 'TARGET_IS_OWNER'
  | 'SELF_ACTION'
  | 'TARGET_NOT_LOWER_THAN_REQUESTER'
  | 'TARGET_NOT_LOWER_THAN_BOT'
  | 'TARGET_HAS_ADMIN';

export interface RoleCheckResult {
  allowed: boolean;
  reason?: RoleCheckFailReason;
}

export function canModerate(
  targetMember: GuildMember | null | undefined,
  requestMember: GuildMember | null | undefined,
  botMember: GuildMember | null | undefined,
  /** Ustaw na true dla akcji korzystających z Discordowego timeoutu (mute) — Discord nigdy nie pozwoli wyciszyć membera z uprawnieniem Administrator, niezależnie od hierarchii ról. */
  requiresTimeout = false
): RoleCheckResult {
  if (!targetMember || !requestMember || !botMember) {
    return { allowed: false, reason: 'MISSING_PARAM' };
  }
  if (targetMember.id === targetMember.guild.ownerId) {
    return { allowed: false, reason: 'TARGET_IS_OWNER' };
  }
  if (targetMember.id === requestMember.id) {
    return { allowed: false, reason: 'SELF_ACTION' };
  }
  const targetPos = targetMember.roles.highest.position;
  const requestPos = requestMember.roles.highest.position;
  const botPos = botMember.roles.highest.position;
  if (targetPos >= requestPos) {
    return { allowed: false, reason: 'TARGET_NOT_LOWER_THAN_REQUESTER' };
  }
  if (targetPos >= botPos) {
    return { allowed: false, reason: 'TARGET_NOT_LOWER_THAN_BOT' };
  }
  if (requiresTimeout && targetMember.permissions.has(PermissionFlagsBits.Administrator)) {
    return { allowed: false, reason: 'TARGET_HAS_ADMIN' };
  }
  return { allowed: true };
}

// ── Moderation helpers ───────────────────────────────────────────────

export type ModAction = 'ban' | 'kick' | 'mute' | 'unban' | 'warn';

const ACTION_LABELS: Record<ModAction, string> = {
  ban: 'zbanować',
  kick: 'wyrzucić',
  mute: 'wyciszyć',
  unban: 'odbanować',
  warn: 'ostrzec',
};

const FAIL_MESSAGES: Record<RoleCheckFailReason, (verb: string) => string> = {
  MISSING_PARAM: () => 'Wystąpił błąd podczas sprawdzania uprawnień.',
  TARGET_IS_OWNER: (v) => `Nie możesz ${v} właściciela serwera.`,
  SELF_ACTION: (v) => `Nie możesz ${v} samego siebie.`,
  TARGET_NOT_LOWER_THAN_REQUESTER: (v) => `Nie możesz ${v} użytkownika z wyższą lub równą rolą.`,
  TARGET_NOT_LOWER_THAN_BOT: (v) => `Moja rola jest za niska, aby ${v} tego użytkownika.`,
  TARGET_HAS_ADMIN: () => 'Nie można wyciszyć użytkownika z uprawnieniem Administratora — to twarde ograniczenie Discorda, niezależne od hierarchii ról.',
};

export function getModFailMessage(
  targetMember: GuildMember,
  requestMember: GuildMember,
  botMember: GuildMember | null,
  action: ModAction
): string | null {
  if (!botMember) return FAIL_MESSAGES.MISSING_PARAM(ACTION_LABELS[action]);
  // Tylko /mute korzysta wyłącznie z timeoutu — blokujemy z góry, bo bez niego komenda nic nie robi.
  // /warn ma timeout jako efekt uboczny drabinki kar, więc samo ostrzeżenie i tak ma sens zapisać
  // (patrz warn.ts — tam błąd nałożenia timeoutu jest łapany osobno i widoczny w odpowiedzi/logu).
  const requiresTimeout = action === 'mute';
  const result = canModerate(targetMember, requestMember, botMember, requiresTimeout);
  if (result.allowed) return null;
  return FAIL_MESSAGES[result.reason!](ACTION_LABELS[action]);
}

export interface TimeoutAttemptResult {
  /** Unix timestamp (sekundy) końca timeoutu — ustawiony tylko gdy timeout faktycznie się udał. */
  muteEndTs: number | null;
  /** true gdy próbowaliśmy nałożyć timeout i się nie udało (np. target ma uprawnienie Administratora). */
  muteFailed: boolean;
}

/**
 * Bezpiecznie nakłada timeout: najpierw sprawdza `member.moderatable` (discord.js — uwzględnia
 * uprawnienie Administratora, którego Discord nigdy nie pozwoli wyciszyć niezależnie od hierarchii
 * ról), żeby uniknąć gwarantowanego DiscordAPIError[50013]. Współdzielone przez `/warn` i
 * automatyczne ostrzeżenie z Anti-Spam — oba korzystają z tej samej drabinki kar (`warnService`).
 */
export async function applyTimeoutSafely(
  member: GuildMember,
  durationMs: number,
  reason: string
): Promise<TimeoutAttemptResult> {
  if (durationMs <= 0) return { muteEndTs: null, muteFailed: false };

  if (!member.moderatable) {
    logger.warn(
      `Nie można nałożyć timeoutu na ${member.id} — member.moderatable === false (prawdopodobnie uprawnienie Administratora).`
    );
    return { muteEndTs: null, muteFailed: true };
  }

  try {
    await member.timeout(durationMs, reason);
    return { muteEndTs: Math.floor((Date.now() + durationMs) / 1000), muteFailed: false };
  } catch (err) {
    logger.error(`Błąd przy nakładaniu kary na ${member.id}: ${err}`);
    return { muteEndTs: null, muteFailed: true };
  }
}

export function createModErrorEmbed(description: string, guildName?: string): EmbedBuilder {
  return createBaseEmbed({
    isError: true,
    description: description ? `**${description}**` : '',
    footerText: guildName,
  });
}

export function createModSuccessEmbed(
  action: ModAction,
  target: User,
  moderator: User,
  guildIcon: string | null | undefined,
  guildName: string,
  reason?: string,
  duration?: string
): EmbedBuilder {
  const actionDescriptions: Record<ModAction, string> = {
    ban: `### Zbanowano użytkownika <@!${target.id}>`,
    kick: `### Wyrzucono użytkownika <@!${target.id}>`,
    mute: duration
      ? `**<@!${target.id}> został wyciszony na okres ${duration}**`
      : `**<@!${target.id}> został wyciszony**`,
    unban: `### Odbanowano użytkownika <@!${target.id}>`,
    warn: `### Ostrzeżono użytkownika <@!${target.id}>`,
  };

  const embed = createBaseEmbed({
    isError: false,
    description: actionDescriptions[action],
    thumbnail: target.displayAvatarURL(),
    footerText: guildName,
    footerIcon: guildIcon || undefined,
  });

  embed.addFields({ name: 'Moderator', value: `<@!${moderator.id}>`, inline: true });
  if (reason && action !== 'unban') embed.addFields({ name: 'Powód', value: reason, inline: true });
  if (duration && action === 'mute')
    embed.addFields({ name: 'Czas', value: duration, inline: true });
  return embed;
}

export function formatHumanDuration(durationMs: number): string {
  return prettyMs(durationMs, { verbose: false });
}

function pluralPl(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

/** Formatuje czas trwania po polsku z poprawną odmianą (np. "15 minut", "2 godziny", "1 dzień"). */
export function formatDurationPl(durationMs: number): string {
  const totalMinutes = Math.max(1, Math.round(durationMs / 60_000));

  if (totalMinutes < 60) {
    return `${totalMinutes} ${pluralPl(totalMinutes, 'minutę', 'minuty', 'minut')}`;
  }

  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 24) {
    return `${totalHours} ${pluralPl(totalHours, 'godzinę', 'godziny', 'godzin')}`;
  }

  const totalDays = Math.round(totalHours / 24);
  return `${totalDays} ${pluralPl(totalDays, 'dzień', 'dni', 'dni')}`;
}

export async function findBannedUser(guild: Guild, userId: string): Promise<User | null> {
  try {
    const existing = guild.bans.cache.get(userId as `${bigint}`);
    if (existing) return existing.user;
    const ban = await guild.bans.fetch(userId).catch(() => null);
    return ban?.user ?? null;
  } catch (error) {
    logger.error(
      `Błąd podczas sprawdzania bana użytkownika ${userId} na guild=${guild.id}: ${error}`
    );
    return null;
  }
}
