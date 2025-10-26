import { GuildMember, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { GreetingsConfigurationModel } from '../../models/GreetingsConfiguration';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';
import fs from 'fs';
import path from 'path';

function getRandomLobbyGif(): { attachment: AttachmentBuilder; name: string } | null {
  try {
    const gifsDir = path.join(process.cwd(), 'assets', 'lobby');
    
    if (!fs.existsSync(gifsDir)) {
      logger.warn(`Folder assets/lobby nie istnieje`);
      return null;
    }

    const gifFiles = fs.readdirSync(gifsDir).filter(file => file.toLowerCase().endsWith('.gif'));
    
    if (gifFiles.length === 0) {
      logger.warn(`Brak plików GIF w folderze assets/lobby`);
      return null;
    }

    const randomGif = gifFiles[Math.floor(Math.random() * gifFiles.length)];
    const gifPath = path.join(gifsDir, randomGif);
    const attachment = new AttachmentBuilder(gifPath, { name: 'welcome.gif' });
    
    return { attachment, name: 'welcome.gif' };
  } catch (error) {
    logger.error(`Błąd ładowania GIF z assets/lobby: ${error}`);
    return null;
  }
}

export default async function run(member: GuildMember): Promise<void> {
  try {
    const guild = member.guild;
    if (!guild) return;

    const config = await GreetingsConfigurationModel.findOne({ guildId: guild.id });
    if (!config?.greetingsChannelId || !config.welcomeEnabled) return;
    
    const channel = guild.channels.cache.get(config.greetingsChannelId);
    if (!channel || !('send' in channel)) return;

    const gifData = getRandomLobbyGif();
    const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });

    const rulesChannelId = config.rulesChannelId || 'CHANNEL_ID_REGULAMIN';
    const chatChannelId = config.chatChannelId || 'CHANNEL_ID_CHAT';

    const embed = new EmbedBuilder()
      .setColor(COLORS.JOIN)
      .setDescription(
        `### Witaj <@${member.user.id}> na ${member.guild.name}\n\n` +
        `**Witamy na pokładzie!**\n` +
        `Gratulacje, właśnie wbiłeś/aś do miejsca, w którym gry są poważniejsze niż życie… prawie.\n\n` +
        `➔ Przeczytaj <#${rulesChannelId}>\n` +
        `➔ Spersonalizuj swój profil <id:customize>\n` +
        `➔ Przywitaj się z nami <#${chatChannelId}>\n\n` +
        `**Rozgość się i znajdź ekipę do grania.**`
      )
      .setThumbnail(avatar);

    if (gifData) {
      embed.setImage(`attachment://${gifData.name}`);
      await channel.send({ 
        content: `<@${member.user.id}>`, 
        embeds: [embed], 
        files: [gifData.attachment] 
      });
    } else {
      await channel.send({ content: `<@${member.user.id}>`, embeds: [embed] });
    }
  } catch (error) {
    logger.error(`Błąd w welcomeCard.ts przy userId=${member?.user?.id}: ${error}`);
  }
}
