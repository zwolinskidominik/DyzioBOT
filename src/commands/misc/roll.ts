import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import logger from '../../utils/logger';

const RESULT_EMOJI = ':game_die:';

export const data = new SlashCommandBuilder()
  .setName('roll')
  .setDescription('Losuje randomową liczbę. (Standardowo D6)')
  .addIntegerOption((option) =>
    option
      .setName('max-liczba')
      .setDescription('Liczba ścianek kostki (np. 20 dla D20)')
      .setRequired(false)
  );

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    const sides = interaction.options.getInteger('max-liczba') ?? 6;

    if (!isValidSides(sides)) {
      await interaction.reply('Kostka musi mieć co najmniej 2 ścianki.');
      return;
    }

    const result = rollDice(sides);
    await interaction.reply(formatRollResult(result, sides));
  } catch (error) {
    logger.error(`Błąd podczas wykonywania komendy /roll: ${error}`);
    await interaction
      .reply({
        content: 'Wystąpił błąd podczas rzucania kostką.',
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
  }
}

function isValidSides(sides: number): boolean {
  return sides >= 2;
}

function rollDice(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function formatRollResult(result: number, sides: number): string {
  return `${RESULT_EMOJI} ${result} (1 - ${sides})`;
}
