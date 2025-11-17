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

    // await updateBoosterList(newMember.guild);
  }

  if (oldStatus && !newStatus) {
    // await updateBoosterList(newMember.guild);
  }
}

/*
async function updateBoosterList(guild: Guild): Promise<void> {
  const guildCfg = getGuildConfig(guild.id);
  const botCfg = getBotConfig(guild.client.user.id);

  const boosterListChannel = guildCfg.channels.boosterList;
  const listEmoji = botCfg.emojis.boost.list;

  const boosters = guild.members.cache
    .filter((member) => member.premiumSince)
    .map((member) => `${listEmoji} <@!${member.user.id}>`)
    .join('\n');

  const channel = guild.channels.cache.get(boosterListChannel);
  if (!channel) {
    logger.error('Nie znaleziono kanału do aktualizacji listy boosterów!');
    return;
  }

  const textChannel = channel as TextChannel;

  try {
  await fsAccess(BANNER_PATH);

    const messages = await textChannel.messages.fetch({ limit: 10 });
    const botMessages = messages.filter((msg) => msg.author.id === guild.client.user?.id);

    for (const msg of botMessages.values()) {
      if (msg.attachments.size > 0 || msg.content.includes(listEmoji)) {
        try {
          await msg.delete();
        } catch (deleteError) {
          logger.warn(`Nie można usunąć starej wiadomości: ${deleteError}`);
        }
      }
    }

    const bannerMessage = {
      files: [{ attachment: BANNER_PATH, name: 'boosterBanner.png' }],
    };
    await textChannel.send(bannerMessage);

    const boosterListMessage = { content: boosters };
    await textChannel.send(boosterListMessage);
  } catch (error) {
    logger.error(`Wystąpił błąd przy boosterList: ${error}`);
    await textChannel.send({ content: boosters });
  }
}
*/
