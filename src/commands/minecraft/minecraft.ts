import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { ICommandConfig, ICommandOptions } from '../../interfaces/Command';
import { getMinecraftConfig } from '../../config/minecraft';
import { getMinecraftRuntime, panelPayload, registerPanel, visibleView } from '../../services/minecraft/runtime';
import { canManageWhitelist, memberRoleIds } from '../../services/minecraft/permissions';
import { createErrorEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('minecraft')
  .setDescription('Panel serwera Minecraft GameZone: stan, uruchamianie i whitelista ⛏️')
  .setDMPermission(false);

/**
 * Tylko na serwerze GameZone (MC_GUILD_ID): restrictedGuildIds rejestruje komendę wyłącznie tam
 * i blokuje ją gdzie indziej. Bez konfiguracji MC_* komenda w ogóle się nie rejestruje.
 */
const mcConfig = getMinecraftConfig();
export const options: ICommandConfig = mcConfig
  ? { cooldown: 5, guildOnly: true, restrictedGuildIds: [mcConfig.guildId] }
  : { deleted: true };

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const rt = getMinecraftRuntime();
  if (!rt || interaction.guildId !== rt.config.guildId || !interaction.guild) {
    await interaction.reply({ embeds: [createErrorEmbed('Ta komenda nie działa na tym serwerze.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const isAdmin = canManageWhitelist({
    userId: interaction.user.id,
    guildOwnerId: interaction.guild.ownerId,
    permissions: interaction.memberPermissions,
    roleIds: memberRoleIds(interaction.member),
  });

  // Admin wystawia stały panel (odświeżany co minutę), reszta dostaje kopię widoczną tylko dla siebie.
  await interaction.deferReply(isAdmin ? {} : { flags: MessageFlags.Ephemeral });
  try {
    const snapshot = await rt.monitor.refresh();
    const payload = panelPayload(rt, visibleView(rt, snapshot));
    const message = await interaction.editReply(payload);
    if (isAdmin) await registerPanel(interaction.guild, message);
  } catch (err) {
    logger.error(`[MC] /minecraft nie powiodło się: ${err}`);
    await interaction.editReply({ embeds: [createErrorEmbed('Nie udało się wyświetlić panelu. Spróbuj za chwilę.')] }).catch(() => undefined);
  }
}
