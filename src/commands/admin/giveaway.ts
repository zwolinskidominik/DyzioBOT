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
import { GiveawayModel } from '../../models/Giveaway';
import { GiveawayConfigModel } from '../../models/GiveawayConfig';
import type { ICommandOptions } from '../../interfaces/Command';
import type { IGiveaway } from '../../interfaces/Models';
import type { IWinnerUser } from '../../interfaces/Giveaway';
import { pickWinners } from '../../utils/giveawayHelpers';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { getBotConfig } from '../../config/bot';
import logger from '../../utils/logger';
import { randomUUID } from 'crypto';

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
          content: 'Nieznana subkomenda.',
          flags: MessageFlags.Ephemeral,
        });
    }
  } catch (error) {
    logger.error(`Błąd w komendzie giveaway (${subcommand}): ${error}`);

    try {
      const errorMessage = 'Wystąpił błąd podczas wykonywania operacji. Spróbuj ponownie później.';

      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      logger.error(`Nie można odpowiedzieć na interakcję: ${replyError}`);
    }
  }
}

function parseDuration(durationStr: string): number {
  const regex = /(\d+)\s*(d(?:ays?)?|h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/gi;
  let totalMs = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(durationStr)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    let multiplier = 0;

    if (unit.startsWith('d')) {
      multiplier = 86400000;
    } else if (unit.startsWith('h')) {
      multiplier = 3600000;
    } else if (unit.startsWith('m')) {
      multiplier = 60000;
    } else if (unit.startsWith('s')) {
      multiplier = 1000;
    }

    totalMs += value * multiplier;
  }

  return totalMs;
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
    await interaction.editReply(
      "Podaj poprawny czas trwania giveawayu (np. '5 days 4 hours 2 minutes')."
    );
    return;
  }

  const endTime = new Date(Date.now() + durationMs);
  const timestamp = getTimestamp(endTime);
  const giveawayId = randomUUID();

  // Pobierz dodatkową notatkę z konfiguracji
  let additionalNote = '';
  try {
    const config = await GiveawayConfigModel.findOne({ guildId: interaction.guild!.id });
    if (config?.enabled && config.additionalNote) {
      additionalNote = `\n\n${config.additionalNote}`;
    }
  } catch (error) {
    logger.debug(`Nie udało się pobrać konfiguracji giveaway: ${error}`);
  }

  const embed = createBaseEmbed({
    description: `### ${prize}\n${description}${additionalNote}\n\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Host:** <@${interaction.user.id}>\n**Zwycięzcy:** ${winnersCount}`,
    footerText: `Giveaway ID: ${giveawayId}`,
    color: COLORS.GIVEAWAY,
  });

  const {
    emojis: {
      giveaway: { join: joinEmoji, list: listEmoji },
    },
  } = getBotConfig(interaction.client.application!.id);

  const uniqueCount = 0;

  const joinButton = new ButtonBuilder()
    .setCustomId(`giveaway_join_${giveawayId}`)
    .setLabel(`Dołącz do konkursu (100%)`)
    .setEmoji(joinEmoji)
    .setStyle(ButtonStyle.Secondary);

  const countButton = new ButtonBuilder()
    .setCustomId(`giveaway_count_${giveawayId}`)
    .setLabel(`Lista (${uniqueCount})`)
    .setEmoji(listEmoji)
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, countButton);

  const content = `${pingRole ? `<@&${pingRole.id}>\n` : ''}`;

  const channel = interaction.channel as TextChannel;
  const giveawayMessage = await channel.send({ content, embeds: [embed], components: [row] });

  let roleMultipliers: Record<string, number> | undefined;
  if (multiplierRole && multiplier > 1) {
    roleMultipliers = { [multiplierRole.id]: multiplier };
  }

  const giveawayData: IGiveaway = {
    giveawayId,
    guildId: interaction.guild!.id,
    channelId: interaction.channel!.id,
    messageId: giveawayMessage.id,
    prize,
    description,
    winnersCount,
    endTime,
    pingRoleId: pingRole ? pingRole.id : undefined,
    active: true,
    participants: [],
    hostId: interaction.user.id,
    createdAt: new Date(),
    roleMultipliers,
    finalized: false,
  };

  await GiveawayModel.create(giveawayData);

  const confirmEmbed = createBaseEmbed({
    title: '🎉 Giveaway utworzony',
    description: `Pomyślnie utworzono nowy giveaway!\n\n**Nagroda:** ${prize}\n**Koniec:** <t:${timestamp}:R>\n**ID:** \`${giveawayId}\``,
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

  if (!newPrize && !newDescription && !newWinners && !newDurationStr && !newPingRole) {
    await interaction.editReply('Nie podałeś żadnych wartości do edycji giveawayu.');
    return;
  }

  const giveaway = await GiveawayModel.findOne({
    giveawayId,
    guildId: interaction.guild!.id,
  }).exec();

  if (!giveaway) {
    await interaction.editReply('Giveaway o podanym ID nie został znaleziony.');
    return;
  }

  if (newPrize) giveaway.prize = newPrize;
  if (newDescription) giveaway.description = newDescription;
  if (newWinners) giveaway.winnersCount = newWinners;
  if (newDurationStr) {
    const durationMs = parseDuration(newDurationStr);
    if (!durationMs || durationMs <= 0) {
      await interaction.editReply(
        "Podaj poprawny czas trwania giveawayu (np. '5 days 4 hours 2 minutes')."
      );
      return;
    }
    giveaway.endTime = new Date(Date.now() + durationMs);
  }
  if (newPingRole) giveaway.pingRoleId = newPingRole.id;

  await giveaway.save();

  const channel = interaction.guild!.channels.cache.get(giveaway.channelId) as
    | TextChannel
    | undefined;
  if (!channel) {
    await interaction.editReply('Nie znaleziono kanału, na którym był uruchomiony ten giveaway.');
    return;
  }

  let giveawayMessage: Message | undefined;
  try {
    giveawayMessage = await channel.messages.fetch(giveaway.messageId);
  } catch (err) {
    logger.warn(`Nie udało się pobrać wiadomości giveaway: ${err}`);
  }

  // Pobierz dodatkową notatkę z konfiguracji
  let additionalNote = '';
  try {
    const config = await GiveawayConfigModel.findOne({ guildId: interaction.guild!.id });
    if (config?.enabled && config.additionalNote) {
      additionalNote = `\n\n${config.additionalNote}`;
    }
  } catch (error) {
    logger.debug(`Nie udało się pobrać konfiguracji giveaway: ${error}`);
  }

  const timestamp = getTimestamp(giveaway.endTime);
  const updatedEmbed = createBaseEmbed({
    description: `### ${giveaway.prize}\n${giveaway.description}${additionalNote}\n\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Host:** <@${giveaway.hostId}>\n**Zwycięzcy:** ${giveaway.winnersCount}`,
    footerText: `Giveaway ID: ${giveaway.giveawayId}`,
    color: COLORS.GIVEAWAY,
  });

  if (giveawayMessage) {
    await giveawayMessage.edit({ embeds: [updatedEmbed] });
  }

  const confirmEmbed = createBaseEmbed({
    title: '🎉 Giveaway zaktualizowany',
    description: `Pomyślnie zaktualizowano giveaway!\n\n**ID:** \`${giveaway.giveawayId}\`\n**Nagroda:** ${giveaway.prize}\n**Koniec:** <t:${timestamp}:R>`,
    color: COLORS.GIVEAWAY,
  });

  await interaction.editReply({ embeds: [confirmEmbed] });
  logger.info(`Zaktualizowano giveaway (ID: ${giveawayId}) przez ${interaction.user.tag}`);
}

async function handleDeleteGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const giveawayId = interaction.options.getString('id', true);

  const giveaway = await GiveawayModel.findOne({
    giveawayId,
    guildId: interaction.guild!.id,
  })
    .lean<IGiveaway>()
    .exec();

  if (!giveaway) {
    await interaction.editReply('Giveaway o podanym ID nie został znaleziony.');
    return;
  }

  const channel = interaction.guild!.channels.cache.get(giveaway.channelId) as
    | TextChannel
    | undefined;
  if (channel) {
    try {
      const message = await channel.messages.fetch(giveaway.messageId);
      if (message) await message.delete();
    } catch (err) {
      logger.warn(`Nie udało się usunąć wiadomości giveawayu (ID: ${giveaway.messageId}): ${err}`);
    }
  } else {
    logger.warn(`Kanał o ID ${giveaway.channelId} nie został znaleziony.`);
  }

  await GiveawayModel.deleteOne({ giveawayId, guildId: interaction.guild!.id });

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

  const giveaway = await GiveawayModel.findOne({
    giveawayId,
    guildId: interaction.guild!.id,
  }).exec();

  if (!giveaway) {
    await interaction.editReply('Giveaway o podanym ID nie został znaleziony.');
    return;
  }

  if (!giveaway.active) {
    await interaction.editReply('Ten giveaway został już zakończony.');
    return;
  }

  giveaway.active = false;
  giveaway.finalized = true;
  await giveaway.save();

  const channel = interaction.guild!.channels.cache.get(giveaway.channelId) as
    | TextChannel
    | undefined;
  if (!channel) {
    await interaction.editReply(
      'Nie znaleziono kanału, na którym został uruchomiony ten giveaway.'
    );
    return;
  }

  let giveawayMessage: Message | undefined;
  try {
    giveawayMessage = await channel.messages.fetch(giveaway.messageId);
  } catch (err) {
    logger.warn(`Nie udało się pobrać wiadomości giveaway: ${err}`);
    await interaction.editReply('Nie udało się pobrać wiadomości giveawayu.');
    return;
  }

  const winners = await pickWinners(
    giveaway.participants,
    giveaway.winnersCount,
    interaction.guild!,
    giveaway.roleMultipliers as Record<string, number> | undefined
  );
  const winnersText = winners.length
    ? winners.map((user: IWinnerUser) => `<@${user.id}>`).join(', ')
    : 'Brak zwycięzców';

  const participantsCount = giveaway.participants.length;
  const timestamp = getTimestamp(giveaway.endTime);

  const updatedEmbed = createBaseEmbed({
    description: `### ${giveaway.prize}\n${giveaway.description}\n\n**Zakończony:** <t:${timestamp}:f>\n**Host:** <@${giveaway.hostId}>\n**Uczestnicy:** ${participantsCount}\n**Zwycięzcy:** ${winnersText}`,
    footerText: `Giveaway ID: ${giveaway.giveawayId}`,
    color: COLORS.GIVEAWAY_ENDED,
  });

  await giveawayMessage.edit({
    content: '### 🎉 🎉 Giveaway zakończony 🎉 🎉',
    embeds: [updatedEmbed],
    components: [],
  });

  {
    const winnerContent = winners.length
      ? `🎉 Gratulacje ${winners
          .map((user: IWinnerUser) => `<@${user.id}>`)
          .join(', ')}! **${giveaway.prize}** jest Twoje!`
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
    description: `Giveaway został zakończony.\n\n**ID:** \`${giveawayId}\`\n**Nagroda:** ${giveaway.prize}\n**Zwycięzcy:** ${winnersText}`,
    color: COLORS.GIVEAWAY_ENDED,
  });

  await interaction.editReply({ embeds: [confirmEmbed] });
  logger.info(`Zakończono giveaway (ID: ${giveawayId}) przez ${interaction.user.tag}`);
}

async function handleListGiveaways(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const giveaways = await GiveawayModel.find({
    guildId: interaction.guild!.id,
    active: true,
  }).lean<IGiveaway[]>();

  if (!giveaways || giveaways.length === 0) {
    await interaction.editReply('Brak aktywnych giveawayów na tym serwerze.');
    return;
  }

  giveaways.sort((a, b) => a.endTime.getTime() - b.endTime.getTime());

  const description = giveaways
    .map((g) => {
      const timestamp = getTimestamp(g.endTime);
      return `**ID:** \`${g.giveawayId}\`\n**Nagroda:** ${g.prize}\n**Liczba wygranych:** ${g.winnersCount}\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Uczestnicy:** ${g.participants.length}`;
    })
    .join('\n\n');

  const embed = createBaseEmbed({
    title: '🎉 Aktywne Giveawaye',
    description,
    color: COLORS.GIVEAWAY,
    footerText: `Łącznie: ${giveaways.length} giveawayów`,
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleRerollGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const giveawayId = interaction.options.getString('id', true);

  const giveaway = await GiveawayModel.findOne({
    giveawayId,
    guildId: interaction.guild!.id,
  })
    .lean<IGiveaway>()
    .exec();

  if (!giveaway) {
    await interaction.editReply('Giveaway o podanym ID nie został znaleziony.');
    return;
  }

  if (giveaway.active) {
    await interaction.editReply('Giveaway musi być zakończony, aby móc wykonać reroll.');
    return;
  }

  const channel = interaction.guild!.channels.cache.get(giveaway.channelId) as
    | TextChannel
    | undefined;
  if (!channel) {
    await interaction.editReply(
      'Nie znaleziono kanału, na którym został uruchomiony ten giveaway.'
    );
    return;
  }

  let giveawayMessage: Message | undefined;
  try {
    giveawayMessage = await channel.messages.fetch(giveaway.messageId);
  } catch (err) {
    logger.warn(`Nie udało się pobrać wiadomości giveaway: ${err}`);
    await interaction.editReply('Nie można pobrać wiadomości giveawayu.');
    return;
  }

  const participantArray = giveaway.participants;
  if (participantArray.length === 0) {
    await interaction.editReply('Brak uczestników giveawayu.');
    return;
  }

  const winners = await pickWinners(
    participantArray, 
    giveaway.winnersCount, 
    interaction.guild!,
    giveaway.roleMultipliers as Record<string, number> | undefined
  );
  const winnersText = winners.length
    ? winners.map((user: IWinnerUser) => `<@${user.id}>`).join(', ')
    : 'Brak zwycięzców';

  const timestamp = getTimestamp(giveaway.endTime);

  const updatedEmbed = createBaseEmbed({
    description: `### ${giveaway.prize}\n${giveaway.description}\n\n**Zakończony:** <t:${timestamp}:f>\n**Host:** <@${giveaway.hostId}>\n**Uczestnicy:** ${participantArray.length}\n**Zwycięzcy (reroll):** ${winnersText}`,
    footerText: `Giveaway ID: ${giveaway.giveawayId}`,
    color: COLORS.GIVEAWAY_ENDED,
  });

  await giveawayMessage.edit({
    content: '### 🎉 🎉 Giveaway zakończony 🎉 🎉',
    embeds: [updatedEmbed],
    components: [],
  });

  {
    const winnerContent = winners.length
      ? `🎉 **REROLL!** Gratulacje nowym zwycięzcom: ${winners
          .map((user: IWinnerUser) => `<@${user.id}>`)
          .join(', ')}! **${giveaway.prize}** jest Twoje!`
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
    description: `Wylosowano nowych zwycięzców dla giveawayu.\n\n**ID:** \`${giveawayId}\`\n**Nagroda:** ${giveaway.prize}\n**Nowi zwycięzcy:** ${winnersText}`,
    color: COLORS.GIVEAWAY_ENDED,
  });

  await interaction.editReply({ embeds: [confirmEmbed] });
}
