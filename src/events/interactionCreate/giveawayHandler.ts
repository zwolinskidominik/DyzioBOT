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
import { GiveawayModel, GiveawayDocument } from '../../models/Giveaway';
import { GiveawayConfigModel } from '../../models/GiveawayConfig';
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

    const giveaway = (await GiveawayModel.findOne({
      giveawayId,
      guildId: interaction.guild!.id,
    })) as GiveawayDocument | null;

    if (!giveaway) {
      await interaction.editReply({
        content: 'Ten giveaway nie został znaleziony lub został już zakończony.',
      });
      return;
    }

    if (!giveaway.active) {
      await interaction.editReply({
        content: 'Ten giveaway został już zakończony.',
      });
      return;
    }

    let updated = false;
    switch (action) {
      case 'join':
        updated = await handleJoinGiveaway(interaction, giveaway);
        break;

      case 'leave':
        updated = await handleLeaveGiveaway(interaction, giveaway);
        break;

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
  giveaway: GiveawayDocument
): Promise<boolean> {
  if (giveaway.participants.includes(interaction.user.id)) {
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

    return false;
  }

  // Merge mnożników: globalne + nadpisanie per-giveaway
  let multiplier = 1;
  const member = interaction.member as GuildMember;
  const memberRoles = member.roles.cache;

  const finalMultipliers: Record<string, number> = {};

  // 1. Zacznij od globalnych mnożników z GiveawayConfig
  try {
    const config = await GiveawayConfigModel.findOne({ guildId: interaction.guild!.id });
    if (config?.enabled && config.roleMultipliers?.length > 0) {
      for (const rm of config.roleMultipliers) {
        finalMultipliers[rm.roleId] = rm.multiplier;
      }
    }
  } catch (error) {
    logger.debug(`Nie udało się pobrać konfiguracji giveaway: ${error}`);
  }

  // 2. Nadpisz/dodaj per-giveaway mnożniki
  if (giveaway.roleMultipliers && Object.keys(giveaway.roleMultipliers).length > 0) {
    for (const [roleId, mult] of Object.entries(giveaway.roleMultipliers)) {
      finalMultipliers[roleId] = mult;
    }
  }

  // 3. Sprawdź który mnożnik użytkownik ma (najwyższy)
  for (const [roleId, mult] of Object.entries(finalMultipliers)) {
    if (memberRoles.has(roleId) && mult > multiplier) {
      multiplier = mult;
    }
  }

  // Dodaj użytkownika wielokrotnie według mnożnika
  for (let i = 0; i < multiplier; i++) {
    giveaway.participants.push(interaction.user.id);
  }

  await giveaway.save();

  const embed = createBaseEmbed({
    title: '🎉 Dołączono do giveaway',
    description:
      multiplier > 1
        ? `Dołączyłeś do giveawayu! Dzięki posiadanym rolom, masz **${multiplier}x** większą szansę na wygraną!`
        : 'Dołączyłeś do giveawayu! Powodzenia!',
    color: COLORS.GIVEAWAY,
  });

  await interaction.editReply({ embeds: [embed] });
  return true;
}

async function handleLeaveGiveaway(
  interaction: ButtonInteraction,
  giveaway: GiveawayDocument
): Promise<boolean> {
  if (!giveaway.participants.includes(interaction.user.id)) {
    await interaction.editReply({
      content: 'Nie jesteś zapisany do tego giveawayu.',
    });
    return false;
  }

  giveaway.participants = giveaway.participants.filter((id: string) => id !== interaction.user.id);

  await giveaway.save();

  const embed = createBaseEmbed({
    title: '🎉 Opuszczono giveaway',
    description: 'Pomyślnie opuściłeś giveaway.',
    color: COLORS.GIVEAWAY,
  });

  await interaction.editReply({ embeds: [embed] });
  return true;
}

async function updateGiveawayMessage(giveaway: GiveawayDocument, client: Client): Promise<void> {
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
  giveaway: GiveawayDocument
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
