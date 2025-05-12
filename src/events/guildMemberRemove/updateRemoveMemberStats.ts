import { GuildMember } from 'discord.js';
import { debounce } from '../../utils/cooldownHelpers';
import { updateChannelStats } from '../../utils/channelHelpers';
import logger from '../../utils/logger';

export default async function run(member: GuildMember): Promise<void> {
  const { guild } = member;
  if (!guild) return;

  debounce(guild.id, async () => {
    try {
      await updateChannelStats(guild);
    } catch (error) {
      logger.error(`Błąd w debounced updateChannelStats przy opuszczeniu serwera: ${error}`);
    }
  });
}
