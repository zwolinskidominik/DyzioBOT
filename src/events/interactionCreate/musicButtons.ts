import {
  Interaction,
  GuildMember,
  MessageFlags,
} from 'discord.js';
import { getMusicPlayer, QueueMetadata, buildMusicControlRow } from '../../services/musicPlayer';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';

const MUSIC_BUTTON_IDS = ['music_pause', 'music_skip', 'music_stop', 'music_prev', 'music_loop'];

export default async function run(interaction: Interaction): Promise<void> {
  if (!interaction.isButton()) return;
  if (!MUSIC_BUTTON_IDS.includes(interaction.customId)) return;
  if (!interaction.guild) return;

  const player = getMusicPlayer();
  if (!player) return;

  const queue = player.nodes.get(interaction.guild.id);
  const member = interaction.member as GuildMember;

  // Must be in a voice channel
  if (!member?.voice?.channel) {
    await interaction.reply({
      embeds: [createBaseEmbed({ isError: true, description: '❌ Musisz być na kanale głosowym!' })],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Cannot use from AFK channel
  if (member.voice.channel.id === interaction.guild!.afkChannelId) {
    await interaction.reply({
      embeds: [createBaseEmbed({ isError: true, description: '❌ Nie można używać komend muzycznych na kanale AFK!' })],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Must be in the same voice channel as the bot
  if (queue?.channel && member.voice.channel.id !== queue.channel.id) {
    await interaction.reply({
      embeds: [createBaseEmbed({ isError: true, description: '❌ Musisz być na tym samym kanale co bot!' })],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!queue || !queue.currentTrack) {
    await interaction.reply({
      embeds: [createBaseEmbed({ isError: true, description: '❌ Nic nie jest odtwarzane!' })],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    switch (interaction.customId) {
      case 'music_pause': {
        const wasPaused = queue.node.isPaused();
        if (wasPaused) {
          queue.node.resume();
          await interaction.reply({
            embeds: [createBaseEmbed({ color: COLORS.MUSIC_SUCCESS, description: '▶️ Wznowiono odtwarzanie.' })],
            flags: MessageFlags.Ephemeral,
          });
        } else {
          queue.node.pause();
          await interaction.reply({
            embeds: [createBaseEmbed({ color: COLORS.MUSIC_PAUSE, description: '⏸️ Wstrzymano odtwarzanie.' })],
            flags: MessageFlags.Ephemeral,
          });
        }

        // Update the "now playing" message buttons to toggle Pauza ↔ Wznów
        try {
          const meta = queue.metadata as QueueMetadata | undefined;
          const msg = meta?.nowPlayingMessage;
          if (msg?.editable) {
            const hasPrevious = queue.history && !queue.history.isEmpty();
            const row = buildMusicControlRow({ hasPrevious: !!hasPrevious, isPaused: !wasPaused });
            await msg.edit({ components: [row] });
          }
        } catch {}
        break;
      }

      case 'music_skip': {
        const skipped = queue.currentTrack;
        queue.node.skip();
        await interaction.reply({
          embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: `⏭️ Pominięto: **${skipped?.title}**` })],
        });
        break;
      }

      case 'music_prev': {
        if (!queue.history || queue.history.isEmpty()) {
          await interaction.reply({
            embeds: [createBaseEmbed({ isError: true, description: '❌ Brak poprzedniego utworu!' })],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await queue.history.previous();
        await interaction.reply({
          embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: '⏮️ Cofnięto do poprzedniego utworu.' })],
        });
        break;
      }

      case 'music_stop': {
        try {
          const meta = queue.metadata as QueueMetadata | undefined;
          const msg = meta?.nowPlayingMessage;
          if (msg?.editable) await msg.edit({ components: [] }).catch(() => {});
        } catch {}
        try { queue.delete(); } catch {}
        await interaction.reply({
          embeds: [createBaseEmbed({ isError: true, description: '⏹️ Zatrzymano odtwarzanie i wyczyszczono kolejkę.' })],
        });
        break;
      }

      case 'music_loop': {
        if (queue.repeatMode === 1) {
          queue.setRepeatMode(0);
          await interaction.reply({
            embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: '🔁 Wyłączono powtarzanie.' })],
          });
        } else {
          queue.setRepeatMode(1);
          await interaction.reply({
            embeds: [createBaseEmbed({ color: COLORS.MUSIC, description: '🔂 Włączono powtarzanie utworu.' })],
          });
        }
        break;
      }
    }
  } catch (error) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [createBaseEmbed({ isError: true, description: '❌ Wystąpił błąd.' })],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
