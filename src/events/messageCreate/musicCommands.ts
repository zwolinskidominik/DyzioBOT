import { Message } from 'discord.js';
import { Player, Track } from 'discord-player';
import { getMusicPlayer, canUseMusic, canPlayInChannel, QueueMetadata } from '../../services/musicPlayer';
import { MusicConfigModel } from '../../models/MusicConfig';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

const DEFAULT_PREFIX = '!';

/** Cache prefix per guild to avoid DB query on every message */
const prefixCache = new Map<string, { prefix: string; expiresAt: number }>();
const PREFIX_CACHE_TTL = 60_000; // 1 minute

async function getPrefix(guildId: string): Promise<string> {
  const cached = prefixCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.prefix;

  try {
    const config = await MusicConfigModel.findOne({ guildId }).lean();
    const prefix = (config as any)?.prefix || DEFAULT_PREFIX;
    prefixCache.set(guildId, { prefix, expiresAt: Date.now() + PREFIX_CACHE_TTL });
    return prefix;
  } catch {
    return DEFAULT_PREFIX;
  }
}

export default async function handleMusicCommands(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefix = await getPrefix(message.guild.id);
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  const musicCommands = ['play', 'p', 'pause', 'resume', 'skip', 'stop', 'queue', 'q', 'nowplaying', 'np', 'volume', 'vol', 'shuffle', 'loop', 'loopq', 'mhelp', 'musichelp'];
  if (!musicCommands.includes(commandName)) return;

  const player = getMusicPlayer();
  if (!player) {
    await message.reply('❌ Odtwarzacz muzyki nie jest zainicjalizowany.');
    return;
  }

  const member = message.member;
  if (!member) return;

  const userRoleIds = member.roles.cache.map(r => r.id);
  const musicCheck = await canUseMusic(message.guild.id, userRoleIds);
  
  if (!musicCheck.allowed) {
    await message.reply(`❌ ${musicCheck.reason}`);
    return;
  }

  try {
    switch (commandName) {
      case 'play':
      case 'p':
        await handlePlay(message, args, player);
        break;
      case 'pause':
        await handlePause(message, player);
        break;
      case 'resume':
        await handleResume(message, player);
        break;
      case 'skip':
        await handleSkip(message, player);
        break;
      case 'stop':
        await handleStop(message, player);
        break;
      case 'queue':
      case 'q':
        await handleQueue(message, player);
        break;
      case 'nowplaying':
      case 'np':
        await handleNowPlaying(message, player);
        break;
      case 'volume':
      case 'vol':
        await handleVolume(message, args, player);
        break;
      case 'shuffle':
        await handleShuffle(message, player);
        break;
      case 'loop':
        await handleLoopTrack(message, player);
        break;
      case 'loopq':
        await handleLoopQueue(message, player);
        break;
      case 'mhelp':
      case 'musichelp':
        await handleMusicHelp(message);
        break;
    }
  } catch (error) {
    logger.error(`Error in music command ${commandName}:`, error);
    await message.reply('❌ Wystąpił błąd podczas wykonywania komendy.');
  }
}

async function handlePlay(message: Message, args: string[], player: Player): Promise<void> {
  if (!message.member?.voice.channel) {
    await message.reply('❌ Musisz być na kanale głosowym, aby odtwarzać muzykę!');
    return;
  }

  if (message.member.voice.channel.id === message.guild!.afkChannelId) {
    await message.reply({ embeds: [createBaseEmbed({ isError: true, description: '❌ Nie można używać komend muzycznych na kanale AFK!' })] });
    return;
  }

  const channelCheck = await canPlayInChannel(message.guild!.id, message.member.voice.channel.id);
  if (!channelCheck.allowed) {
    await message.reply(`❌ ${channelCheck.reason}`);
    return;
  }

  const query = args.join(' ');
  if (!query) {
    await message.reply('❌ Podaj nazwę utworu lub link! Użycie: `!play <nazwa/link>`');
    return;
  }

  const config = await MusicConfigModel.findOne({ guildId: message.guild!.id });

  const msg = await message.reply('🔍 Szukam...');

  try {
    // Detect if query is a URL
    const isURL = query.startsWith('http://') || query.startsWith('https://');
    
    const searchResult = await player.search(query, {
      requestedBy: message.author,
      searchEngine: isURL ? ('ext:com.playdl.extractor' as `ext:${string}`) : 'youtubeSearch',
    });

    if (!searchResult.hasTracks()) {
      await msg.edit('❌ Nie znaleziono utworu.');
      return;
    }

    const queue = player.nodes.create(message.guild!, {
      metadata: {
        channel: message.channel,
        client: message.client,
        requestedBy: message.author,
      },
      leaveOnEmpty: false,
      leaveOnEnd: false,
      pauseOnEmpty: false,
      selfDeaf: true,
      volume: config?.defaultVolume || 50,
    });

    if (!queue.connection) {
      await queue.connect(message.member.voice.channel);
    } else if (queue.channel && message.member.voice.channel.id !== queue.channel.id) {
      await message.reply('❌ Bot jest już na innym kanale głosowym! Dołącz do tego samego kanału lub poczekaj aż skończy.');
      return;
    }

    // Check queue size limit
    if (config?.maxQueueSize && queue.tracks.size >= config.maxQueueSize) {
      await msg.edit(`❌ Kolejka jest pełna! Maksymalna liczba utworów: ${config.maxQueueSize}`);
      return;
    }

    if (searchResult.playlist) {
      queue.addTrack(searchResult.tracks);

      // Calculate total playlist duration
      let totalSeconds = 0;
      for (const t of searchResult.tracks) {
        const parts = t.duration.split(':').map(Number);
        if (parts.length === 3) totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) totalSeconds += parts[0] * 60 + parts[1];
      }
      const totalH = Math.floor(totalSeconds / 3600);
      const totalM = Math.floor((totalSeconds % 3600) / 60);
      const totalS = Math.floor(totalSeconds % 60);
      const totalDuration = totalH > 0
        ? `${totalH}:${totalM.toString().padStart(2, '0')}:${totalS.toString().padStart(2, '0')}`
        : `${totalM}:${totalS.toString().padStart(2, '0')}`;

      const firstTrack = searchResult.tracks[0];
      const playlistEmbed = createBaseEmbed({
        color: COLORS.MUSIC,
        title: 'Dodano playlistę',
        description: `**Playlista**\n[${searchResult.playlist.title}](${searchResult.playlist.url})`,
        thumbnail: firstTrack?.thumbnail || undefined,
        footerText: `Dodane przez ${message.author.username}`,
      }).addFields(
        { name: 'Długość playlisty', value: totalDuration, inline: true },
        { name: 'Utworów', value: `${searchResult.tracks.length}`, inline: true }
      );

      await msg.edit({ content: null, embeds: [playlistEmbed] });
    } else {
      const track = searchResult.tracks[0];
      
      // Check song duration limit
      if (config?.maxSongDuration && config.maxSongDuration > 0) {
        const durationSeconds = track.durationMS / 1000;
        if (durationSeconds > config.maxSongDuration) {
          await msg.edit(`❌ Utwór jest za długi! Maksymalna długość: ${Math.floor(config.maxSongDuration / 60)} minut.`);
          return;
        }
      }

      queue.addTrack(track);

      const trackEmbed = createBaseEmbed({
        color: COLORS.MUSIC,
        title: 'Dodano do kolejki',
        description: `[${track.title}](${track.url})`,
        thumbnail: track.thumbnail,
        footerText: `Dodane przez ${message.author.username}`,
      }).addFields(
        { name: 'Autor', value: track.author, inline: true },
        { name: 'Długość', value: track.duration, inline: true }
      );

      await msg.edit({ content: null, embeds: [trackEmbed] });
    }

    if (!queue.isPlaying()) {
      await queue.node.play();
    }
  } catch (error) {
    logger.error('Play error:', error);
    await msg.edit(`❌ Wystąpił błąd podczas odtwarzania: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
  }
}

async function handlePause(message: Message, player: Player): Promise<void> {
  const queue = player.nodes.get(message.guild!.id);
  
  if (!queue || !queue.isPlaying()) {
    await message.reply('❌ Nic nie jest odtwarzane!');
    return;
  }

  queue.node.pause();
  await message.reply({ embeds: [createBaseEmbed({ color: COLORS.MUSIC_PAUSE, description: '⏸️ Wstrzymano odtwarzanie.' })] });
}

async function handleResume(message: Message, player: Player): Promise<void> {
  const queue = player.nodes.get(message.guild!.id);
  
  if (!queue) {
    await message.reply('❌ Nic nie jest odtwarzane!');
    return;
  }

  if (!queue.node.isPaused()) {
    await message.reply('❌ Odtwarzanie nie jest wstrzymane!');
    return;
  }

  queue.node.resume();
  await message.reply({ embeds: [createBaseEmbed({ color: COLORS.MUSIC_SUCCESS, description: '▶️ Wznowiono odtwarzanie.' })] });
}

async function handleSkip(message: Message, player: Player): Promise<void> {
  const queue = player.nodes.get(message.guild!.id);
  
  if (!queue || !queue.isPlaying()) {
    await message.reply('❌ Nic nie jest odtwarzane!');
    return;
  }

  const currentTrack = queue.currentTrack;
  queue.node.skip();
  await message.reply({ embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: `⏭️ Pominięto: **${currentTrack?.title}**` })] });
}

async function handleStop(message: Message, player: Player): Promise<void> {
  const queue = player.nodes.get(message.guild!.id);
  
  if (!queue) {
    await message.reply('❌ Nic nie jest odtwarzane!');
    return;
  }

  try {
    const meta = queue.metadata as QueueMetadata | undefined;
    const msg = meta?.nowPlayingMessage;
    if (msg?.editable) await msg.edit({ components: [] }).catch(() => {});
  } catch {}
  try { queue.delete(); } catch {}
  await message.reply({ embeds: [createBaseEmbed({ isError: true, description: '⏹️ Zatrzymano odtwarzanie i wyczyszczono kolejkę.' })] });
}

async function handleQueue(message: Message, player: Player): Promise<void> {
  const queue = player.nodes.get(message.guild!.id);
  
  if (!queue || !queue.currentTrack) {
    await message.reply('❌ Kolejka jest pusta!');
    return;
  }

  const tracks = queue.tracks.toArray();
  const currentTrack = queue.currentTrack;

  const embed = createBaseEmbed({
    color: COLORS.MUSIC,
    title: '🎵 Kolejka utworów',
    description: `**Teraz odtwarzane:**\n${currentTrack.title} - ${currentTrack.author}\n\n**W kolejce:**`,
    footerText: `${tracks.length} utworów w kolejce`,
  });

  if (tracks.length > 0) {
    const queueList = tracks.slice(0, 10).map((track: Track, index: number) => 
      `${index + 1}. **${track.title}** - ${track.author} \`[${track.duration}]\``
    ).join('\n');
    
    embed.setDescription(
      `**Teraz odtwarzane:**\n${currentTrack.title} - ${currentTrack.author}\n\n**W kolejce:**\n${queueList}${tracks.length > 10 ? `\n\n...i ${tracks.length - 10} więcej` : ''}`
    );
  }

  await message.reply({ embeds: [embed] });
}

async function handleNowPlaying(message: Message, player: Player): Promise<void> {
  const queue = player.nodes.get(message.guild!.id);
  
  if (!queue || !queue.currentTrack) {
    await message.reply('❌ Nic nie jest odtwarzane!');
    return;
  }

  const track = queue.currentTrack;
  const progress = queue.node.createProgressBar();

  const embed = createBaseEmbed({
    color: COLORS.MUSIC,
    title: '🎵 Teraz odtwarzane',
    description: `**${track.title}**`,
    thumbnail: track.thumbnail,
    footerText: `Dodane przez ${track.requestedBy?.username || 'Nieznany'}`,
  }).addFields(
    { name: 'Autor', value: track.author, inline: true },
    { name: 'Długość', value: track.duration, inline: true },
    { name: 'Postęp', value: progress || 'Brak danych', inline: false }
  );

  await message.reply({ embeds: [embed] });
}

async function handleVolume(message: Message, args: string[], player: Player): Promise<void> {
  const queue = player.nodes.get(message.guild!.id);
  
  if (!queue) {
    await message.reply('❌ Nic nie jest odtwarzane!');
    return;
  }

  if (args.length === 0) {
    await message.reply({ embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: `🔊 Obecna głośność: **${queue.node.volume}%**` })] });
    return;
  }

  const volume = parseInt(args[0]);
  
  if (isNaN(volume) || volume < 0 || volume > 100) {
    await message.reply('❌ Głośność musi być liczbą od 0 do 100!');
    return;
  }

  queue.node.setVolume(volume);
  await message.reply({ embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: `🔊 Ustawiono głośność na **${volume}%**` })] });
}

async function handleShuffle(message: Message, player: Player): Promise<void> {
  const queue = player.nodes.get(message.guild!.id);
  
  if (!queue || queue.tracks.size === 0) {
    await message.reply('❌ Kolejka jest pusta!');
    return;
  }

  queue.tracks.shuffle();
  await message.reply({ embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: '🔀 Pomieszano kolejkę!' })] });
}

async function handleLoopTrack(message: Message, player: Player): Promise<void> {
  const queue = player.nodes.get(message.guild!.id);
  
  if (!queue) {
    await message.reply('❌ Nic nie jest odtwarzane!');
    return;
  }

  if (queue.repeatMode === 1) {
    queue.setRepeatMode(0);
    await message.reply({ embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: '🔁 Wyłączono powtarzanie utworu.' })] });
  } else {
    queue.setRepeatMode(1);
    await message.reply({ embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: '🔂 Włączono powtarzanie utworu.' })] });
  }
}

async function handleLoopQueue(message: Message, player: Player): Promise<void> {
  const queue = player.nodes.get(message.guild!.id);
  
  if (!queue) {
    await message.reply('❌ Nic nie jest odtwarzane!');
    return;
  }

  if (queue.repeatMode === 2) {
    queue.setRepeatMode(0);
    await message.reply({ embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: '🔁 Wyłączono powtarzanie kolejki.' })] });
  } else {
    queue.setRepeatMode(2);
    await message.reply({ embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: '🔁 Włączono powtarzanie kolejki.' })] });
  }
}

async function handleMusicHelp(message: Message): Promise<void> {
  const p = message.guild ? await getPrefix(message.guild.id) : DEFAULT_PREFIX;

  const embed = createBaseEmbed({
    color: COLORS.MUSIC,
    title: '🎵 Komendy muzyczne',
    description: 'Lista wszystkich komend do sterowania muzyką.',
    footerText: `Prefix: ${p} | Pomoc: ${p}mhelp`,
  }).addFields(
      {
        name: '▶️ Odtwarzanie',
        value: [
          `\`${p}play <nazwa/link>\` (\`${p}p\`) — odtwarza utwór lub dodaje do kolejki`,
          `\`${p}pause\` — wstrzymuje odtwarzanie`,
          `\`${p}resume\` — wznawia odtwarzanie`,
          `\`${p}skip\` — pomija bieżący utwór`,
          `\`${p}stop\` — zatrzymuje muzykę i czyści kolejkę`,
        ].join('\n'),
      },
      {
        name: '📋 Kolejka',
        value: [
          `\`${p}queue\` (\`${p}q\`) — wyświetla kolejkę`,
          `\`${p}nowplaying\` (\`${p}np\`) — aktualnie odtwarzany utwór`,
          `\`${p}shuffle\` — losuje kolejność kolejki`,
        ].join('\n'),
      },
      {
        name: '🔧 Ustawienia',
        value: [
          `\`${p}volume <0-100>\` (\`${p}vol\`) — ustawia głośność`,
          `\`${p}loop\` — zapętl/odłącz bieżący utwór`,
          `\`${p}loopq\` — zapętl/odłącz całą kolejkę`,
        ].join('\n'),
      },
      {
        name: '💡 Wskazówki',
        value: [
          '• Obsługiwane: YouTube, Spotify, SoundCloud i inne — linki, playlisty, wyszukiwanie po nazwie',
          '• Bot rozłączy się po 3 min bez użytkowników na kanale',
          '• Musisz być na kanale głosowym, aby używać komend',
        ].join('\n'),
      }
    );

  await message.reply({ embeds: [embed] });
}
