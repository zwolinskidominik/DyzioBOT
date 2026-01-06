import {
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
  Interaction,
  StringSelectMenuInteraction,
  ButtonInteraction,
  GuildMember,
  TextChannel,
  Role,
  CategoryChannel,
  MessageFlags,
  User,
} from 'discord.js';
import { TicketStatsModel } from '../../models/TicketStats';
import { TicketConfigModel } from '../../models/TicketConfig';
import { TicketStateModel } from '../../models/TicketState';
import { ITicketType } from '../../interfaces/Ticket';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { getGuildConfig } from '../../config/guild';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';
import * as path from 'path';

const BUTTON_IDS = {
  TAKE_TICKET: 'zajmij-zgloszenie',
  CLOSE_TICKET: 'zamknij-zgloszenie',
  CONFIRM_CLOSE: 'potwierdz-zamkniecie',
  CANCEL_CLOSE: 'anuluj-zamkniecie',
};

const TICKET_CLOSE_DELAY = 5_000;

const ticketTypes: Record<string, ITicketType> = {
  help: {
    title: 'Dział pomocy',
    description: (user: User) =>
      `Witaj ${user}!\n\nPotrzebujesz pomocy? Opisz dokładnie, z czym masz problem, a nasz zespół postara się pomóc jak najszybciej.`,
    color: COLORS.TICKET,
    image: 'ticketBanner.png',
  },
  report: {
    title: 'System zgłoszeń',
    description: (user: User) =>
      `Witaj ${user}!\n\nJeśli chcesz poinformować o naruszeniu regulaminu, podaj kogo i co zrobił, dodaj dowody i datę zdarzenia.`,
    color: COLORS.TICKET_REPORT,
    image: 'ticketReport.png',
  },
  partnership: {
    title: 'Dział partnerstw',
    description: (user: User) =>
      `Witaj ${user}!\n\nJeśli jesteś zainteresowany partnerstwem z naszym serwerem, wyślij swoją reklamę i poczekaj na odpowiedź.`,
    color: COLORS.TICKET_PARTNERSHIP,
    image: 'ticketPartnership.png',
  },
  idea: {
    title: 'Pomysły',
    description: (user: User) =>
      `Witaj ${user}!\n\nMasz pomysł na ulepszenie serwera? Podziel się nim tutaj!`,
    color: COLORS.TICKET_IDEA,
    image: 'ticketIdea.png',
  },
  rewards: {
    title: 'Odbiór nagród',
    description: (user: User) =>
      `Witaj ${user}!\n\nOdbierz tutaj swoją nagrodę! Napisz, jaką nagrodę chcesz odebrać i za co ją otrzymałeś.`,
    color: COLORS.TICKET_REWARD,
    image: 'ticketBanner.png',
  },
};

const channelNames: Record<string, string> = {
  help: 'pomoc',
  report: 'zgloszenie',
  partnership: 'partnerstwo',
  idea: 'pomysl',
  rewards: 'nagrody',
};

export default async function run(interaction: Interaction): Promise<void | boolean> {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket-menu') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await handleTicketCreation(interaction);
      return;
    }

    if (interaction.isButton()) {
      switch (interaction.customId) {
        case BUTTON_IDS.TAKE_TICKET:
          await interaction.deferUpdate();
          await handleTakeTicket(interaction);
          break;
        case BUTTON_IDS.CLOSE_TICKET:
          await interaction.deferUpdate();
          await handleCloseTicket(interaction);
          break;
        case BUTTON_IDS.CONFIRM_CLOSE:
          await interaction.deferUpdate();
          await handleConfirmClose(interaction);
          break;
        case BUTTON_IDS.CANCEL_CLOSE:
          await interaction.deferUpdate();
          await handleCancelClose(interaction);
          break;
      }
    }
  } catch (error) {
    logger.error(`Błąd w systemie ticketów: ${error}`);
  }
}

async function handleTicketCreation(interaction: StringSelectMenuInteraction): Promise<void> {
  const guildId = interaction.guild?.id;
  if (!guildId) {
    await interaction.editReply({
      content: 'Ta funkcja działa tylko na serwerze.',
    });
    return;
  }

  const config = await TicketConfigModel.findOne({ guildId });
  if (!config) {
    await interaction.editReply({
      content:
        'Brak konfiguracji systemu ticketów. Użyj komendy `/setup-ticket`, aby ją skonfigurować.',
    });
    return;
  }

  const categoryChannel = interaction.guild?.channels.cache.get(config.categoryId);
  const isCategory =
    !!categoryChannel &&
    (
      (categoryChannel as any).type === ChannelType.GuildCategory ||
      !!(categoryChannel as any).children ||
      !!(categoryChannel as any).id
    );

  if (!isCategory) {
    await interaction.editReply({
      content: 'Nie znaleziono kategorii, którą skonfigurowałeś. Skontaktuj się z administracją.',
    });
    return;
  }

  const selectedValue = interaction.values[0];
  const selectedType = ticketTypes[selectedValue];
  if (!selectedType) {
    await interaction.editReply({
      content: 'Nieznany rodzaj ticketa.',
    });
    return;
  }

  const channelKey = channelNames[selectedValue];
  const channelName = `${channelKey}-${interaction.user.username.toLowerCase()}`;

  let ticketChannel: TextChannel | null = null;
  try {
    ticketChannel = await createTicketChannel(
      interaction,
      channelName,
      categoryChannel as any
    );
  } catch (error) {
    logger.error(`Błąd podczas tworzenia ticketu: ${error}`);
    await interaction.editReply({
      content: 'Wystąpił błąd podczas tworzenia zgłoszenia. Spróbuj ponownie później.',
    });
    return;
  }

  try {
    await sendTicketMessages(interaction, ticketChannel, selectedValue, selectedType);
  } catch (error) {
    logger.warn(`Nie udało się wysłać wiadomości powitalnych dla ticketu: ${error}`);
  }

  await interaction.editReply({
    content: `Stworzono zgłoszenie: 🎫 ${ticketChannel}`,
  });
}

function createTicketButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.TAKE_TICKET)
      .setLabel('Zajmij zgłoszenie')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.CLOSE_TICKET)
      .setLabel('Zamknij zgłoszenie')
      .setStyle(ButtonStyle.Danger)
  );
}

function createConfirmButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.CONFIRM_CLOSE)
      .setLabel('Potwierdź zamknięcie')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.CANCEL_CLOSE)
      .setLabel('Anuluj')
      .setStyle(ButtonStyle.Secondary)
  );
}

function hasStaffRole(guildId: string, member: GuildMember): boolean {
  const { roles: ROLES } = getGuildConfig(guildId);
  return member.roles.cache.some((role: Role) => Object.values(ROLES).includes(role.id));
}

function isTicketCreator(member: GuildMember, channelName: string): boolean {
  return channelName.endsWith(member.user.username.toLowerCase());
}

function createAttachment(imageName: string): AttachmentBuilder {
  return new AttachmentBuilder(
    path.join(__dirname, '..', '..', '..', 'assets', 'tickets', imageName)
  );
}

async function createTicketChannel(
  interaction: StringSelectMenuInteraction,
  channelName: string,
  categoryChannel: CategoryChannel
): Promise<TextChannel> {
  const { roles: ROLES } = getGuildConfig(interaction.guild!.id);
  return await interaction.guild!.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: (categoryChannel as any)?.id ?? (categoryChannel as unknown as string),
    permissionOverwrites: [
      {
        id: interaction.guild!.id,
        deny: [PermissionFlagsBits.ViewChannel],
        type: 0,
      },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        type: 1,
      },
      {
        id: ROLES.owner,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        type: 0,
      },
      {
        id: ROLES.admin,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        type: 0,
      },
      {
        id: ROLES.mod,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        type: 0,
      },
    ],
  });
}

async function sendTicketMessages(
  interaction: StringSelectMenuInteraction,
  channel: TextChannel,
  selectedValue: string,
  selectedType: ITicketType
): Promise<void> {
  const ticketImage = createAttachment(selectedType.image);
  const welcomeEmbed = createBaseEmbed({
    title: selectedType.title,
    description: selectedType.description(interaction.user),
    color: selectedType.color,
    thumbnail: interaction.guild?.iconURL() || undefined,
    image: `attachment://${selectedType.image}`,
    footerText: `Ticket utworzony przez ${interaction.user.tag}`,
    footerIcon: interaction.user.displayAvatarURL(),
  }).setTimestamp();

  const { roles: ROLES } = getGuildConfig(interaction.guild!.id);

  let staffPing =
    selectedValue === 'partnership'
      ? `||<@&${ROLES.partnership}>||`
      : `||<@&${ROLES.owner}> <@&${ROLES.admin}> <@&${ROLES.mod}>||`;

  await channel.send({
    content: staffPing,
    flags: ['SuppressEmbeds'],
  });

  await channel.send({
    embeds: [welcomeEmbed],
    files: [ticketImage],
    components: [createTicketButtons()],
  });
}

async function handleTakeTicket(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;

  if (!hasStaffRole(interaction.guild!.id, member)) {
    await interaction.followUp({
      content: 'Nie masz uprawnień do zajmowania zgłoszeń!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const ticketInDB = await TicketStateModel.findOne({
      channelId: interaction.channel?.id,
    });

    if (ticketInDB?.assignedTo) {
      await interaction.followUp({
        content: 'To zgłoszenie zostało już zajęte!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await updateTicketAssignment(interaction);

    await updateTakeTicketButton(interaction);

    await interaction.followUp({
      content: `${interaction.user} zajął(ęła) się tym zgłoszeniem!`,
    });
  } catch (error) {
    logger.error(`Błąd podczas zajmowania ticketu: ${error}`);
    await interaction.followUp({
      content: 'Wystąpił błąd podczas zajmowania zgłoszenia.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function updateTicketAssignment(interaction: ButtonInteraction): Promise<void> {
  await TicketStateModel.findOneAndUpdate(
    { channelId: interaction.channel?.id },
    { assignedTo: interaction.user.id },
    { upsert: true, new: true }
  );

  await TicketStatsModel.findOneAndUpdate(
    { guildId: interaction.guild?.id, userId: interaction.user.id },
    { $inc: { count: 1 } },
    { upsert: true, new: true }
  );
}

async function updateTakeTicketButton(interaction: ButtonInteraction): Promise<void> {
  const oldComponents = interaction.message?.components;
  if (!oldComponents?.length) return;

  const oldActionRow = oldComponents[0];
  if (!('components' in oldActionRow)) return;
  
  const newActionRow = new ActionRowBuilder<ButtonBuilder>();

  for (const comp of oldActionRow.components) {
    if (comp.type === 2) {
      const newButton = new ButtonBuilder()
        .setCustomId(comp.customId || '')
        .setLabel(comp.label || '')
        .setStyle(comp.style as number);

      if (comp.customId === BUTTON_IDS.TAKE_TICKET) {
        newButton.setDisabled(true).setLabel('Zajęto');
      }

      newActionRow.addComponents(newButton);
    }
  }

  await interaction.message?.edit({ components: [newActionRow] });
}

async function handleCloseTicket(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;
  const channelName = channel?.name || '';

  const isStaff = hasStaffRole(interaction.guild!.id, member);
  const isCreator = isTicketCreator(member, channelName);

  if (!isStaff && !isCreator) {
    await interaction.followUp({
      content: 'Nie masz uprawnień do zamykania tego zgłoszenia!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const confirmRow = createConfirmButtons();
  await interaction.followUp({
    content: 'Czy na pewno chcesz zamknąć to zgłoszenie?',
    components: [confirmRow],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleConfirmClose(interaction: ButtonInteraction): Promise<void> {
  await interaction.followUp({
    content: 'Zgłoszenie zostanie zamknięte za 5 sekund...',
    flags: MessageFlags.Ephemeral,
  });

  const channelId = interaction.channel?.id;

  setTimeout(async () => {
    try {
      if (interaction.channel) {
        await interaction.channel.delete();
      }

      if (channelId) {
        await TicketStateModel.findOneAndDelete({ channelId });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`Nie udało się usunąć kanału ticketu lub rekordu w bazie: ${msg}`);
    }
  }, TICKET_CLOSE_DELAY);
}

async function handleCancelClose(interaction: ButtonInteraction): Promise<void> {
  await interaction.deleteReply();
}
