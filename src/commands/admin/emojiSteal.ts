import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { IEmojiMatch, IEmojiAddResult } from '../../interfaces/Emoji';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

const MAX_EMOJI_PER_SERVER = 150;
const EMOJI_REGEX = /^<(?<animated>a?):(?<name>\w+):(?<id>\d+)>$/;
const PROGRESS_UPDATE_INTERVAL = 5;

export const data = new SlashCommandBuilder()
  .setName('emoji-steal')
  .setDescription('Dodaje wiele emoji z innego serwera.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt.setName('emojis').setDescription('Podaj emoji, oddzielone spacją.').setRequired(true)
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  guildOnly: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const cmd = interaction as ChatInputCommandInteraction;
  try {
    await cmd.deferReply({ flags: MessageFlags.Ephemeral });

    const input = cmd.options.getString('emojis', true);
    const tokens = input.trim().split(/\s+/);
    const remaining = MAX_EMOJI_PER_SERVER - cmd.guild!.emojis.cache.size;
    if (remaining <= 0) {
      await cmd.editReply({ embeds: [createErrorEmbed('Limit emoji (150) osiągnięty.')] });
      return;
    }

    const data = tokens.map(parseEmojiToken).filter((e): e is IEmojiMatch => !!e);
    await checkRemainingSlots(cmd, data, remaining);

    const results: IEmojiAddResult[] = [];
    let added = 0;

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (added >= remaining) {
        results.push({ token: t, success: false, error: 'Limit osiągnięty.' });
      } else {
        const m = parseEmojiToken(t);
        if (!m) {
          results.push({ token: t, success: false, error: 'Niepoprawny format.' });
        } else {
          const r = await addEmoji(t, m, cmd);
          results.push(r);
          if (r.success) added++;
        }
      }
      await updateProgress(cmd, results, i, tokens.length);
    }

    await cmd.editReply({ embeds: [createFinalEmbed(results)] });
  } catch (err) {
    logger.error('emoji-steal:', err);
    await cmd.followUp({
      embeds: [createErrorEmbed('Błąd podczas dodawania emoji.')],
      flags: MessageFlags.Ephemeral,
    });
  }
}

function parseEmojiToken(token: string): IEmojiMatch | null {
  const match = token.match(EMOJI_REGEX);
  if (!match?.groups) return null;
  return { animated: match.groups.animated, name: match.groups.name, id: match.groups.id };
}

function createProgressEmbed(results: IEmojiAddResult[], processed: number, total: number) {
  const successCount = results.filter((r) => r.success).length;
  return createBaseEmbed({
    title: `Dodawanie emoji (${processed}/${total})`,
    description: `Przetworzono ${processed} z ${total} emoji. Pomyślnie dodano: ${successCount}`,
    color: COLORS.DEFAULT,
  });
}

function createFinalEmbed(results: IEmojiAddResult[]) {
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  const successMessages = results
    .filter((r) => r.success)
    .map((r) => `✅ \`${r.token}\`: Dodano jako ${r.emoji?.toString()}`);

  const failMessages = results
    .filter((r) => !r.success)
    .map((r) => `❌ \`${r.token}\`: ${r.error}`);

  let desc = `**Podsumowanie**: Dodano ${successCount} emoji, nie udało się dodać ${failCount} emoji.\n\n`;
  if (successMessages.length)
    desc += '**Pomyślnie dodane:**\n' + successMessages.join('\n') + '\n\n';
  if (failMessages.length) desc += '**Niepowodzenia:**\n' + failMessages.join('\n');

  if (desc.length > 4000) desc = desc.slice(0, 3970) + '...\n(Za dużo wyników)';

  return createBaseEmbed({
    title: 'Wynik dodawania emoji',
    description: desc,
    color: successCount ? COLORS.DEFAULT : COLORS.ERROR,
  });
}

async function addEmoji(
  token: string,
  match: IEmojiMatch,
  interaction: ChatInputCommandInteraction
): Promise<IEmojiAddResult> {
  try {
    const isAnimated = match.animated === 'a';
    const url = `https://cdn.discordapp.com/emojis/${match.id}.${isAnimated ? 'gif' : 'png'}`;
    const emoji = await interaction.guild!.emojis.create({ attachment: url, name: match.name });
    return { token, success: true, emoji };
  } catch (err: unknown) {
    let msg = 'Nieznany błąd';
    if (err instanceof Error) {
      msg = err.message;
      if (msg.includes('Maximum number of emojis reached')) {
        msg = 'Osiągnięto maksymalną liczbę emoji.';
      } else if (msg.includes('Invalid Form Body')) {
        msg = 'Niepoprawny format emoji.';
      } else if (msg.includes('Unknown Emoji')) {
        msg = 'Nie znaleziono emoji.';
      }
    }
    logger.warn(`Błąd dodawania emoji '${token}':`, err);
    return { token, success: false, error: msg };
  }
}

async function checkRemainingSlots(
  interaction: ChatInputCommandInteraction,
  emojiData: IEmojiMatch[],
  remaining: number
): Promise<void> {
  if (emojiData.length > remaining) {
    await interaction.editReply({
      embeds: [createErrorEmbed(`Próbujesz dodać ${emojiData.length} emoji, a zostało ${remaining} slotów. Dodam tylko pierwsze ${remaining}.`)],
    });
  }
}

async function updateProgress(
  interaction: ChatInputCommandInteraction,
  results: IEmojiAddResult[],
  index: number,
  total: number
): Promise<void> {
  if (index % PROGRESS_UPDATE_INTERVAL === 0 || index === total - 1) {
    await interaction.editReply({ embeds: [createProgressEmbed(results, index + 1, total)] });
  }
}
