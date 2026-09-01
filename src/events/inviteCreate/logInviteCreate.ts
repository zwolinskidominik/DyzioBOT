import { Invite, Client } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import logger from '../../utils/logger';

export default async function run(invite: Invite, client: Client): Promise<void> {
  try {
    if (!invite.guild) return;

    const inviter = invite.inviter;

    const expiresAt = invite.expiresTimestamp
      ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>`
      : 'Nigdy';

    await sendLog(client, invite.guild.id, 'inviteCreate', {
      title: null,
      description: `**📨 Utworzono zaproszenie.**`,
      fields: [
        {
          name: '🔗 Kod',
          value: invite.code,
          inline: true,
        },
        {
          name: '📁 Kanał',
          value: invite.channel ? `<#${invite.channelId}>` : '*Nieznany*',
          inline: true,
        },
        {
          name: '⏰ Wygasa',
          value: expiresAt,
          inline: true,
        },
        {
          name: '🔢 Maksymalne użycia',
          value: invite.maxUses ? `${invite.maxUses}` : 'Nielimitowane',
          inline: true,
        },
        ...(inviter ? [{ name: 'Zaproszający', value: `<@${inviter.id}>`, inline: true }] : []),
      ],
    }, { channelId: invite.channelId ?? undefined, userId: inviter?.id });
  } catch (error) {
    logger.error(`[logInviteCreate] Error: ${error}`);
  }
}
