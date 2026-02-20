import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { getModFailMessage } from '../../utils/moderationHelpers';
import { createBaseEmbed, createErrorEmbed, formatWarnBar } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { addWarn, WARN_LIMIT } from '../../services/warnService';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Nadaje ostrzeżenie użytkownikowi (4 ostrzeżenia = auto-ban).')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName('uzytkownik')
      .setDescription('Użytkownik, któremu chcesz nadać upomnienie.')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('powod').setDescription('Powód upomnienia.').setRequired(true)
  );

export const options = {
  userPermissions: PermissionFlagsBits.ModerateMembers,
  botPermissions: PermissionFlagsBits.ModerateMembers,
  guildOnly: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  await interaction.deferReply();

  try {
    const targetUser =
      interaction.options.getUser('użytkownik') || interaction.options.getUser('uzytkownik');
    if (!targetUser) {
      await interaction.editReply({ embeds: [createErrorEmbed('Nie podano użytkownika.')] });
      return;
    }

    const reason = interaction.options.getString('powod');
    if (!reason) {
      await interaction.editReply({ embeds: [createErrorEmbed('Nie podano powodu.')] });
      return;
    }

    const guild = interaction.guild!;
    const botId = interaction.client.user!.id;
    let member: GuildMember;

    try {
      member = await guild.members.fetch(targetUser.id);
    } catch {
      await interaction.editReply({ embeds: [createErrorEmbed('Nie udało się znaleźć użytkownika na serwerze.')] });
      return;
    }
    const failMessage = getModFailMessage(member, interaction.member as GuildMember, guild.members.me ?? null, 'warn');
    if (failMessage) {
      logger.debug(
        `Warn command permissions check failed for ${interaction.user.tag} trying to warn ${targetUser.tag}`
      );
      await interaction.editReply({ embeds: [createErrorEmbed(failMessage)] });
      return;
    }

    const result = await addWarn({
      guildId: guild.id,
      userId: targetUser.id,
      reason,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
    });

    if (!result.ok) {
      await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
      return;
    }

    const { count, shouldBan, punishment, nextPunishment } = result.data;

    if (shouldBan) {
      try {
        await member.ban({ reason: `Auto-ban: osiągnięto limit ostrzeżeń (${count})` });
        
        try {
          await targetUser.send({
            embeds: [createBaseEmbed({
              title: '🚫 Zostałeś zbanowany',
              description: 
                `**Serwer:** ${guild.name}\n` +
                `**Powód ostrzeżenia:** ${reason}\n` +
                `**Moderator:** <@${interaction.user.id}>\n\n` +
                `⚠️ **Osiągnięto limit ostrzeżeń (${count}/${WARN_LIMIT})**\n` +
                `Zostałeś permanentnie zbanowany z serwera.`,
              color: COLORS.ERROR,
            })]
          });
        } catch {
          logger.debug(`Nie można wysłać DM do ${targetUser.tag}`);
        }

        const embed = createBaseEmbed({
          title: `🚫 Auto-ban: ${count} ostrzeżeń`,
          color: COLORS.ERROR,
          timestamp: false,
        }).addFields([
          { name: 'Użytkownik', value: `<@!${targetUser.id}>`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Powód', value: reason, inline: false },
          { name: 'Kara', value: '**PERMANENTNY BAN**', inline: false },
          {
            name: 'Suma punktów',
            value: `Ban: ${count}p ${formatWarnBar(botId, count)} ${WARN_LIMIT}p (100%)`,
          },
        ]);

        await interaction.editReply({ embeds: [embed] });
        return;
      } catch (err) {
        logger.error(`Błąd przy banowaniu ${member.id}: ${err}`);
      }
    }

    const muteDurationMs = punishment?.duration || 0;

    let muteEndTs: number | null = null;
    try {
      if (muteDurationMs > 0) {
        await member.timeout(muteDurationMs, reason);
        muteEndTs = Math.floor((Date.now() + muteDurationMs) / 1000);
      }
    } catch (err) {
      logger.error(`Błąd przy nakładaniu kary na ${member.id}: ${err}`);
    }

    try {
      const consequencesText = nextPunishment 
        ? `\n\n⚠️ **Kolejne ostrzeżenie:** ${nextPunishment.label}`
        : '';

      await targetUser.send({
        embeds: [createBaseEmbed({
          title: '⚠️ Otrzymałeś ostrzeżenie',
          description: 
            `**Serwer:** ${guild.name}\n` +
            `**Powód:** ${reason}\n` +
            `**Moderator:** <@${interaction.user.id}>\n` +
            `**Kara:** ${punishment ? punishment.label : 'Brak'} wyciszenia\n` +
            `**Ostrzeżenia:** ${count}/${WARN_LIMIT}` +
            consequencesText,
          color: COLORS.WARN,
        })]
      });
    } catch {
      logger.debug(`Nie można wysłać DM do ${targetUser.tag}`);
    }

    const bar = formatWarnBar(botId, count);
    const percent = Math.round((count / WARN_LIMIT) * 100);

    const embed = createBaseEmbed({
      title: `Został nadany ${count} punkt ostrzeżeń`,
      color: COLORS.WARN,
      timestamp: false,
    }).addFields([
      { name: 'Użytkownik', value: `<@!${targetUser.id}>`, inline: true },
      { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Powód', value: reason, inline: false },
      {
        name: 'Czas trwania',
        value: muteEndTs ? `<t:${muteEndTs}:F>` : 'Brak wyciszenia',
        inline: false,
      },
      {
        name: 'Suma punktów',
        value: `Ban: ${count}p ${bar} ${WARN_LIMIT}p (${percent}%)`,
      },
    ]);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Błąd podczas wykonywania komendy warn: ${errorMessage}`);
  }
}
