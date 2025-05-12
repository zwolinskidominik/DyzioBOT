import {
  SlashCommandBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  TextChannel,
  MessageFlags,
} from 'discord.js';
import { TicketConfigModel } from '../../models/TicketConfig';
import type { ITicketConfig } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';
import { join } from 'path';

const TICKET_BANNER = 'ticketBanner.png';
const ASSETS_PATH = './assets/tickets';

const TICKET_OPTIONS = [
  {
    label: 'Pomoc',
    description: 'Potrzebujesz pomocy? Wybierz tę opcję!',
    value: 'help',
    emoji: '❓',
  },
  {
    label: 'Zgłoszenie',
    description: 'Chcesz coś zgłosić? Kliknij tutaj!',
    value: 'report',
    emoji: '🎫',
  },
  {
    label: 'Partnerstwa',
    description: 'Zainteresowany partnerstwem? Wybierz tę opcję!',
    value: 'partnership',
    emoji: '🤝',
  },
  {
    label: 'Mam pomysł',
    description: 'Masz pomysł na ulepszenie serwera? Podziel się nim!',
    value: 'idea',
    emoji: '💡',
  },
  {
    label: 'Odbiór nagród',
    description: 'Chcesz odebrać nagrodę? Kliknij tutaj!',
    value: 'rewards',
    emoji: '🎉',
  },
];

export const data = new SlashCommandBuilder()
  .setName('setup-ticket')
  .setDescription('Ustawia system ticketów')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({
      content: 'Ta komenda może być używana tylko na kanale tekstowym.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const guild = interaction.guild!;
  const categoryId = channel.parentId;

  if (!categoryId) {
    await interaction.reply({
      content:
        'Ten kanał nie należy do żadnej kategorii. Przenieś się do kanału, który jest w kategorii, lub skontaktuj się z administracją.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await saveTicketConfig(guild.id, categoryId);

    const cfg = await loadTicketConfig(guild.id);
    if (!cfg) throw new Error('Nie udało się wczytać konfiguracji po zapisie');

    const setupImage = createAttachment(TICKET_BANNER);

    const { embed, row } = createTicketComponents(guild.iconURL());

    await channel.send({
      embeds: [embed],
      components: [row],
      files: [setupImage],
    });

    await interaction.reply({
      content: 'System ticketów został pomyślnie skonfigurowany!',
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error(`Błąd podczas konfiguracji systemu ticketów: ${error}`);
    await interaction.reply({
      content: 'Wystąpił błąd podczas konfiguracji systemu ticketów.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

function createAttachment(imageName: string): AttachmentBuilder {
  return new AttachmentBuilder(join(ASSETS_PATH, imageName));
}

async function saveTicketConfig(guildId: string | undefined, categoryId: string): Promise<void> {
  if (!guildId) {
    throw new Error('ID serwera jest niezdefiniowane');
  }

  await TicketConfigModel.findOneAndUpdate(
    { guildId },
    { categoryId },
    { upsert: true, new: true }
  ).exec();
}

async function loadTicketConfig(guildId: string): Promise<ITicketConfig | null> {
  return TicketConfigModel.findOne({ guildId }).lean<ITicketConfig>().exec();
}

function createTicketComponents(guildIconUrl: string | null | undefined) {
  const embed = createBaseEmbed({
    title: 'Kontakt z Administracją',
    description:
      'Aby skontaktować się z wybranym działem administracji, wybierz odpowiednią kategorię poniżej:',
    color: COLORS.TICKET,
    image: `attachment://${TICKET_BANNER}`,
    thumbnail: guildIconUrl || undefined,
  }).setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket-menu')
    .setPlaceholder('Wybierz odpowiednią kategorię')
    .addOptions(TICKET_OPTIONS);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return { embed, row };
}
