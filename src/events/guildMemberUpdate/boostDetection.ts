import { Guild, GuildMember, TextChannel } from 'discord.js';
import { getGuildConfig } from '../../config/guild';
import logger from '../../utils/logger';
import { promises as fs } from 'fs';
import * as path from 'path';

const BANNER_PATH = path.join(__dirname, '../../../assets/boosterBanner.png');

export default async function run(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
  const oldStatus = oldMember.premiumSince;
  const newStatus = newMember.premiumSince;

  const {
    channels: { boostNotification },
    emojis: {
      boost: { thanks: thanksEmoji },
    },
  } = getGuildConfig(newMember.guild.id);

  if (!oldStatus && newStatus) {
    const boostChannel = newMember.guild.channels.cache.get(boostNotification);
    if (boostChannel && 'send' in boostChannel) {
      await (boostChannel as TextChannel).send(
        `Dzięki za wsparcie! <@!${newMember.user.id}>, właśnie dołączyłeś/aś do grona naszych boosterów! ${thanksEmoji}`
      );
    }

    await updateBoosterList(newMember.guild);
  }

  if (oldStatus && !newStatus) {
    await updateBoosterList(newMember.guild);
  }
}

async function updateBoosterList(guild: Guild): Promise<void> {
  const {
    channels: { boosterList },
    emojis: {
      boost: { list: listEmoji },
    },
  } = getGuildConfig(guild.id);

  const boosters = guild.members.cache
    .filter((member) => member.premiumSince)
    .map((member) => `${listEmoji} <@!${member.user.id}>`)
    .join('\n');

  const channel = guild.channels.cache.get(boosterList);
  if (!channel) {
    logger.error('Nie znaleziono kanału do aktualizacji listy boosterów!');
    return;
  }

  const textChannel = channel as TextChannel;

  try {
    await fs.access(BANNER_PATH);

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
