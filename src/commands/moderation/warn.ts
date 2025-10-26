import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, MessageFlags } from 'discord.js';
import { WarnModel, WarnDocument } from '../../models/Warn';
import type { ICommandOptions } from '../../interfaces/Command';
import { checkModPermissions } from '../../utils/moderationHelpers';
import { createBaseEmbed, formatWarnBar } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

const WARN_LIMIT = 4;

const WARN_PUNISHMENTS = {
  1: { duration: 15 * 60 * 1000, label: '15 minut' },      // 15 min
  2: { duration: 3 * 60 * 60 * 1000, label: '3 godziny' }, // 3h
  3: { duration: 24 * 60 * 60 * 1000, label: '1 dzień' },  // 24h
  4: { duration: 0, label: 'BAN' },                        // Auto-ban
} as const;

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
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'Ta komenda działa tylko na serwerze.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply();

  try {
    const targetUser =
      interaction.options.getUser('użytkownik') || interaction.options.getUser('uzytkownik');
    if (!targetUser) {
      await interaction.editReply('Nie podano użytkownika');
      return;
    }

    const reason = interaction.options.getString('powod');
    if (!reason) {
      await interaction.editReply('Nie podano powodu');
      return;
    }

    const guild = interaction.guild;
    const botId = interaction.client.user!.id;
    let member: GuildMember;

    try {
      member = await guild.members.fetch(targetUser.id);
    } catch {
      await interaction.editReply('Nie udało się znaleźć użytkownika na serwerze.');
      return;
    }
    if (
      !guild.members.me ||
      !checkModPermissions(member, interaction.member as GuildMember, guild.members.me)
    ) {
      logger.debug(
        `Warn command permissions check failed for ${interaction.user.tag} trying to warn ${targetUser.tag}`
      );
      await interaction.editReply('Nie masz uprawnień do ostrzegania tego użytkownika.');
      return;
    }

    let record = (await WarnModel.findOne({
      userId: targetUser.id,
      guildId: guild.id,
    })) as WarnDocument;
    if (!record) {
      record = new WarnModel({
        userId: targetUser.id,
        guildId: guild.id,
        warnings: [],
      }) as WarnDocument;
    }

    record.warnings.push({ 
      reason, 
      date: new Date(), 
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag 
    });

    await record.save();

    const count = record.warnings.length;

    // Sprawdź czy jest auto-ban (4 ostrzeżenie)
    if (count >= 4) {
      try {
        await member.ban({ reason: `Auto-ban: osiągnięto limit ostrzeżeń (${count})` });
        
        // Wyślij DM przed banem
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

    // Zwykłe ostrzeżenie z timeout
    const punishment = WARN_PUNISHMENTS[count as keyof typeof WARN_PUNISHMENTS];
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

    // Wyślij DM do użytkownika
    try {
      const nextPunishment = WARN_PUNISHMENTS[(count + 1) as keyof typeof WARN_PUNISHMENTS];
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
