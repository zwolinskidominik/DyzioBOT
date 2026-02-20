import { Message } from 'discord.js';
import { trackMessage } from '../../services/xpService';
import monthlyStatsCache from '../../cache/monthlyStatsCache';

export default async function run(message: Message) {
  if (message.author.bot || !message.guild || !message.member) return;

  const tracked = await trackMessage(
    message.guild.id,
    message.author.id,
    message.channelId,
    message.member,
  );

  if (tracked) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    monthlyStatsCache.addMessage(message.guild.id, message.author.id, currentMonth);
  }
}
