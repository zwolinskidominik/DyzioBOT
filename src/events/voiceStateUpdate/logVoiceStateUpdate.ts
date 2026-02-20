import { VoiceState, Client, AuditLogEvent } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(
  oldState: VoiceState,
  newState: VoiceState,
  client: Client
): Promise<void> {
  try {
    const member = newState.member || oldState.member;
    if (!member) return;

    const ctx = { userId: member.id, member };

    if (!oldState.channel && newState.channel) {
      await sendLog(client, newState.guild.id, 'voiceJoin', {
        title: null,
        description: `**🔊 <@${member.id}> dołączył na kanał głosowy <#${newState.channelId}>.**`,
        authorName: member.user.tag,
        authorIcon: member.user.displayAvatarURL({ size: 64 }),
        footer: `User ID: ${member.id} | Channel ID: ${newState.channelId}`,
        timestamp: new Date(),
      }, ctx);
    }

    if (oldState.channel && !newState.channel) {
      const moderator = await getModerator(
        oldState.guild,
        AuditLogEvent.MemberDisconnect,
        member.id
      );

      if (moderator) {
        await sendLog(client, oldState.guild.id, 'voiceDisconnect', {
          title: null,
          description: `**⚡ <@${member.id}> został odłączony od kanału głosowego <#${oldState.channelId}> przez <@${moderator.id}>.**`,
          authorName: member.user.tag,
          authorIcon: member.user.displayAvatarURL({ size: 64 }),
          footer: `User ID: ${member.id} | Channel ID: ${oldState.channelId}`,
          timestamp: new Date(),
        }, ctx);
      } else {
        await sendLog(client, oldState.guild.id, 'voiceLeave', {
          title: null,
          description: `**🔇 <@${member.id}> opuścił kanał głosowy <#${oldState.channelId}>.**`,
          authorName: member.user.tag,
          authorIcon: member.user.displayAvatarURL({ size: 64 }),
          footer: `User ID: ${member.id} | Channel ID: ${oldState.channelId}`,
          timestamp: new Date(),
        }, ctx);
      }
    }

    if (oldState.channel && newState.channel && oldState.channelId !== newState.channelId) {
      const moderator = await getModerator(
        newState.guild,
        AuditLogEvent.MemberMove,
        member.id
      );

      if (moderator) {
        await sendLog(client, newState.guild.id, 'voiceMemberMove', {
          title: null,
          description: `**👉 <@${member.id}> został przeniesiony z <#${oldState.channelId}> na <#${newState.channelId}> przez <@${moderator.id}>.**`,
          authorName: member.user.tag,
          authorIcon: member.user.displayAvatarURL({ size: 64 }),
          footer: `User ID: ${member.id}`,
          timestamp: new Date(),
        }, ctx);
      } else {
        await sendLog(client, newState.guild.id, 'voiceMove', {
          title: null,
          description: `**🔀 <@${member.id}> przeniósł się z kanału <#${oldState.channelId}> na <#${newState.channelId}>.**`,
          authorName: member.user.tag,
          authorIcon: member.user.displayAvatarURL({ size: 64 }),
          footer: `User ID: ${member.id}`,
          timestamp: new Date(),
        }, ctx);
      }
    }

    if (oldState.channel && newState.channel && oldState.channelId === newState.channelId) {
      const stateChanges: string[] = [];

      if (oldState.serverMute !== newState.serverMute) {
        stateChanges.push(newState.serverMute ? '🔇 Wyciszony przez serwer' : '🔊 Odciszony przez serwer');
      }
      if (oldState.serverDeaf !== newState.serverDeaf) {
        stateChanges.push(newState.serverDeaf ? '🔇 Ogłuszony przez serwer' : '🔊 Odgłuszony przez serwer');
      }
      if (oldState.selfMute !== newState.selfMute) {
        stateChanges.push(newState.selfMute ? '🔇 Wyciszył mikrofon' : '🔊 Włączył mikrofon');
      }
      if (oldState.selfDeaf !== newState.selfDeaf) {
        stateChanges.push(newState.selfDeaf ? '🔇 Ogłuszył się' : '🔊 Odgłuszył się');
      }
      if (oldState.streaming !== newState.streaming) {
        stateChanges.push(newState.streaming ? '📡 Rozpoczął stream' : '📡 Zakończył stream');
      }
      if (oldState.selfVideo !== newState.selfVideo) {
        stateChanges.push(newState.selfVideo ? '📹 Włączył kamerę' : '📹 Wyłączył kamerę');
      }

      if (stateChanges.length > 0) {
        await sendLog(client, newState.guild.id, 'voiceStateChange', {
          title: null,
          description: `**🎤 <@${member.id}> zmienił stan głosu na <#${newState.channelId}>.**\n${stateChanges.map(s => `• ${s}`).join('\n')}`,
          authorName: member.user.tag,
          authorIcon: member.user.displayAvatarURL({ size: 64 }),
          footer: `User ID: ${member.id}`,
          timestamp: new Date(),
        }, ctx);
      }
    }
  } catch (error) {
    logger.error(`[logVoiceStateUpdate] Error: ${error}`);
  }
}
