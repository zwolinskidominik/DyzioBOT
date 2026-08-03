import { Message } from 'discord.js';
import { touchTicketActivity } from '../../services/ticketService';

/**
 * Bumps a ticket channel's last-activity timestamp on every human message,
 * so the auto-close scheduler can tell idle tickets apart from active ones.
 * No-ops (via a no-match findOneAndUpdate) for channels that aren't tickets.
 */
export default async function run(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;
  await touchTicketActivity(message.channelId);
}
