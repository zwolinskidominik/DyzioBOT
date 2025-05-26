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
        greetings: { bye: byeEmoji },
      },
    } = getBotConfig(botId);
    const config = await GreetingsConfigurationModel.findOne({ guildId: guild.id });
    if (!config?.greetingsChannelId) return;
    const channel = guild.channels.cache.get(config.greetingsChannelId);
    if (!channel || !('send' in channel)) return;
    await Font.loadDefault();
    const avatar = member.user.displayAvatarURL({ extension: 'png', forceStatic: true });
    const card = new GreetingsCard()
      .setAvatar(avatar)
      .setDisplayName(member.user.tag)
      .setType('goodbye')
      .setMessage('Miło, że wpadłeś/aś. 👌');
    const image = await card.build({ format: 'png' });
    const attachment = new AttachmentBuilder(image, { name: 'goodbye.png' });
    const embed = createBaseEmbed({
      description: `### Żegnaj <@!${member.user.id}>! ${byeEmoji}`,
      image: 'attachment://goodbye.png',
      color: COLORS.LEAVE,
      timestamp: false,
    });
    await channel.send({ embeds: [embed], files: [attachment] });
  } catch (error) {
    logger.error(`Błąd w goodbyeCard.ts przy userId=${member?.user?.id}: ${error}`);
  }
}
