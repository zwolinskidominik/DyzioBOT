import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { getModFailMessage, applyTimeoutSafely } from '../../utils/moderationHelpers';
import { createBaseEmbed, createErrorEmbed, formatWarnBar } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { addWarn, WarnStep } from '../../services/warnService';
import { checkCommandAccess } from '../../services/moderationConfigService';
import { logModerationAction } from '../../services/moderationLogService';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Ostrzeż użytkownika zgodnie z drabinką kar serwera')
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
  // userPermissions celowo pominięte — dostęp sprawdzamy ręcznie w run() przez
  // checkCommandAccess(), bo extraRoleIds z ModerationConfig ma prawo przepuścić
  // moderatora BEZ natywnego uprawnienia Discorda. CommandHandler zablokowałby
  // taką osobę zanim ta logika w ogóle się wykona.
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
    const requester = interaction.member as GuildMember;

    const access = await checkCommandAccess({
      guildId: guild.id,
      member: requester,
      commandKey: 'warn',
      requiredPermission: PermissionFlagsBits.ModerateMembers,
    });
    if (!access.allowed) {
      await interaction.editReply({ embeds: [createErrorEmbed(access.reason ?? 'Brak uprawnień.')] });
      return;
    }
    const { config } = access;

    let member: GuildMember;
    try {
      member = await guild.members.fetch(targetUser.id);
    } catch {
      await interaction.editReply({ embeds: [createErrorEmbed('Nie udało się znaleźć użytkownika na serwerze.')] });
      return;
    }
    const failMessage = getModFailMessage(member, requester, guild.members.me ?? null, 'warn');
    if (failMessage) {
      logger.debug(
        `Warn command permissions check failed for ${interaction.user.tag} trying to warn ${targetUser.tag}`
      );
      await interaction.editReply({ embeds: [createErrorEmbed(failMessage)] });
      return;
    }

    const effectiveSteps: WarnStep[] =
      config.warnMode === 'single'
        ? [{ action: config.warnSingle.action, durationMinutes: config.warnSingle.durationMinutes }]
        : config.warnSteps.map((s) => ({ action: s.action, durationMinutes: s.durationMinutes }));

    const result = await addWarn({
      guildId: guild.id,
      userId: targetUser.id,
      reason,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      steps: effectiveSteps,
    });

    if (!result.ok) {
      await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
      return;
    }

    const { count, step, nextStep, isFinal, warnEntryId } = result.data;
    const limit = effectiveSteps.length;
    const shouldDm = config.warnDm;
    // Gate tylko dla ModerationLog (dashboard, zakładka "Otrzymane kary") — kanał logów Discorda
    // (sendLog niżej) ma WŁASNY, niezależny system włącz/wyłącz per event (LogConfiguration).
    const shouldWriteLog = config.warn.log;

    if (step.action === 'ban') {
      try {
        await member.ban({ reason: `Auto-ban: osiągnięto limit ostrzeżeń (${count})` });

        if (shouldDm) {
          try {
            await targetUser.send({
              embeds: [createBaseEmbed({
                title: '🚫 Zostałeś zbanowany',
                description:
                  `**Serwer:** ${guild.name}\n` +
                  `**Powód ostrzeżenia:** ${reason}\n` +
                  `**Moderator:** <@${interaction.user.id}>\n\n` +
                  `⚠️ **Osiągnięto limit ostrzeżeń (${count}/${limit})**\n` +
                  `Zostałeś permanentnie zbanowany z serwera.`,
                color: COLORS.ERROR,
              })]
            });
          } catch {
            logger.debug(`Nie można wysłać DM do ${targetUser.tag}`);
          }
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
            value: `Ban: ${count}p ${formatWarnBar(botId, count)} ${limit}p (100%)`,
          },
        ]);

        await interaction.editReply({ embeds: [embed] });

        await sendLog(interaction.client, guild.id, 'moderationCommand', {
          title: null,
          description: `**⚖️ Użyto komendy \`/warn\` wobec <@${targetUser.id}> — auto-ban po ${count} ostrzeżeniach.**`,
          fields: [
            { name: 'Powód', value: reason, inline: false },
            { name: 'Kara', value: '**PERMANENTNY BAN**', inline: false },
            moderatorField(interaction.user.id),
          ],
          authorName: targetUser.tag,
          authorIcon: targetUser.displayAvatarURL({ size: 64 }),
        }, { userId: targetUser.id, member });

        if (shouldWriteLog) {
          await logModerationAction({
            guildId: guild.id,
            kind: 'warn',
            targetId: targetUser.id,
            targetTag: targetUser.tag,
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason,
            extra: step.label,
            warnEntryId,
          });
        }

        return;
      } catch (err) {
        logger.error(`Błąd przy banowaniu ${member.id}: ${err}`);
      }
    }

    if (step.action === 'kick') {
      try {
        if (shouldDm) {
          try {
            await targetUser.send({
              embeds: [createBaseEmbed({
                title: '👢 Zostałeś wyrzucony',
                description:
                  `**Serwer:** ${guild.name}\n` +
                  `**Powód ostrzeżenia:** ${reason}\n` +
                  `**Moderator:** <@${interaction.user.id}>\n\n` +
                  `⚠️ **Osiągnięto ${count}/${limit} ostrzeżeń** — zostałeś wyrzucony z serwera.`,
                color: COLORS.ERROR,
              })]
            });
          } catch {
            logger.debug(`Nie można wysłać DM do ${targetUser.tag}`);
          }
        }

        await member.kick(reason);

        const embed = createBaseEmbed({
          title: `👢 Auto-kick: ${count} ostrzeżeń`,
          color: COLORS.ERROR,
          timestamp: false,
        }).addFields([
          { name: 'Użytkownik', value: `<@!${targetUser.id}>`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Powód', value: reason, inline: false },
          { name: 'Kara', value: '**WYRZUCENIE Z SERWERA**', inline: false },
        ]);

        await interaction.editReply({ embeds: [embed] });

        await sendLog(interaction.client, guild.id, 'moderationCommand', {
          title: null,
          description: `**⚖️ Użyto komendy \`/warn\` wobec <@${targetUser.id}> — auto-kick po ${count} ostrzeżeniach.**`,
          fields: [
            { name: 'Powód', value: reason, inline: false },
            { name: 'Kara', value: '**WYRZUCENIE Z SERWERA**', inline: false },
            moderatorField(interaction.user.id),
          ],
          authorName: targetUser.tag,
          authorIcon: targetUser.displayAvatarURL({ size: 64 }),
        }, { userId: targetUser.id, member });

        if (shouldWriteLog) {
          await logModerationAction({
            guildId: guild.id,
            kind: 'warn',
            targetId: targetUser.id,
            targetTag: targetUser.tag,
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason,
            extra: step.label,
            warnEntryId,
          });
        }

        return;
      } catch (err) {
        logger.error(`Błąd przy wyrzucaniu ${member.id}: ${err}`);
      }
    }

    // 'mute' lub 'none'
    const muteDurationMs = step.action === 'mute' ? step.durationMs : 0;

    const { muteEndTs, muteFailed } = await applyTimeoutSafely(member, muteDurationMs, reason);
    const muteStatusText = muteFailed
      ? '❌ Nie udało się nałożyć (brak uprawnień — użytkownik ma prawdopodobnie rolę Administratora)'
      : 'Brak wyciszenia';

    if (shouldDm) {
      try {
        const consequencesText = !isFinal ? `\n\n⚠️ **Kolejne ostrzeżenie:** ${nextStep.label}` : '';

        await targetUser.send({
          embeds: [createBaseEmbed({
            title: '⚠️ Otrzymałeś ostrzeżenie',
            description:
              `**Serwer:** ${guild.name}\n` +
              `**Powód:** ${reason}\n` +
              `**Moderator:** <@${interaction.user.id}>\n` +
              `**Kara:** ${muteEndTs ? `${step.label} wyciszenia` : muteFailed ? 'nie udało się nałożyć wyciszenia (brak uprawnień)' : 'Brak wyciszenia'}\n` +
              `**Ostrzeżenia:** ${count}/${limit}` +
              consequencesText,
            color: COLORS.WARN,
          })]
        });
      } catch {
        logger.debug(`Nie można wysłać DM do ${targetUser.tag}`);
      }
    }

    const bar = formatWarnBar(botId, count);
    const percent = Math.min(100, Math.round((count / limit) * 100));

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
        value: muteEndTs ? `<t:${muteEndTs}:F>` : muteStatusText,
        inline: false,
      },
      {
        name: 'Suma punktów',
        value: `Ban: ${count}p ${bar} ${limit}p (${percent}%)`,
      },
    ]);

    await interaction.editReply({ embeds: [embed] });

    await sendLog(interaction.client, guild.id, 'moderationCommand', {
      title: null,
      description: `**⚖️ Użyto komendy \`/warn\` wobec <@${targetUser.id}>.**`,
      fields: [
        { name: 'Powód', value: reason, inline: false },
        {
          name: 'Kara',
          value: muteEndTs ? `Wyciszenie do <t:${muteEndTs}:F>` : muteStatusText,
          inline: true,
        },
        { name: 'Ostrzeżenia', value: `${count}/${limit}`, inline: true },
        moderatorField(interaction.user.id),
      ],
      authorName: targetUser.tag,
      authorIcon: targetUser.displayAvatarURL({ size: 64 }),
    }, { userId: targetUser.id, member });

    if (shouldWriteLog) {
      await logModerationAction({
        guildId: guild.id,
        kind: 'warn',
        targetId: targetUser.id,
        targetTag: targetUser.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason,
        extra: step.label,
        warnEntryId,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Błąd podczas wykonywania komendy warn: ${errorMessage}`);
  }
}
