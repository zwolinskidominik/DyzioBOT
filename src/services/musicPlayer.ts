import { Player, GuildQueue, Track } from 'discord-player';
import { PlayDLExtractor } from './PlayDLExtractor';
import { Client, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, User } from 'discord.js';
import { MusicConfigModel } from '../models/MusicConfig';
import { createBaseEmbed } from '../utils/embedHelpers';
import { COLORS } from '../config/constants/colors';
import { debounce } from '../utils/cooldownHelpers';
import { formatClock } from '../utils/timeHelpers';
import logger from '../utils/logger';

export { formatClock };

export interface QueueMetadata {
  channel: TextChannel;
  client: Client;
  requestedBy: User;
  nowPlayingMessage?: Message;
}

/** Build the control button row for the "now playing" message. */
export function buildMusicControlRow(opts?: { hasPrevious?: boolean; isPaused?: boolean }): ActionRowBuilder<ButtonBuilder> {
  const paused = opts?.isPaused ?? false;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('music_prev').setLabel('Poprzednia').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(!opts?.hasPrevious),
    new ButtonBuilder().setCustomId('music_pause').setLabel(paused ? 'Wznów' : 'Pauza').setEmoji(paused ? '▶️' : '⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_skip').setLabel('Pomiń').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_loop').setLabel('Zapętl').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
  );
}

let player: Player | null = null;

export async function initializeMusicPlayer(client: Client): Promise<Player> {
  if (player) return player;

  player = new Player(client);

  // Register custom PlayDL extractor (search + streaming via play-dl)
  try {
    await player.extractors.register(PlayDLExtractor, {});
    logger.info('PlayDL extractor loaded (search + streaming)');
  } catch (error) {
    logger.error(`Failed to load PlayDL extractor: ${error}`);
  }

  // Event: Track starts playing
  player.events.on('playerStart', async (queue: GuildQueue<QueueMetadata>, track: Track) => {
    const config = await MusicConfigModel.findOne({ guildId: queue.guild.id });
    
    if (!config?.announceSongs) return;

    const embed = createBaseEmbed({
      color: COLORS.MUSIC,
      title: '🎵 Teraz odtwarzane',
      description: `**[${track.title}](${track.url})**`,
      thumbnail: track.thumbnail,
      footerText: `Dodane przez ${track.requestedBy?.username || 'Nieznany'}`,
    }).addFields(
      { name: 'Autor', value: track.author, inline: true },
      { name: 'Długość', value: track.duration, inline: true }
    );

    const hasPrevious = queue.history && !queue.history.isEmpty();

    const row = buildMusicControlRow({ hasPrevious: !!hasPrevious, isPaused: false });

    // Delete previous now playing message if it exists
    try {
      if (queue.metadata?.nowPlayingMessage?.deletable) {
        await queue.metadata.nowPlayingMessage.delete().catch(() => {});
      }
    } catch {}

    const msg = await queue.metadata?.channel?.send({ embeds: [embed], components: [row] });
    if (msg && queue.metadata) {
      queue.metadata.nowPlayingMessage = msg;
    }
  });

  // Helper: remove buttons from now playing message
  async function removeNowPlayingButtons(queue: GuildQueue<QueueMetadata>) {
    try {
      const msg = queue.metadata?.nowPlayingMessage;
      if (msg?.editable) {
        await msg.edit({ components: [] }).catch(() => {});
      }
    } catch {}
  }

  // Event: Queue ends
  player.events.on('emptyQueue', async (queue: GuildQueue<QueueMetadata>) => {
    await removeNowPlayingButtons(queue);
    const config = await MusicConfigModel.findOne({ guildId: queue.guild.id });
    
    if (config?.leaveOnEnd && queue.connection) {
      const timeout = Math.max(1, config.leaveTimeout || 300); // Minimum 1 second
      debounce(`musicLeave:${queue.guild.id}`, () => {
        if (queue.tracks.size === 0) {
          try { queue.delete(); } catch {}
        }
      }, timeout * 1000);
    }
  });

  // Event: Channel becomes empty (only bot left) - disconnect after 3 minutes
  player.events.on('emptyChannel', async (queue: GuildQueue<QueueMetadata>) => {
    if (queue.connection) {
      debounce(`musicEmptyChannel:${queue.guild.id}`, async () => {
        // Check if still empty after 3 minutes
        const voiceChannel = queue.channel;
        if (voiceChannel && voiceChannel.members.filter(m => !m.user.bot).size === 0) {
          await removeNowPlayingButtons(queue);
          queue.metadata?.channel?.send({ embeds: [createBaseEmbed({ description: '👋 Kanał był pusty przez 3 minuty. Rozłączam się...' })] });
          try { queue.delete(); } catch {}
        }
      }, 3 * 60 * 1000);
    }
  });

  // Event: Error handling
  player.events.on('playerError', (queue: GuildQueue<QueueMetadata>, error: Error) => {
    logger.error(`Music player error in guild ${queue.guild.id}: ${error}`);
    queue.metadata?.channel?.send({ embeds: [createBaseEmbed({ isError: true, description: '❌ Wystąpił błąd podczas odtwarzania muzyki.' })] });
  });

  return player;
}

export function getMusicPlayer(): Player | null {
  return player;
}

export function createProgressBar(current: number, total: number, length: number = 20): string {
  const progress = Math.round((current / total) * length);
  const emptyProgress = length - progress;

  const progressBar = '▇'.repeat(progress);
  const emptyProgressBar = '—'.repeat(emptyProgress);
  
  return `${progressBar}${emptyProgressBar}`;
}

export async function canUseMusic(guildId: string, userRoleIds: string[]): Promise<{ allowed: boolean; reason?: string }> {
  const config = await MusicConfigModel.findOne({ guildId });

  if (!config?.enabled) {
    return { allowed: false, reason: 'Moduł muzyczny jest wyłączony na tym serwerze.' };
  }

  // Check DJ role
  if (config.djRoleId && !userRoleIds.includes(config.djRoleId)) {
    return { allowed: false, reason: 'Nie masz roli DJ wymaganej do używania komend muzycznych.' };
  }

  return { allowed: true };
}

export async function canPlayInChannel(guildId: string, channelId: string): Promise<{ allowed: boolean; reason?: string }> {
  const config = await MusicConfigModel.findOne({ guildId });

  if (!config?.enabled) {
    return { allowed: false, reason: 'Moduł muzyczny jest wyłączony na tym serwerze.' };
  }

  // If no channels specified, allow all
  if (!config.allowedChannels || config.allowedChannels.length === 0) {
    return { allowed: true };
  }

  // Check if channel is allowed
  if (!config.allowedChannels.includes(channelId)) {
    return { allowed: false, reason: 'Ten kanał głosowy nie jest dozwolony dla muzyki.' };
  }

  return { allowed: true };
}
