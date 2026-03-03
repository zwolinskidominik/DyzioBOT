import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  TextChannel,
  Collection,
  Message,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { sendLog } from '../../utils/logHelpers';
import logger from '../../utils/logger';

/**
 * Discord API limits for bulk message deletion:
 * - bulkDelete() accepts 2-100 messages per call
 * - Messages older than 14 days cannot be bulk deleted
 * - Rate limit: ~1 req/sec for the bulk delete endpoint
 * - Individual deletion (for old messages): ~5 req/5s per channel
 *
 * Strategy: we use bulkDelete(messages, true) which automatically
 * filters out messages older than 14 days. For the user this means
 * some messages may be skipped if they're too old – we report
 * the actual number deleted.
 */

const MAX_FETCH = 100;
const MAX_PURGE = 500;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Usuwa określoną liczbę wiadomości z kanału.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addIntegerOption((option) =>
    option
      .setName('ilosc')
      .setDescription('Liczba wiadomości do usunięcia (1-500).')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(MAX_PURGE)
  )
  .addUserOption((option) =>
    option
      .setName('uzytkownik')
      .setDescription('Usuń tylko wiadomości tego użytkownika.')
      .setRequired(false)
  );

export const options = {
  userPermissions: PermissionFlagsBits.ManageMessages,
  botPermissions: PermissionFlagsBits.ManageMessages,
  guildOnly: true,
};

export async function run({ interaction, client }: ICommandOptions): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const amount = interaction.options.getInteger('ilosc', true);
  const targetUser = interaction.options.getUser('uzytkownik');
  const channel = interaction.channel as TextChannel;

  if (!channel || !('bulkDelete' in channel)) {
    await interaction.editReply({
      embeds: [
        createBaseEmbed({
          isError: true,
          description: '❌ Tej komendy można użyć tylko na kanale tekstowym.',
        }),
      ],
    });
    return;
  }

  try {
    let totalDeleted = 0;
    let remaining = amount;

    while (remaining > 0) {
      // Fetch up to 100 messages at a time
      const fetchLimit = Math.min(remaining, MAX_FETCH);
      const fetched: Collection<string, Message> = await channel.messages.fetch({
        limit: targetUser ? MAX_FETCH : fetchLimit,
      });

      if (fetched.size === 0) break;

      let toDelete: Collection<string, Message>;

      if (targetUser) {
        // Filter to only the target user's messages
        const filtered = fetched.filter((m) => m.author.id === targetUser.id);
        // Take only what we need
        toDelete = new Collection(
          [...filtered.entries()].slice(0, remaining)
        );
      } else {
        toDelete = fetched;
      }

      if (toDelete.size === 0) break;

      // Filter out messages older than 14 days (bulkDelete would reject them)
      const now = Date.now();
      const deletable = toDelete.filter(
        (m) => now - m.createdTimestamp < TWO_WEEKS_MS
      );

      if (deletable.size === 0) break;

      const deleted = await channel.bulkDelete(deletable, true);
      totalDeleted += deleted.size;
      remaining -= deleted.size;

      // If we got fewer than expected, there's nothing more to delete
      if (deleted.size < deletable.size || deleted.size === 0) break;
    }

    const description = targetUser
      ? `🗑️ Usunięto **${totalDeleted}** wiadomości użytkownika <@${targetUser.id}>.`
      : `🗑️ Usunięto **${totalDeleted}** wiadomości.`;

    const embed = createBaseEmbed({
      description,
      footerText: interaction.guild?.name,
    });

    await interaction.editReply({ embeds: [embed] });

    // Send audit log
    await sendLog(client, interaction.guildId!, 'messageDelete', {
      title: '🗑️ Masowe usunięcie wiadomości',
      description: targetUser
        ? `**Moderator:** <@${interaction.user.id}>\n**Kanał:** <#${channel.id}>\n**Ilość:** ${totalDeleted}\n**Filtr:** wiadomości <@${targetUser.id}>`
        : `**Moderator:** <@${interaction.user.id}>\n**Kanał:** <#${channel.id}>\n**Ilość:** ${totalDeleted}`,
    });

    logger.info(
      `[clear] ${interaction.user.tag} usunął ${totalDeleted} wiadomości na #${channel.name}` +
        (targetUser ? ` (filtr: ${targetUser.tag})` : '')
    );
  } catch (error) {
    logger.error(`[clear] Błąd: ${error}`);
    await interaction.editReply({
      embeds: [
        createBaseEmbed({
          isError: true,
          description: '❌ Wystąpił błąd podczas usuwania wiadomości.',
        }),
      ],
    });
  }
}
