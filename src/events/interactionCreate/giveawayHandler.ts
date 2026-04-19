import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  Client,
  TextChannel,
  GuildMember,
  MessageFlags,
} from 'discord.js';
import {
  joinGiveaway,
  leaveGiveaway,
  getActiveGiveaway,
  getGiveaway,
  GiveawayData,
} from '../../services/giveawayService';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { getBotConfig } from '../../config/bot';
import logger from '../../utils/logger';
import { chunk } from 'lodash';

export default async function run(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.isButton() || !interaction.customId) return;

  if (interaction.customId === 'giveaway_cancel_ephemeral') {
    await interaction.deferUpdate();
    await interaction.deleteReply();
    return;
  }

  try {
    const parts = interaction.customId.split('_');
    if (parts.length < 3 || parts[0] !== 'giveaway') {
      return;
    }

    const action = parts[1];
    const giveawayId = parts.slice(2).join('_');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // For 'count' action, allow viewing participants on ended giveaways too
    if (action === 'count') {
      const anyGiveawayResult = await getGiveaway(giveawayId, interaction.guild!.id);
      if (!anyGiveawayResult.ok) {
        await interaction.editReply({ content: 'Ten giveaway nie został znaleziony.' });
        return;
      }
      await handleShowParticipants(interaction, anyGiveawayResult.data);
      return;
    }

    const giveawayResult = await getActiveGiveaway(giveawayId, interaction.guild!.id);

    if (!giveawayResult.ok) {
      // If the giveaway is no longer active, fix the buttons on the original message
      if (giveawayResult.code === 'NOT_ACTIVE') {
        try {
          const endedResult = await getGiveaway(giveawayId, interaction.guild!.id);
          if (endedResult.ok) {
            const {
              emojis: {
                giveaway: { list: listEmoji },
              },
            } = getBotConfig(client.user!.id);

            const participantsButton = new ButtonBuilder()
              .setCustomId(`giveaway_count_${giveawayId}`)
              .setLabel(`Uczestnicy (${new Set(endedResult.data.participants).size})`)
              .setEmoji(listEmoji)
              .setStyle(ButtonStyle.Secondary);

            const endedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(participantsButton);
            await interaction.message.edit({ components: [endedRow] });
          }
        } catch (fixErr) {
          logger.warn(`Nie udało się naprawić przycisków zakończonego giveaway ${giveawayId}: ${fixErr}`);
        }
      }

      await interaction.editReply({
        content: giveawayResult.code === 'NOT_ACTIVE'
          ? 'Ten giveaway został już zakończony.'
          : 'Ten giveaway nie został znaleziony lub został już zakończony.',
      });
      return;
    }

    let giveaway = giveawayResult.data;

    let updated = false;
    switch (action) {
      case 'join': {
        const joinResult = await handleJoinGiveaway(interaction, giveaway);
        updated = joinResult.updated;
        if (joinResult.freshData) giveaway = joinResult.freshData;
        break;
      }

      case 'leave': {
        const leaveResult = await handleLeaveGiveaway(interaction, giveaway);
        updated = leaveResult.updated;
        if (leaveResult.freshData) giveaway = leaveResult.freshData;
        break;
      }

      case 'count':
        await handleShowParticipants(interaction, giveaway);
        break;

      default:
        await interaction.editReply({
          content: 'Nieznana akcja przycisku.',
        });
        return;
    }

    if (updated) {
      await updateGiveawayMessage(giveaway, client);
    }
  } catch (error) {
    logger.error(`Błąd podczas obsługi przycisku giveaway: ${error}`);

    try {
      await interaction.editReply({
        content: 'Wystąpił błąd podczas obsługi giveaway. Spróbuj ponownie później.',
      });
    } catch (replyError) {
      logger.error(`Nie można odpowiedzieć na interakcję: ${replyError}`);
    }
  }
}

async function handleJoinGiveaway(
  interaction: ButtonInteraction,
  giveaway: GiveawayData
): Promise<{ updated: boolean; freshData?: GiveawayData }> {
  const member = interaction.member as GuildMember;
  const memberRoleIds = [...member.roles.cache.keys()];

  const result = await joinGiveaway(
    giveaway.giveawayId,
    interaction.guild!.id,
    interaction.user.id,
    memberRoleIds,
  );

  if (!result.ok) {
    if (result.code === 'ALREADY_JOINED') {
      const leaveButton = new ButtonBuilder()
        .setCustomId(`giveaway_leave_${giveaway.giveawayId}`)
        .setLabel('Opuść giveaway')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId('giveaway_cancel_ephemeral')
        .setLabel('Anuluj')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(leaveButton, cancelButton);

      const embed = createBaseEmbed({
        title: '🎉 Już uczestniczysz',
        description:
          'Już dołączyłeś do tego giveawayu. Możesz opuścić giveaway naciskając przycisk poniżej.',
        color: COLORS.GIVEAWAY,
      });

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
      return { updated: false };
    }

    await interaction.editReply({ content: result.message });
    return { updated: false };
  }

  const { multiplier } = result.data;

  const embed = createBaseEmbed({
    title: '🎉 Dołączono do giveaway',
    description:
      multiplier > 1
        ? `Dołączyłeś do giveawayu! Dzięki posiadanym rolom, masz **${multiplier}x** większą szansę na wygraną!`
        : 'Dołączyłeś do giveawayu! Powodzenia!',
    color: COLORS.GIVEAWAY,
  });

  await interaction.editReply({ embeds: [embed] });

  // Reload giveaway data so updateGiveawayMessage sees fresh participants
  const freshResult = await getGiveaway(giveaway.giveawayId, interaction.guild!.id);
  return { updated: true, freshData: freshResult.ok ? freshResult.data : undefined };
}

async function handleLeaveGiveaway(
  interaction: ButtonInteraction,
  giveaway: GiveawayData
): Promise<{ updated: boolean; freshData?: GiveawayData }> {
  const result = await leaveGiveaway(
    giveaway.giveawayId,
    interaction.guild!.id,
    interaction.user.id,
  );

  if (!result.ok) {
    await interaction.editReply({ content: result.message });
    return { updated: false };
  }

  const embed = createBaseEmbed({
    title: '🎉 Opuszczono giveaway',
    description: 'Pomyślnie opuściłeś giveaway.',
    color: COLORS.GIVEAWAY,
  });

  await interaction.editReply({ embeds: [embed] });

  // Reload giveaway data so updateGiveawayMessage sees fresh participants
  const freshResult = await getGiveaway(giveaway.giveawayId, interaction.guild!.id);
  return { updated: true, freshData: freshResult.ok ? freshResult.data : undefined };
}

async function updateGiveawayMessage(giveaway: GiveawayData, client: Client): Promise<void> {
  try {
    const guild = client.guilds.cache.get(giveaway.guildId);
    if (!guild) return;

    const {
      emojis: {
        giveaway: { join: joinEmoji, list: listEmoji },
      },
    } = getBotConfig(client.user!.id);

    const channel = guild.channels.cache.get(giveaway.channelId);
    if (!channel || !('messages' in channel)) return;

    const textChannel = channel as TextChannel;
    const msg = await textChannel.messages.fetch(giveaway.messageId).catch(() => null);
    if (!msg) return;

    const totalTickets = giveaway.participants.length || 1;
    const chance = Math.min(100, (giveaway.winnersCount / totalTickets) * 100);
    const chanceLabel = `${chance.toFixed(1).replace(/\.0$/, '')}%`;

    const uniqueCount = new Set(giveaway.participants).size;

    const joinButton = new ButtonBuilder()
      .setCustomId(`giveaway_join_${giveaway.giveawayId}`)
      .setLabel(`Dołącz do konkursu (${chanceLabel})`)
      .setEmoji(joinEmoji)
      .setStyle(ButtonStyle.Secondary);

    const countButton = new ButtonBuilder()
      .setCustomId(`giveaway_count_${giveaway.giveawayId}`)
      .setLabel(`Lista (${uniqueCount})`)
      .setEmoji(listEmoji)
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, countButton);

    await msg.edit({ components: [row] });
  } catch (err) {
    logger.error(`Błąd podczas aktualizacji wiadomości giveaway: ${err}`);
  }
}

async function handleShowParticipants(
  interaction: ButtonInteraction,
  giveaway: GiveawayData
): Promise<void> {
  const uniqueIds = [...new Set(giveaway.participants)];
  if (uniqueIds.length === 0) {
    await interaction.editReply('Nikt jeszcze nie dołączył do tego giveawayu.');
    return;
  }

  const users = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const member = await interaction.guild!.members.fetch(id);
        return member.user.username;
      } catch {
        return `Unknown (${id})`;
      }
    })
  );

  const pages = chunk(users, 30).map((page, i, arr) => ({
    name: `Uczestnicy (${uniqueIds.length})${arr.length > 1 ? `  – str. ${i + 1}/${arr.length}` : ''}`,
    value: page.map((u, idx) => `${idx + 1 + i * 30}. ${u}`).join('\n'),
  }));

  const embed = createBaseEmbed({
    title: '🎉 Lista uczestników',
    color: COLORS.GIVEAWAY,
  }).addFields(pages);

  await interaction.editReply({ embeds: [embed] });
}
