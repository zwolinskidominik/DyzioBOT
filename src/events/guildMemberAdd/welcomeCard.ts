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

    const botMember = guild.members.cache.get(guild.client.user.id);
    if (!botMember) return;

    const permissions = channel.permissionsFor(botMember);
    if (!permissions || !permissions.has(['SendMessages', 'EmbedLinks'])) {
      logger.debug(`Bot nie ma uprawnień do wysyłania wiadomości w kanale ${channel.id}`);
      return;
    }

    const gifData = getRandomLobbyGif();
    const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });

    const rulesChannelId = config.rulesChannelId || 'CHANNEL_ID_REGULAMIN';
    const rolesChannelId = config.rolesChannelId || 'CHANNEL_ID_ROLE';
    const chatChannelId = config.chatChannelId || 'CHANNEL_ID_CHAT';

    const defaultMessage = 
      `### Witaj {user} na {server}\n\n` +
      `**Witamy na pokładzie!**\n` +
      `Gratulacje, właśnie wbiłeś/aś do miejsca, w którym gry są poważniejsze niż życie… prawie.\n\n` +
      `➔ Przeczytaj {rulesChannel}\n` +
      `➔ Wybierz role {rolesChannel}\n` +
      `➔ Przywitaj się z nami {chatChannel}\n\n` +
      `**Rozgość się i znajdź ekipę do grania.**`;

    let message = (config.welcomeMessage && config.welcomeMessage.trim()) || defaultMessage;
    
    message = message
      .replace(/{user}/g, `<@${member.user.id}>`)
      .replace(/{server}/g, member.guild.name)
      .replace(/{memberCount}/g, member.guild.memberCount.toString())
      .replace(/{username}/g, member.user.username)
      .replace(/{rulesChannel}/g, `<#${rulesChannelId}>`)
      .replace(/{rolesChannel}/g, `<#${rolesChannelId}>`)
      .replace(/{chatChannel}/g, `<#${chatChannelId}>`);

    const embed = new EmbedBuilder()
      .setColor(COLORS.JOIN)
      .setDescription(message)
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

    if (config.dmEnabled && message) {
      try {
        const dmMessage = message
          .replace(/{user}/g, member.user.username)
          .replace(/### /g, '**')
          .replace(/<@\d+>/g, member.user.username);
        
        await member.send({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.JOIN)
              .setTitle(`Witaj na ${member.guild.name}!`)
              .setDescription(dmMessage)
              .setThumbnail(member.guild.iconURL({ size: 256 }) || '')
          ]
        });
      } catch (dmError) {
        logger.debug(`Nie można wysłać DM do ${member.user.tag}: ${dmError}`);
      }
    }
  } catch (error) {
    logger.error(`Błąd w welcomeCard.ts przy userId=${member?.user?.id}: ${error}`);
  }
}
