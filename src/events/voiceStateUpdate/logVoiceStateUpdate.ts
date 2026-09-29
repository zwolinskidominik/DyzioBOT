import { VoiceState, Client, AuditLogEvent } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

/**
 * Zwraca odwołanie do kanału głosowego nadające się do wstawienia w treść logu.
 *
 * Wzmianka `<#id>` jest wygodna, bo klikalna, ale Discord rozwiązuje ją dopiero w momencie
 * WYŚWIETLANIA embeda — nie w momencie wysłania. Kanały tymczasowe (tempChannel.ts) są kasowane
 * zaraz po wyjściu ostatniej osoby, więc zanim log dotrze do odbiorcy, kanału już nie ma i
 * zamiast nazwy widać "nieznane".
 *
 * Nie da się przewidzieć, czy kanał przetrwa, ale cleanup usuwa go dokładnie wtedy, gdy zrobi
 * się pusty. Dlatego dla pustego kanału wstawiamy zapamiętaną nazwę (czytelną niezależnie od
 * tego, czy kanał zaraz zniknie), a dla kanału, w którym ktoś został, zostawiamy wzmiankę.
 */
function channelRef(state: VoiceState): string {
  const channel = state.channel;
  if (!channel) return '**nieznany kanał**';
  // `?.` celowo: helper jest wołany w trakcie budowania treści logu, więc wyjątek tutaj
  // (np. przy niepełnym obiekcie kanału) zabiłby cały wpis. Brak danych o członkach → wzmianka.
  return channel.members?.size === 0 ? `**${channel.name}**` : `<#${channel.id}>`;
}

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
        description: `**🔊 <@${member.id}> dołączył do kanału głosowego <#${newState.channelId}>.**`,
        authorName: member.user.tag,
        authorIcon: member.user.displayAvatarURL({ size: 64 }),
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
          description: `**⚡ <@${member.id}> został odłączony od kanału głosowego ${channelRef(oldState)}.**`,
          fields: [moderatorField(moderator.id)],
          authorName: member.user.tag,
          authorIcon: member.user.displayAvatarURL({ size: 64 }),
        }, ctx);
      } else {
        await sendLog(client, oldState.guild.id, 'voiceLeave', {
          title: null,
          description: `**🔇 <@${member.id}> wyszedł z kanału głosowego ${channelRef(oldState)}.**`,
          authorName: member.user.tag,
          authorIcon: member.user.displayAvatarURL({ size: 64 }),
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
          description: `**👉 <@${member.id}> został przeniesiony z ${channelRef(oldState)} na <#${newState.channelId}>.**`,
          fields: [moderatorField(moderator.id)],
          authorName: member.user.tag,
          authorIcon: member.user.displayAvatarURL({ size: 64 }),
        }, ctx);
      } else {
        await sendLog(client, newState.guild.id, 'voiceMove', {
          title: null,
          description: `**🔀 <@${member.id}> przeniósł się z kanału ${channelRef(oldState)} na <#${newState.channelId}>.**`,
          authorName: member.user.tag,
          authorIcon: member.user.displayAvatarURL({ size: 64 }),
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
        }, ctx);
      }
    }
  } catch (error) {
    logger.error(`[logVoiceStateUpdate] Error: ${error}`);
  }
}
