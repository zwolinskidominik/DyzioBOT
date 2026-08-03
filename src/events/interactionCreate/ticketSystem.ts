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
  CategoryChannel,
  MessageFlags,
} from 'discord.js';
import { ITicketType } from '../../interfaces/Models';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { getTicketBannerAttachment } from '../../utils/ticketBannerRenderer';
import { finalizeTicketClosure } from '../../utils/ticketClosure';
import {
  validateTicketCreation,
  takeTicket,
  registerTicketChannel,
  getStaffRoleIdsForChannel,
  getTicketState,
} from '../../services/ticketService';
import logger from '../../utils/logger';

const BUTTON_IDS = {
  TAKE_TICKET: 'zajmij-zgloszenie',
  CLOSE_TICKET: 'zamknij-zgloszenie',
  CONFIRM_CLOSE: 'potwierdz-zamkniecie',
  CANCEL_CLOSE: 'anuluj-zamkniecie',
};

const TICKET_CLOSE_DELAY = 5_000;

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

  const selectedTypeId = interaction.values[0];
  const result = await validateTicketCreation(
    guildId,
    selectedTypeId,
    interaction.user.id,
    interaction.user.username,
  );

  if (!result.ok) {
    await interaction.editReply({ content: result.message });
    return;
  }

  const { categoryId, ticketType, channelName } = result.data;

  const categoryChannel = interaction.guild?.channels.cache.get(categoryId);
  const isCategory = categoryChannel?.type === ChannelType.GuildCategory;

  if (!isCategory) {
    await interaction.editReply({
      content: 'Nie znaleziono kategorii, którą skonfigurowałeś. Skontaktuj się z administracją.',
    });
    return;
  }

  let ticketChannel: TextChannel | null = null;
  try {
    ticketChannel = await createTicketChannel(
      interaction,
      channelName,
      categoryChannel as CategoryChannel,
      ticketType,
    );
  } catch (error) {
    logger.error(`Błąd podczas tworzenia ticketu: ${error}`);
    await interaction.editReply({
      content: 'Wystąpił błąd podczas tworzenia zgłoszenia. Spróbuj ponownie później.',
    });
    return;
  }

  await registerTicketChannel(ticketChannel.id, guildId, ticketType.id, interaction.user.id);

  try {
    await sendTicketMessages(interaction, ticketChannel, ticketType);
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

function hasStaffRole(member: GuildMember, roleIds: string[]): boolean {
  if (roleIds.length === 0) return false;
  return member.roles.cache.some((role) => roleIds.includes(role.id));
}

function createAttachmentFromBuffer(buffer: Buffer, filename: string): AttachmentBuilder {
  return new AttachmentBuilder(buffer, { name: filename });
}

async function createTicketChannel(
  interaction: StringSelectMenuInteraction,
  channelName: string,
  categoryChannel: CategoryChannel,
  ticketType: ITicketType,
): Promise<TextChannel> {
  const roleOverwrites = ticketType.roleIds.map((roleId) => ({
    id: roleId,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    type: 0 as const,
  }));

  return await interaction.guild!.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryChannel.id,
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
      ...roleOverwrites,
    ],
  });
}

async function sendTicketMessages(
  interaction: StringSelectMenuInteraction,
  channel: TextChannel,
  ticketType: ITicketType,
): Promise<void> {
  const attachment = await getTicketBannerAttachment(ticketType);
  const ticketImage = attachment ? createAttachmentFromBuffer(attachment.buffer, attachment.filename) : null;

  const description = (ticketType.description || 'Witaj {user}!').replace(
    /\{user\}/g,
    `${interaction.user}`,
  );

  const welcomeEmbed = createBaseEmbed({
    title: ticketType.emoji ? `${ticketType.emoji} ${ticketType.name}` : ticketType.name,
    description,
    color: ticketType.color,
    thumbnail: interaction.guild?.iconURL() || undefined,
    ...(attachment ? { image: `attachment://${attachment.filename}` } : {}),
    footerText: `Ticket utworzony przez ${interaction.user.tag}`,
    footerIcon: interaction.user.displayAvatarURL(),
  }).setTimestamp();

  const staffPing =
    ticketType.roleIds.length > 0
      ? `||${ticketType.roleIds.map((id) => `<@&${id}>`).join(' ')}||`
      : undefined;

  if (staffPing) {
    await channel.send({
      content: staffPing,
      flags: ['SuppressEmbeds'],
    });
  }

  await channel.send({
    embeds: [welcomeEmbed],
    ...(ticketImage ? { files: [ticketImage] } : {}),
    components: [createTicketButtons()],
  });
}

async function handleTakeTicket(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const channelId = interaction.channel?.id;
  if (!channelId) return;

  const staffRoleIds = await getStaffRoleIdsForChannel(interaction.guild!.id, channelId);

  if (!hasStaffRole(member, staffRoleIds)) {
    await interaction.followUp({
      content: 'Nie masz uprawnień do zajmowania zgłoszeń!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const result = await takeTicket(channelId, interaction.guild!.id, interaction.user.id);

    if (!result.ok) {
      await interaction.followUp({
        content: result.message,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

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
  const channelId = interaction.channel?.id;
  if (!channelId) return;

  const [staffRoleIds, stateResult] = await Promise.all([
    getStaffRoleIdsForChannel(interaction.guild!.id, channelId),
    getTicketState(channelId),
  ]);

  const isStaff = hasStaffRole(member, staffRoleIds);
  const isCreator = stateResult.ok && stateResult.data.creatorId === interaction.user.id;

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

  const channel = interaction.channel as TextChannel | null;
  const closedBy = interaction.user.tag;

  setTimeout(async () => {
    try {
      if (channel) {
        await finalizeTicketClosure(channel, `zamknięte ręcznie przez ${closedBy}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`Nie udało się zamknąć ticketu: ${msg}`);
    }
  }, TICKET_CLOSE_DELAY);
}

async function handleCancelClose(interaction: ButtonInteraction): Promise<void> {
  await interaction.deleteReply();
}
