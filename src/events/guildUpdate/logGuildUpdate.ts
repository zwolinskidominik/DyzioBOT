import { Guild, Client, AuditLogEvent } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(
  oldGuild: Guild,
  newGuild: Guild,
  client: Client
): Promise<void> {
  try {
    const moderator = await getModerator(newGuild, AuditLogEvent.GuildUpdate);

    if (oldGuild.name !== newGuild.name) {
      await sendLog(client, newGuild.id, 'guildUpdate', {
        title: null,
        description: `**🏠 Zaktualizowano nazwę serwera${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        fields: [
          { name: '📝 Poprzednia nazwa', value: oldGuild.name, inline: true },
          { name: '📝 Nowa nazwa', value: newGuild.name, inline: true },
        ],
        footer: `Guild ID: ${newGuild.id}`,
        timestamp: new Date(),
      });
    }

    if (oldGuild.icon !== newGuild.icon) {
      await sendLog(client, newGuild.id, 'guildUpdate', {
        title: null,
        description: `**🏠 Zaktualizowano ikonę serwera${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        image: newGuild.iconURL({ size: 256 }) || undefined,
        footer: `Guild ID: ${newGuild.id}`,
        timestamp: new Date(),
      });
    }

    if (oldGuild.banner !== newGuild.banner) {
      await sendLog(client, newGuild.id, 'guildUpdate', {
        title: null,
        description: `**🏠 Zaktualizowano banner serwera${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        image: newGuild.bannerURL({ size: 512 }) || undefined,
        footer: `Guild ID: ${newGuild.id}`,
        timestamp: new Date(),
      });
    }

    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      const levels = ['Brak', 'Niski', 'Średni', 'Wysoki', 'Najwyższy'];
      await sendLog(client, newGuild.id, 'guildUpdate', {
        title: null,
        description: `**🏠 Zaktualizowano poziom weryfikacji${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        fields: [
          { name: '🔒 Poprzedni poziom', value: levels[oldGuild.verificationLevel], inline: true },
          { name: '🔒 Nowy poziom', value: levels[newGuild.verificationLevel], inline: true },
        ],
        footer: `Guild ID: ${newGuild.id}`,
        timestamp: new Date(),
      });
    }

    if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
      await sendLog(client, newGuild.id, 'guildUpdate', {
        title: null,
        description: `**🏠 Zaktualizowano systemowy kanał powiadomień${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        fields: [
          { name: '📢 Poprzedni kanał', value: oldGuild.systemChannelId ? `<#${oldGuild.systemChannelId}>` : '*Brak*', inline: true },
          { name: '📢 Nowy kanał', value: newGuild.systemChannelId ? `<#${newGuild.systemChannelId}>` : '*Brak*', inline: true },
        ],
        footer: `Guild ID: ${newGuild.id}`,
        timestamp: new Date(),
      });
    }
  } catch (error) {
    logger.error(`[logGuildUpdate] Error: ${error}`);
  }
}
