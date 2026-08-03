import { AttachmentBuilder, TextChannel } from 'discord.js';
import { closeTicket, getTranscriptDestination } from '../services/ticketService';
import { buildTranscriptBuffer } from './ticketTranscript';
import logger from './logger';

/**
 * Single source of truth for closing a ticket channel: optionally generates
 * and posts a transcript, removes the TicketState record, then deletes the
 * channel. Used both by the manual "confirm close" button flow and by the
 * auto-close scheduler, so the two paths can never drift apart.
 */
export async function finalizeTicketClosure(channel: TextChannel, reason: string): Promise<void> {
  try {
    const destination = await getTranscriptDestination(channel.guild.id);
    if (destination) {
      await sendTranscript(channel, destination.transcriptChannelId, reason);
    }
  } catch (err) {
    logger.warn(`[TICKET] Nie udało się wygenerować transkryptu dla kanału ${channel.id}: ${err}`);
  }

  await closeTicket(channel.id);

  try {
    await channel.delete();
  } catch (err) {
    logger.warn(`[TICKET] Nie udało się usunąć kanału ticketu ${channel.id}: ${err}`);
  }
}

async function sendTranscript(
  channel: TextChannel,
  transcriptChannelId: string,
  reason: string,
): Promise<void> {
  const logChannel = channel.guild.channels.cache.get(transcriptChannelId);
  if (!logChannel || !logChannel.isTextBased()) return;

  const buffer = await buildTranscriptBuffer(channel);
  const attachment = new AttachmentBuilder(buffer, { name: `transkrypt-${channel.name}.txt` });

  await logChannel.send({
    content: `📄 Transkrypt zamkniętego ticketu **#${channel.name}** — ${reason}`,
    files: [attachment],
  });
}
