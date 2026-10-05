import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { COLORS } from '../../config/constants/colors';
import { CONTACT_EMAIL, PRIVACY_URL, SITE_URL, TERMS_URL } from '../../config/constants/links';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { getBotConfig } from '../../config/bot';
import logger from '../../utils/logger';

const COLLECTION_TIMEOUT = 120_000;

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Sprawdź dostępne komendy i dowiedz się, jak ich używać');

export const options = {};

interface CommandInfo {
  name: string;
  description: string;
  usage?: string;
}

const ALL_COMMANDS: CommandInfo[] = [
  {
    name: '/avatar',
    description: 'Wyświetla avatar użytkownika w pełnej rozdzielczości.',
    usage: '/avatar [@użytkownik]',
  },
  {
    name: '/birthday',
    description: 'Pokazuje twoją zapisaną datę urodzin lub innego użytkownika.',
    usage: '/birthday [@użytkownik]',
  },
  {
    name: '/birthday-remember',
    description: 'Zapisuje twoją datę urodzin lub innego użytkownika do systemu (format: DD-MM-RRRR lub DD-MM).',
    usage: '/birthday-remember <data>',
  },
  {
    name: '/birthdays-next',
    description: 'Wyświetla listę 10 najbliższych urodzin użytkowników na serwerze.',
    usage: '/birthdays-next',
  },
  {
    name: '/cat',
    description: 'Wysyła losowe zdjęcie kota. 🐱',
    usage: '/cat',
  },
  {
    name: '/dog',
    description: 'Wysyła losowe zdjęcie psa. 🐶',
    usage: '/dog',
  },
  {
    name: '/emoji',
    description: 'Pokazuje listę wszystkich dostępnych emoji na serwerze.',
    usage: '/emoji',
  },
  {
    name: '/faceit',
    description: 'Wyświetla statystyki gracza CS2 z platformy FACEIT.',
    usage: '/faceit <nick>',
  },
  {
    name: '/level',
    description: 'Pokazuje twój poziom (XP) lub innego użytkownika.',
    usage: '/level [@użytkownik]',
  },
  {
    name: '/meme',
    description: 'Wysyła losowego mema z polskich stron (kwejk, demotywatory, mistrzowie, ivall).',
    usage: '/meme',
  },
  {
    name: '/ping',
    description: 'Sprawdza opóźnienie bota (ping).',
    usage: '/ping',
  },
  {
    name: '/roll',
    description: 'Rzuć kostką - losuje liczbę z zakresu od 1 do N (domyślnie: 1-6).',
    usage: '/roll [max_liczba]',
  },
  {
    name: '/serverinfo',
    description: 'Wyświetla szczegółowe informacje o serwerze.',
    usage: '/serverinfo',
  },
  {
    name: '/toplvl',
    description: 'Pokazuje ranking użytkowników według poziomu (top 10 na stronę).',
    usage: '/toplvl [strona]',
  },
  {
    name: '/warnings',
    description: 'Wyświetla twoje ostrzeżenia lub ostrzeżenia innego użytkownika.',
    usage: '/warnings [@użytkownik]',
  },
];

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    const totalPages = Math.ceil(ALL_COMMANDS.length / 5);
    let currentPage = 0;

    const botConfig = getBotConfig(interaction.client.application!.id);
    const { next: NEXT, previous: PREVIOUS } = botConfig.emojis;

    const createEmbed = (page: number): EmbedBuilder => {
      const start = page * 5;
      const end = start + 5;
      const pageCommands = ALL_COMMANDS.slice(start, end);

      const embed = createBaseEmbed({
        title: '📚 Lista komend - Deezy',
        description:
          '**Legenda:**\n' +
          '`<parametr>` - wymagany\n' +
          '`[parametr]` - opcjonalny\n' +
          '`@użytkownik` - wzmianka użytkownika\n' +
          '⸻⸻⸻⸻⸻⸻⸻⸻⸻\n' +
          '**Dostępne komendy:**',
        color: COLORS.DEFAULT,
        footerText: `Strona ${page + 1}/${totalPages} • Komendy alfabetycznie`,
      });

      pageCommands.forEach((cmd) => {
        let fieldValue = cmd.description;
        if (cmd.usage) {
          fieldValue += `\n↪ Użycie: \`${cmd.usage}\``;
        }
        embed.addFields({ name: `**${cmd.name}**`, value: fieldValue, inline: false });
      });

      embed.addFields({
        name: '📬 Pomoc i kontakt',
        value: `Problem z botem, zgłoszenie nadużycia albo prośba o usunięcie danych: **${CONTACT_EMAIL}**`,
        inline: false,
      });

      return embed;
    };

    // Linki do panelu, regulaminu i polityki prywatności (wymóg Discord Developer Terms §5a:
    // polityka prywatności musi być łatwo dostępna z poziomu aplikacji). Przyciski-linki nie
    // wysyłają interakcji, więc nie trzeba ich wyłączać po upływie czasu kolektora.
    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('Panel').setStyle(ButtonStyle.Link).setURL(SITE_URL),
      new ButtonBuilder().setLabel('Regulamin').setStyle(ButtonStyle.Link).setURL(TERMS_URL),
      new ButtonBuilder().setLabel('Polityka prywatności').setStyle(ButtonStyle.Link).setURL(PRIVACY_URL)
    );

    const createButtons = (disabled = false) => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('help_previous')
          .setEmoji(PREVIOUS)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId('help_next')
          .setEmoji(NEXT)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      );
    };

    await interaction.reply({
      embeds: [createEmbed(0)],
      components: [createButtons(), linkRow],
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: COLLECTION_TIMEOUT,
    });

    collector.on('collect', async (i: ButtonInteraction) => {
      if (i.customId === 'help_previous') {
        currentPage = (currentPage - 1 + totalPages) % totalPages;
      } else if (i.customId === 'help_next') {
        currentPage = (currentPage + 1) % totalPages;
      }

      await i.update({
        embeds: [createEmbed(currentPage)],
        components: [createButtons(), linkRow],
      });
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [createButtons(true), linkRow] });
      } catch {
        
      }
    });
  } catch (error) {
    logger.error(`[help] Błąd wykonania komendy: ${error}`);
    const errorEmbed = createErrorEmbed('Wystąpił błąd podczas wyświetlania pomocy.');
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
    }
  }
}
