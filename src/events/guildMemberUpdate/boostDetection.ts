import type { GuildMember, TextChannel } from 'discord.js';
import { getGuildConfig } from '../../config/guild';
import { getBotConfig } from '../../config/bot';

export default async function run(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
  const oldStatus = oldMember.premiumSince;
  const newStatus = newMember.premiumSince;

  const guildCfg = getGuildConfig(newMember.guild.id);
  const botCfg = getBotConfig(newMember.client.user.id);

  const boostNotification = guildCfg.channels.boostNotification;
  const thanksEmoji = botCfg.emojis.boost.thanks;

  if (!oldStatus && newStatus) {
    const boostChannel = newMember.guild.channels.cache.get(boostNotification);
    if (boostChannel && 'send' in boostChannel) {
      await (boostChannel as TextChannel).send(
        `Dzięki za wsparcie! <@!${newMember.user.id}>, właśnie dołączyłeś/aś do grona naszych boosterów! ${thanksEmoji}`
      );
    }
  }
}
