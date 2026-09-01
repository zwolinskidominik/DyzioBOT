import { GuildMember, Client, AuditLogEvent, AuditLogChange } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator, getAuditLogEntry } from '../../utils/auditLogHelpers';
import { formatDurationPl } from '../../utils/moderationHelpers';
import logger from '../../utils/logger';

/** Audit log entry dla timeoutu bywa dostępny z opóźnieniem — szersze okno niż domyślne 5s, żeby moderator nie ginął. */
const TIMEOUT_AUDIT_LOG_MAX_AGE_MS = 15_000;

/** Zawężenie typu dla wpisu audit logu opisującego zmianę pseudonimu (`key: 'nick'`). */
function isNickChange(change: AuditLogChange): change is Extract<AuditLogChange, { key: 'nick' }> {
  return change.key === 'nick';
}

export default async function run(
  oldMember: GuildMember,
  newMember: GuildMember,
  client: Client
): Promise<void> {
  try {
    const ctx = { userId: newMember.id, member: newMember };

    if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
      const moderator = await getModerator(
        newMember.guild,
        AuditLogEvent.MemberUpdate,
        newMember.id,
        TIMEOUT_AUDIT_LOG_MAX_AGE_MS
      );

      if (newMember.communicationDisabledUntil && newMember.communicationDisabledUntil > new Date()) {
        const durationMs = newMember.communicationDisabledUntil.getTime() - Date.now();
        await sendLog(client, newMember.guild.id, 'memberTimeout', {
          title: null,
          description: `**🔇 <@${newMember.id}> został wyciszony na czas ${formatDurationPl(durationMs)}.**`,
          fields: moderator ? [moderatorField(moderator.id)] : [],
          authorName: newMember.user.tag,
          authorIcon: newMember.user.displayAvatarURL({ size: 64 }),
          thumbnail: newMember.user.displayAvatarURL({ size: 256 }),
        }, ctx);
      } else {
        await sendLog(client, newMember.guild.id, 'memberTimeout', {
          title: null,
          description: `**🔊 Usunięto timeout dla <@${newMember.id}>.**`,
          fields: moderator ? [moderatorField(moderator.id)] : [],
          authorName: newMember.user.tag,
          authorIcon: newMember.user.displayAvatarURL({ size: 64 }),
          thumbnail: newMember.user.displayAvatarURL({ size: 256 }),
        }, ctx);
      }
    }

    if (oldMember.nickname !== newMember.nickname) {
      // Cache membera bywa "zimny" (np. tuż po restarcie bota) — oldMember.nickname może być
      // nieprawidłowo puste, mimo że user miał wcześniej pseudonim. Audit log ma dokładny
      // zapis zmiany (nawet własnej), niezależny od stanu cache'a i bez ryzyka rate limitu
      // pełnego guild.members.fetch().
      const nickEntry = await getAuditLogEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      const nickChange = nickEntry?.changes.find(isNickChange);

      const oldNick = nickChange?.old ?? oldMember.nickname ?? undefined;
      const newNick = nickChange?.new ?? newMember.nickname ?? undefined;

      await sendLog(client, newMember.guild.id, 'memberNicknameChange', {
        title: null,
        description: `**📝 <@${newMember.id}> zmienił pseudonim.**`,
        authorName: newMember.user.tag,
        authorIcon: newMember.user.displayAvatarURL({ size: 64 }),
        fields: [
          {
            name: 'Stary',
            value: oldNick || '*Brak*',
            inline: true,
          },
          {
            name: 'Nowy',
            value: newNick || '*Brak*',
            inline: true,
          },
        ],
      }, ctx);
    }

    const addedRoles = newMember.roles.cache.filter(
      (role) => !oldMember.roles.cache.has(role.id)
    );
    const removedRoles = oldMember.roles.cache.filter(
      (role) => !newMember.roles.cache.has(role.id)
    );

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const roleModerator = await getModerator(
        newMember.guild,
        AuditLogEvent.MemberRoleUpdate,
        newMember.id
      );

      for (const role of addedRoles.values()) {
        await sendLog(client, newMember.guild.id, 'memberRoleAdd', {
          title: null,
          description: `**➕ Rola użytkownika <@${newMember.id}> została zaktualizowana.**`,
          fields: [
            { name: 'Role', value: `✅ <@&${role.id}>`, inline: false },
            ...(roleModerator ? [moderatorField(roleModerator.id)] : []),
          ],
          authorName: newMember.user.tag,
          authorIcon: newMember.user.displayAvatarURL({ size: 64 }),
        }, ctx);
      }

      for (const role of removedRoles.values()) {
        await sendLog(client, newMember.guild.id, 'memberRoleRemove', {
          title: null,
          description: `**➖ Rola użytkownika <@${newMember.id}> została zaktualizowana.**`,
          fields: [
            { name: 'Role', value: `❌ <@&${role.id}>`, inline: false },
            ...(roleModerator ? [moderatorField(roleModerator.id)] : []),
          ],
          authorName: newMember.user.tag,
          authorIcon: newMember.user.displayAvatarURL({ size: 64 }),
        }, ctx);
      }
    }
  } catch (error) {
    logger.error(`[logMemberUpdate] Error: ${error}`);
  }
}
