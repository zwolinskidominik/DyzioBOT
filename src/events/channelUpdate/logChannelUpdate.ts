import { GuildChannel, Client, AuditLogEvent, OverwriteType } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(
  oldChannel: GuildChannel,
  newChannel: GuildChannel,
  client: Client
): Promise<void> {
  try {
    const ctx = { channelId: newChannel.id };

    const moderator = await getModerator(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);

    if (oldChannel.name !== newChannel.name) {
      await sendLog(client, newChannel.guild.id, 'channelUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano nazwę kanału <#${newChannel.id}>.**`,
        fields: [
          { name: 'Stara nazwa', value: oldChannel.name, inline: true },
          { name: 'Nowa nazwa', value: newChannel.name, inline: true },
          ...(moderator ? [moderatorField(moderator.id)] : []),
        ],
      }, ctx);
    }

    if ('topic' in oldChannel && 'topic' in newChannel) {
      if (oldChannel.topic !== newChannel.topic) {
        await sendLog(client, newChannel.guild.id, 'channelUpdate', {
          title: null,
          description: `**✏️ Zaktualizowano temat kanału <#${newChannel.id}>.**`,
          fields: [
            {
              name: 'Stary temat',
              value: ((oldChannel.topic as string | null) || '*Brak*') as string,
              inline: false,
            },
            {
              name: 'Nowy temat',
              value: ((newChannel.topic as string | null) || '*Brak*') as string,
              inline: false,
            },
            ...(moderator ? [moderatorField(moderator.id)] : []),
          ],
        }, ctx);
      }
    }

    const oldPerms = oldChannel.permissionOverwrites.cache;
    const newPerms = newChannel.permissionOverwrites.cache;

    const addedPerms = newPerms.filter((perm) => !oldPerms.has(perm.id));
    for (const perm of addedPerms.values()) {
      const allowedPerms = perm.allow.toArray();
      const deniedPerms = perm.deny.toArray();
      
      let targetMention: string;
      if (perm.type === OverwriteType.Role) {
        const role = newChannel.guild.roles.cache.get(perm.id);
        targetMention = role?.name === '@everyone' ? '@everyone' : `<@&${perm.id}>`;
      } else {
        targetMention = `<@${perm.id}>`;
      }
      
      const permList: string[] = [];
      
      if (allowedPerms.length > 0) {
        permList.push(...allowedPerms.map((p) => `✅ ${formatPermissionName(p)}`));
      }
      if (deniedPerms.length > 0) {
        permList.push(...deniedPerms.map((p) => `❌ ${formatPermissionName(p)}`));
      }

      await sendLog(client, newChannel.guild.id, 'channelPermissionUpdate', {
        title: null,
        description: `**🔐 Aktualizacja uprawnień kanału: <#${newChannel.id}>**\n\n**Permissions:**\n↘️ ${targetMention}\n${permList.length > 0 ? permList.join('\n') : '*Brak uprawnień*'}`,
        fields: moderator ? [moderatorField(moderator.id)] : [],
      }, ctx);
    }

    const removedPerms = oldPerms.filter((perm) => !newPerms.has(perm.id));
    for (const perm of removedPerms.values()) {
      let targetMention: string;
      if (perm.type === OverwriteType.Role) {
        const role = newChannel.guild.roles.cache.get(perm.id);
        targetMention = role?.name === '@everyone' ? '@everyone' : `<@&${perm.id}>`;
      } else {
        targetMention = `<@${perm.id}>`;
      }
      
      await sendLog(client, newChannel.guild.id, 'channelPermissionUpdate', {
        title: null,
        description: `**🔐 Aktualizacja uprawnień kanału: <#${newChannel.id}>**\n\n**Permissions:**\n↘️ ${targetMention}\n❌ **Usunięto wszystkie uprawnienia**`,
        fields: moderator ? [moderatorField(moderator.id)] : [],
      }, ctx);
    }

    const modifiedPerms = newPerms.filter((newPerm) => {
      const oldPerm = oldPerms.get(newPerm.id);
      return oldPerm && (oldPerm.allow.bitfield !== newPerm.allow.bitfield || oldPerm.deny.bitfield !== newPerm.deny.bitfield);
    });

    for (const newPerm of modifiedPerms.values()) {
      const oldPerm = oldPerms.get(newPerm.id)!;
      
      const addedAllows = newPerm.allow.toArray().filter((p) => !oldPerm.allow.has(p));
      const addedDenies = newPerm.deny.toArray().filter((p) => !oldPerm.deny.has(p));

      let targetMention: string;
      if (newPerm.type === OverwriteType.Role) {
        const role = newChannel.guild.roles.cache.get(newPerm.id);
        targetMention = role?.name === '@everyone' ? '@everyone' : `<@&${newPerm.id}>`;
      } else {
        targetMention = `<@${newPerm.id}>`;
      }
      
      const permList: string[] = [];
      
      if (addedAllows.length > 0) {
        permList.push(...addedAllows.map((p) => `✅ ${formatPermissionName(p)}`));
      }
      if (addedDenies.length > 0) {
        permList.push(...addedDenies.map((p) => `❌ ${formatPermissionName(p)}`));
      }

      if (permList.length === 0) continue;

      await sendLog(client, newChannel.guild.id, 'channelPermissionUpdate', {
        title: null,
        description: `**🔐 Aktualizacja uprawnień kanału: <#${newChannel.id}>**\n\n**Permissions:**\n↘️ ${targetMention}\n${permList.join('\n')}`,
        fields: moderator ? [moderatorField(moderator.id)] : [],
      }, ctx);
    }
  } catch (error) {
    logger.error(`[logChannelUpdate] Error: ${error}`);
  }
}

function formatPermissionName(permission: string): string {
  const permissionNames: Record<string, string> = {
    ViewChannel: 'View Channel',
    ManageChannels: 'Manage Channels',
    ManageRoles: 'Manage Permissions',
    ManageWebhooks: 'Manage Webhooks',
    CreateInstantInvite: 'Create Invite',
    SendMessages: 'Send Messages',
    SendMessagesInThreads: 'Send Messages in Threads',
    CreatePublicThreads: 'Create Public Threads',
    CreatePrivateThreads: 'Create Private Threads',
    EmbedLinks: 'Embed Links',
    AttachFiles: 'Attach Files',
    AddReactions: 'Add Reactions',
    UseExternalEmojis: 'Use External Emojis',
    UseExternalStickers: 'Use External Stickers',
    MentionEveryone: 'Mention Everyone',
    ManageMessages: 'Manage Messages',
    ManageThreads: 'Manage Threads',
    ReadMessageHistory: 'Read Message History',
    SendTTSMessages: 'Send TTS Messages',
    SendVoiceMessages: 'Send Voice Messages',
    UseApplicationCommands: 'Use Application Commands',
    Connect: 'Connect',
    Speak: 'Speak',
    Stream: 'Video',
    UseEmbeddedActivities: 'Use Activities',
    UseSoundboard: 'Use Soundboard',
    UseExternalSounds: 'Use External Sounds',
    UseVAD: 'Use Voice Activity',
    PrioritySpeaker: 'Priority Speaker',
    MuteMembers: 'Mute Members',
    DeafenMembers: 'Deafen Members',
    MoveMembers: 'Move Members',
  };

  return permissionNames[permission] || permission;
}
