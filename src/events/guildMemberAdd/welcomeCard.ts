import { GuildMember, AttachmentBuilder } from 'discord.js';
import { GreetingsConfigurationModel } from '../../models/GreetingsConfiguration';
import { GreetingsCard } from '../../utils/cardHelpers';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';
import { Font } from 'canvacord';
import { getBotConfig } from '../../config/bot';

export default async function run(member: GuildMember): Promise<void> {
  try {
    const guild = member.guild;
    const botId = member.client.user?.id;
    if (!guild) return;

    const {
      emojis: {
        greetings: { hi: hiEmoji },
      },
    } = getBotConfig(botId);

    const config = await GreetingsConfigurationModel.findOne({ guildId: guild.id });
    if (!config?.greetingsChannelId) return;
    const channel = guild.channels.cache.get(config.greetingsChannelId);
    if (!channel || !('send' in channel)) return;
    await Font.loadDefault();
    const avatar = member.user.displayAvatarURL({
      extension: 'png',
      forceStatic: true,
    });
    const card = new GreetingsCard()
      .setAvatar(avatar)
      .setDisplayName(member.user.tag)
      .setType('welcome')
      .setMessage(`Jesteś ${guild.memberCount} osóbką na serwerze!`);
    const image = await card.build({ format: 'png' });
    const attachment = new AttachmentBuilder(image, { name: 'welcome.png' });
    const embed = createBaseEmbed({
      description: `### Siema <@!${member.user.id}>! ${hiEmoji} ###\nWitaj na serwerze ${guild.name}! 🕹️`,
      image: 'attachment://welcome.png',
      color: COLORS.JOIN,
      timestamp: false,
    });
    await channel.send({ embeds: [embed], files: [attachment] });
  } catch (error) {
    logger.error(`Błąd w welcomeCard.ts przy userId=${member?.user?.id}: ${error}`);
  }
}
