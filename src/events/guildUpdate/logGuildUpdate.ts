import { Guild, Client, AuditLogEvent } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(
  oldGuild: Guild,
  newGuild: Guild,
  client: Client
): Promise<void> {
  try {
    const moderator = await getModerator(newGuild, AuditLogEvent.GuildUpdate);
    const modFields = moderator ? [moderatorField(moderator.id)] : [];

    if (oldGuild.name !== newGuild.name) {
      await sendLog(client, newGuild.id, 'guildUpdate', {
        title: null,
        description: `**🏠 Zaktualizowano nazwę serwera.**`,
        fields: [
          { name: 'Stara nazwa', value: oldGuild.name, inline: true },
          { name: 'Nowa nazwa', value: newGuild.name, inline: true },
          ...modFields,
        ],
      });
    }

    if (oldGuild.icon !== newGuild.icon) {
      await sendLog(client, newGuild.id, 'guildUpdate', {
        title: null,
        description: `**🏠 Zaktualizowano ikonę serwera.**`,
        fields: modFields,
        image: newGuild.iconURL({ size: 256 }) || undefined,
      });
    }

    if (oldGuild.banner !== newGuild.banner) {
      await sendLog(client, newGuild.id, 'guildUpdate', {
        title: null,
        description: `**🏠 Zaktualizowano banner serwera.**`,
        fields: modFields,
        image: newGuild.bannerURL({ size: 512 }) || undefined,
      });
    }

    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      const levels = ['Brak', 'Niski', 'Średni', 'Wysoki', 'Najwyższy'];
      await sendLog(client, newGuild.id, 'guildUpdate', {
        title: null,
        description: `**🏠 Zaktualizowano poziom weryfikacji.**`,
        fields: [
          { name: 'Stary poziom', value: levels[oldGuild.verificationLevel], inline: true },
          { name: 'Nowy poziom', value: levels[newGuild.verificationLevel], inline: true },
          ...modFields,
        ],
      });
    }

    if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
      await sendLog(client, newGuild.id, 'guildUpdate', {
        title: null,
        description: `**🏠 Zaktualizowano systemowy kanał powiadomień.**`,
        fields: [
          { name: 'Stary kanał', value: oldGuild.systemChannelId ? `<#${oldGuild.systemChannelId}>` : '*Brak*', inline: true },
          { name: 'Nowy kanał', value: newGuild.systemChannelId ? `<#${newGuild.systemChannelId}>` : '*Brak*', inline: true },
          ...modFields,
        ],
      });
    }
  } catch (error) {
    logger.error(`[logGuildUpdate] Error: ${error}`);
  }
}
