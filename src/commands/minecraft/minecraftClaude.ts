import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ICommandConfig, ICommandOptions } from '../../interfaces/Command';
import { getMinecraftConfig } from '../../config/minecraft';
import { getMinecraftRuntime } from '../../services/minecraft/runtime';
import { runServerStart } from '../../services/minecraft/startFlow';
import { CLAUDE_STARTER } from '../../utils/minecraftEmbeds';
import { createErrorEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

/**
 * Start serwera MC „jako Claude”: gdy uruchomienie jest z inicjatywy AI, panel pokazuje
 * „Włączył: 🤖 Claude (AI)” zamiast konta właściciela. Tylko właściciel bota (ownerOnly) i tylko
 * na serwerze GameZone; ukryta przed zwykłymi członkami (domyślnie tylko Administrator).
 */
export const data = new SlashCommandBuilder()
  .setName('minecraft-claude')
  .setDescription('Włącz serwer Minecraft jako Claude (AI) - tylko właściciel bota')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

const mcConfig = getMinecraftConfig();
export const options: ICommandConfig = mcConfig
  ? { cooldown: 10, guildOnly: true, ownerOnly: true, restrictedGuildIds: [mcConfig.guildId] }
  : { deleted: true };

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const rt = getMinecraftRuntime();
  if (!rt || interaction.guildId !== rt.config.guildId || !interaction.guild) {
    await interaction.reply({ embeds: [createErrorEmbed('Ta komenda nie działa na tym serwerze.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (rt.starter.inProgress) {
    await interaction.reply({ content: 'Serwer właśnie się uruchamia.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (rt.starter.cooldownRemaining() > 0) {
    await interaction.reply({ content: 'Serwer był uruchamiany przed chwilą - spróbuj za kilka minut.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.editReply('🤖 Uruchamiam serwer jako Claude - postęp widać w panelu /minecraft.');
  try {
    const outcome = await runServerStart(interaction.guild, rt, CLAUDE_STARTER);
    const text: Record<typeof outcome.kind, string> = {
      ready: '✅ Serwer gotowy.',
      timeout: '❌ Serwer nie wystartował w ciągu 5 minut.',
      unavailable: 'Nie udało się uruchomić serwera, spróbuj za chwilę.',
      busy: 'Serwer właśnie się uruchamia.',
      cooldown: 'Serwer był uruchamiany przed chwilą - spróbuj za kilka minut.',
    };
    await interaction.editReply(text[outcome.kind]).catch(() => undefined);
  } catch (err) {
    logger.error(`[MC] /minecraft-claude nie powiodło się: ${err}`);
    await interaction.editReply({ embeds: [createErrorEmbed('Coś poszło nie tak. Spróbuj za chwilę.')] }).catch(() => undefined);
  }
}
