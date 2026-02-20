import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  TextChannel,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import {
  createGiveaway,
  editGiveaway,
  deleteGiveaway,
  endGiveaway,
  listActiveGiveaways,
  rerollGiveaway,
  parseDuration,
  getAdditionalNote,
} from '../../services/giveawayService';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { getBotConfig } from '../../config/bot';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('System giveaway - zarządzanie konkursami z nagrodami')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('create')
      .setDescription('Tworzy nowy giveaway')
      .addStringOption((option) =>
        option.setName('nagroda').setDescription('Nagroda giveawayu').setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('opis').setDescription('Treść giveawayu').setRequired(true)
      )
      .addIntegerOption((option) =>
        option.setName('liczba_wygranych').setDescription('Liczba wygranych').setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('czas_trwania')
          .setDescription("Czas trwania giveawayu (np. '5 days 4 hours 2 minutes')")
          .setRequired(true)
      )
      .addRoleOption((option) =>
        option.setName('ping').setDescription('Rola do pingowania (opcjonalnie)').setRequired(false)
      )
      .addRoleOption((option) =>
        option
          .setName('mnoznik_roli')
          .setDescription('Rola z mnożnikiem TYLKO dla tego giveawaya (opcjonalnie)')
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('mnoznik')
          .setDescription('Mnożnik dla powyższej roli (domyślnie 2)')
          .setMinValue(2)
          .setMaxValue(10)
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('edit')
      .setDescription('Edytuje istniejący giveaway')
      .addStringOption((option) =>
        option.setName('id').setDescription('ID giveawayu do edycji').setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('nagroda').setDescription('Nowa nagroda giveawayu').setRequired(false)
      )
      .addStringOption((option) =>
        option.setName('opis').setDescription('Nowa treść giveawayu').setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('liczba_wygranych')
          .setDescription('Nowa liczba wygranych')
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('czas_trwania')
          .setDescription("Nowy czas trwania giveawayu (np. '5 days 4 hours 2 minutes')")
          .setRequired(false)
      )
      .addRoleOption((option) =>
        option
          .setName('ping')
          .setDescription('Nowa rola do pingowania (opcjonalnie)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('remove')
      .setDescription('Usuwa istniejący giveaway')
      .addStringOption((option) =>
        option.setName('id').setDescription('ID giveawayu do usunięcia').setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('end')
      .setDescription('Kończy działający giveaway i losuje zwycięzców')
      .addStringOption((option) =>
        option.setName('id').setDescription('ID giveawayu do zakończenia').setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('list').setDescription('Wyświetla listę aktywnych giveawayów')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('reroll')
      .setDescription('Losuje nowych zwycięzców dla zakończonego giveawayu')
      .addStringOption((option) =>
        option.setName('id').setDescription('ID giveawayu do rerollu').setRequired(true)
      )
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'create':
        await handleCreateGiveaway(interaction);
        break;
      case 'edit':
        await handleEditGiveaway(interaction);
        break;
      case 'remove':
        await handleDeleteGiveaway(interaction);
        break;
      case 'end':
        await handleEndGiveaway(interaction);
        break;
      case 'list':
        await handleListGiveaways(interaction);
        break;
      case 'reroll':
        await handleRerollGiveaway(interaction);
        break;
      default:
        await interaction.reply({
          embeds: [createErrorEmbed('Nieznana subkomenda.')],
          flags: MessageFlags.Ephemeral,
        });
    }
  } catch (error) {
    logger.error(`Błąd w komendzie giveaway (${subcommand}): ${error}`);

    try {
      const errorEmbed = createErrorEmbed('Wystąpił błąd podczas wykonywania operacji. Spróbuj ponownie później.');

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      logger.error(`Nie można odpowiedzieć na interakcję: ${replyError}`);
    }
  }
}

function getTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

async function handleCreateGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const prize = interaction.options.getString('nagroda', true);
  const description = interaction.options.getString('opis', true);
  const winnersCount = interaction.options.getInteger('liczba_wygranych', true);
  const durationStr = interaction.options.getString('czas_trwania', true);
  const pingRole = interaction.options.getRole('ping');
  const multiplierRole = interaction.options.getRole('mnoznik_roli');
  const multiplier = interaction.options.getInteger('mnoznik') || 2;

  const durationMs = parseDuration(durationStr);
  if (isNaN(durationMs) || durationMs <= 0) {
    await interaction.editReply({
      embeds: [createErrorEmbed("Podaj poprawny czas trwania giveawayu (np. '5 days 4 hours 2 minutes').")],
    });
    return;
  }

  const endTime = new Date(Date.now() + durationMs);
  const timestamp = getTimestamp(endTime);

  const additionalNote = await getAdditionalNote(interaction.guild!.id);

  // Build placeholder embed + buttons, then send message to get messageId
  const placeholderEmbed = createBaseEmbed({
    description: `### ${prize}\n${description}${additionalNote}\n\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Host:** <@${interaction.user.id}>\n**Zwycięzcy:** ${winnersCount}`,
    footerText: `Giveaway`,
    color: COLORS.GIVEAWAY,
  });

  const {
    emojis: {
      giveaway: { join: joinEmoji, list: listEmoji },
    },
  } = getBotConfig(interaction.client.application!.id);

  const joinButton = new ButtonBuilder()
    .setCustomId(`giveaway_join_placeholder`)
    .setLabel(`Dołącz do konkursu (100%)`)
    .setEmoji(joinEmoji)
    .setStyle(ButtonStyle.Secondary);

  const countButton = new ButtonBuilder()
    .setCustomId(`giveaway_count_placeholder`)
    .setLabel(`Lista (0)`)
    .setEmoji(listEmoji)
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, countButton);
  const content = `${pingRole ? `<@&${pingRole.id}>\n` : ''}`;

  const channel = interaction.channel as TextChannel;
  const giveawayMessage = await channel.send({ content, embeds: [placeholderEmbed], components: [row] });

  let roleMultipliers: Record<string, number> | undefined;
  if (multiplierRole && multiplier > 1) {
    roleMultipliers = { [multiplierRole.id]: multiplier };
  }

  const result = await createGiveaway({
    guildId: interaction.guild!.id,
    channelId: interaction.channel!.id,
    messageId: giveawayMessage.id,
    prize,
    description,
    winnersCount,
    durationMs,
    hostId: interaction.user.id,
    pingRoleId: pingRole ? pingRole.id : undefined,
    roleMultipliers,
  });

  if (!result.ok) {
    await giveawayMessage.delete().catch(() => null);
    await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
    return;
  }

  const ga = result.data;

  // Update message with real giveaway ID in buttons + footer
  const realEmbed = createBaseEmbed({
    description: `### ${prize}\n${description}${additionalNote}\n\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Host:** <@${interaction.user.id}>\n**Zwycięzcy:** ${winnersCount}`,
    footerText: `Giveaway ID: ${ga.giveawayId}`,
    color: COLORS.GIVEAWAY,
  });

  const realJoinButton = new ButtonBuilder()
    .setCustomId(`giveaway_join_${ga.giveawayId}`)
    .setLabel(`Dołącz do konkursu (100%)`)
    .setEmoji(joinEmoji)
    .setStyle(ButtonStyle.Secondary);

  const realCountButton = new ButtonBuilder()
    .setCustomId(`giveaway_count_${ga.giveawayId}`)
    .setLabel(`Lista (0)`)
    .setEmoji(listEmoji)
    .setStyle(ButtonStyle.Secondary);

  const realRow = new ActionRowBuilder<ButtonBuilder>().addComponents(realJoinButton, realCountButton);
  await giveawayMessage.edit({ embeds: [realEmbed], components: [realRow] });

  const confirmEmbed = createBaseEmbed({
    title: '🎉 Giveaway utworzony',
    description: `Pomyślnie utworzono nowy giveaway!\n\n**Nagroda:** ${prize}\n**Koniec:** <t:${timestamp}:R>\n**ID:** \`${ga.giveawayId}\``,
    color: COLORS.GIVEAWAY,
  });

  await interaction.editReply({ embeds: [confirmEmbed] });
}

async function handleEditGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const giveawayId = interaction.options.getString('id', true);
  const newPrize = interaction.options.getString('nagroda');
  const newDescription = interaction.options.getString('opis');
  const newWinners = interaction.options.getInteger('liczba_wygranych');
  const newDurationStr = interaction.options.getString('czas_trwania');
  const newPingRole = interaction.options.getRole('ping');

  const durationMs = newDurationStr ? parseDuration(newDurationStr) : undefined;
  if (durationMs !== undefined && (!durationMs || durationMs <= 0)) {
    await interaction.editReply({
      embeds: [createErrorEmbed("Podaj poprawny czas trwania giveawayu (np. '5 days 4 hours 2 minutes').")],
    });
    return;
  }

  const result = await editGiveaway(giveawayId, interaction.guild!.id, {
    prize: newPrize ?? undefined,
    description: newDescription ?? undefined,
    winnersCount: newWinners ?? undefined,
    durationMs,
    pingRoleId: newPingRole?.id,
  });

  if (!result.ok) {
    await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
    return;
  }

  const ga = result.data;

  // Update Discord message
  const channel = interaction.guild!.channels.cache.get(ga.channelId) as TextChannel | undefined;
  if (channel) {
    let giveawayMessage: Message | undefined;
    try {
      giveawayMessage = await channel.messages.fetch(ga.messageId);
    } catch (err) {
      logger.warn(`Nie udało się pobrać wiadomości giveaway: ${err}`);
    }

    if (giveawayMessage) {
      const additionalNote = await getAdditionalNote(interaction.guild!.id);
      const timestamp = getTimestamp(ga.endTime);
      const updatedEmbed = createBaseEmbed({
        description: `### ${ga.prize}\n${ga.description}${additionalNote}\n\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Host:** <@${ga.hostId}>\n**Zwycięzcy:** ${ga.winnersCount}`,
        footerText: `Giveaway ID: ${ga.giveawayId}`,
        color: COLORS.GIVEAWAY,
      });
      await giveawayMessage.edit({ embeds: [updatedEmbed] });
    }
  }

  const timestamp = getTimestamp(ga.endTime);
  const confirmEmbed = createBaseEmbed({
    title: '🎉 Giveaway zaktualizowany',
    description: `Pomyślnie zaktualizowano giveaway!\n\n**ID:** \`${ga.giveawayId}\`\n**Nagroda:** ${ga.prize}\n**Koniec:** <t:${timestamp}:R>`,
    color: COLORS.GIVEAWAY,
  });

  await interaction.editReply({ embeds: [confirmEmbed] });
  logger.info(`Zaktualizowano giveaway (ID: ${giveawayId}) przez ${interaction.user.tag}`);
}

async function handleDeleteGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const giveawayId = interaction.options.getString('id', true);
  const result = await deleteGiveaway(giveawayId, interaction.guild!.id);

  if (!result.ok) {
    await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
    return;
  }

  const { messageId, channelId } = result.data;

  const channel = interaction.guild!.channels.cache.get(channelId) as TextChannel | undefined;
  if (channel) {
    try {
      const message = await channel.messages.fetch(messageId);
      if (message) await message.delete();
    } catch (err) {
      logger.warn(`Nie udało się usunąć wiadomości giveawayu (ID: ${messageId}): ${err}`);
    }
  } else {
    logger.warn(`Kanał o ID ${channelId} nie został znaleziony.`);
  }

  const confirmEmbed = createBaseEmbed({
    title: '🎉 Giveaway usunięty',
    description: `Pomyślnie usunięto giveaway o ID: \`${giveawayId}\``,
    color: COLORS.GIVEAWAY,
  });

  await interaction.editReply({ embeds: [confirmEmbed] });
  logger.info(`Usunięto giveaway (ID: ${giveawayId}) przez ${interaction.user.tag}`);
}

async function handleEndGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const giveawayId = interaction.options.getString('id', true);
  const result = await endGiveaway(giveawayId, interaction.guild!.id);

  if (!result.ok) {
    await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
    return;
  }

  const { giveaway: ga, winnerIds } = result.data;

  const channel = interaction.guild!.channels.cache.get(ga.channelId) as TextChannel | undefined;
  if (!channel) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie znaleziono kanału, na którym został uruchomiony ten giveaway.')],
    });
    return;
  }

  let giveawayMessage: Message | undefined;
  try {
    giveawayMessage = await channel.messages.fetch(ga.messageId);
  } catch (err) {
    logger.warn(`Nie udało się pobrać wiadomości giveaway: ${err}`);
    await interaction.editReply({ embeds: [createErrorEmbed('Nie udało się pobrać wiadomości giveawayu.')] });
    return;
  }

  // Resolve winner mentions
  const winnersText = winnerIds.length
    ? winnerIds.map((id) => `<@${id}>`).join(', ')
    : 'Brak zwycięzców';

  const participantsCount = ga.participants.length;
  const timestamp = getTimestamp(ga.endTime);

  const updatedEmbed = createBaseEmbed({
    description: `### ${ga.prize}\n${ga.description}\n\n**Zakończony:** <t:${timestamp}:f>\n**Host:** <@${ga.hostId}>\n**Uczestnicy:** ${participantsCount}\n**Zwycięzcy:** ${winnersText}`,
    footerText: `Giveaway ID: ${ga.giveawayId}`,
    color: COLORS.GIVEAWAY_ENDED,
  });

  await giveawayMessage.edit({
    content: '### 🎉 🎉 Giveaway zakończony 🎉 🎉',
    embeds: [updatedEmbed],
    components: [],
  });

  {
    const winnerContent = winnerIds.length
      ? `🎉 Gratulacje ${winnerIds.map((id) => `<@${id}>`).join(', ')}! **${ga.prize}** jest Twoje!`
      : 'Brak zgłoszeń, więc nie udało się wyłonić zwycięzcy!';
    let sent = false;
    try {
      await giveawayMessage.reply({ content: winnerContent });
      sent = true;
    } catch (err) {
      logger.warn(`End giveaway: reply nie wysłany (spróbuję channel.send): ${err}`);
    }
    if (!sent) {
      try {
        await (channel as TextChannel).send({
          content: winnerContent,
          reply: { messageReference: giveawayMessage.id },
        });
      } catch (fallbackErr) {
        logger.error(`End giveaway: channel.send także nieudane: ${fallbackErr}`);
      }
    }
  }

  const confirmEmbed = createBaseEmbed({
    title: '🎉 Giveaway zakończony',
    description: `Giveaway został zakończony.\n\n**ID:** \`${giveawayId}\`\n**Nagroda:** ${ga.prize}\n**Zwycięzcy:** ${winnersText}`,
    color: COLORS.GIVEAWAY_ENDED,
  });

  await interaction.editReply({ embeds: [confirmEmbed] });
  logger.info(`Zakończono giveaway (ID: ${giveawayId}) przez ${interaction.user.tag}`);
}

async function handleListGiveaways(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await listActiveGiveaways(interaction.guild!.id);

  if (!result.ok) {
    await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
    return;
  }

  const list = result.data;
  const description = list
    .map((g) => {
      const timestamp = getTimestamp(g.endTime);
      return `**ID:** \`${g.giveawayId}\`\n**Nagroda:** ${g.prize}\n**Liczba wygranych:** ${g.winnersCount}\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Uczestnicy:** ${g.participantsCount}`;
    })
    .join('\n\n');

  const embed = createBaseEmbed({
    title: '🎉 Aktywne Giveawaye',
    description,
    color: COLORS.GIVEAWAY,
    footerText: `Łącznie: ${list.length} giveawayów`,
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleRerollGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const giveawayId = interaction.options.getString('id', true);
  const result = await rerollGiveaway(giveawayId, interaction.guild!.id);

  if (!result.ok) {
    await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
    return;
  }

  const { giveaway: ga, winnerIds } = result.data;

  const channel = interaction.guild!.channels.cache.get(ga.channelId) as TextChannel | undefined;
  if (!channel) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie znaleziono kanału, na którym został uruchomiony ten giveaway.')],
    });
    return;
  }

  let giveawayMessage: Message | undefined;
  try {
    giveawayMessage = await channel.messages.fetch(ga.messageId);
  } catch (err) {
    logger.warn(`Nie udało się pobrać wiadomości giveaway: ${err}`);
    await interaction.editReply({ embeds: [createErrorEmbed('Nie można pobrać wiadomości giveawayu.')] });
    return;
  }

  const winnersText = winnerIds.length
    ? winnerIds.map((id) => `<@${id}>`).join(', ')
    : 'Brak zwycięzców';

  const timestamp = getTimestamp(ga.endTime);

  const updatedEmbed = createBaseEmbed({
    description: `### ${ga.prize}\n${ga.description}\n\n**Zakończony:** <t:${timestamp}:f>\n**Host:** <@${ga.hostId}>\n**Uczestnicy:** ${ga.participants.length}\n**Zwycięzcy (reroll):** ${winnersText}`,
    footerText: `Giveaway ID: ${ga.giveawayId}`,
    color: COLORS.GIVEAWAY_ENDED,
  });

  await giveawayMessage.edit({
    content: '### 🎉 🎉 Giveaway zakończony 🎉 🎉',
    embeds: [updatedEmbed],
    components: [],
  });

  {
    const winnerContent = winnerIds.length
      ? `🎉 **REROLL!** Gratulacje nowym zwycięzcom: ${winnerIds.map((id) => `<@${id}>`).join(', ')}! **${ga.prize}** jest Twoje!`
      : 'Brak wystarczającej liczby uczestników, nie udało się wyłonić nowych zwycięzców!';
    let sent = false;
    try {
      await giveawayMessage.reply({ content: winnerContent });
      sent = true;
    } catch (err) {
      logger.warn(`Reroll giveaway: reply nie wysłany (spróbuję channel.send): ${err}`);
    }
    if (!sent) {
      try {
        await (channel as TextChannel).send({
          content: winnerContent,
          reply: { messageReference: giveawayMessage.id },
        });
      } catch (fallbackErr) {
        logger.error(`Reroll giveaway: channel.send także nieudane: ${fallbackErr}`);
      }
    }
  }

  const confirmEmbed = createBaseEmbed({
    title: '🎉 Giveaway reroll',
    description: `Wylosowano nowych zwycięzców dla giveawayu.\n\n**ID:** \`${giveawayId}\`\n**Nagroda:** ${ga.prize}\n**Nowi zwycięzcy:** ${winnersText}`,
    color: COLORS.GIVEAWAY_ENDED,
  });

  await interaction.editReply({ embeds: [confirmEmbed] });
}
