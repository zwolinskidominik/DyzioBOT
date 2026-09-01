import { ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../interfaces/Command';
import { CommandConfigModel } from '../models/CommandConfig';
import logger from '../utils/logger';

/** Kategorie (foldery src/commands/) objęte modułem "Narzędzia" w dashboardzie. */
const UTILITY_CATEGORIES = new Set(['fun', 'misc']);

/**
 * Pojedyncze komendy spoza fun/misc, które mimo kategorii "admin" (bo fizycznie
 * leżą w src/commands/admin/) też należą do modułu "Narzędzia" w dashboardzie —
 * reszta kategorii "admin" (giveaway, xp) ma WŁASNE gate'y (patrz moduleToggle.ts).
 */
const ADDITIONAL_UTILITY_COMMANDS = new Set(['say', 'role', 'emoji-steal']);

export default async function commandToggle(
  interaction: ChatInputCommandInteraction,
  command: ICommand
): Promise<string | null> {
  if (!interaction.guildId) return null;
  const isUtility =
    (command.category && UTILITY_CATEGORIES.has(command.category)) ||
    ADDITIONAL_UTILITY_COMMANDS.has(command.data.name);
  if (!isUtility) return null;

  try {
    const config = await CommandConfigModel.findOne({ guildId: interaction.guildId }).lean();

    if (!config) return null; // brak configu = moduł włączony (opt-out)
    if (config.enabled === false) {
      return '🔧 Moduł Komendy jest wyłączony na tym serwerze.';
    }
    if (config.disabledCommands?.includes(command.data.name)) {
      return '🔧 Ta komenda jest wyłączona na tym serwerze.';
    }

    return null;
  } catch (error) {
    logger.error(`Błąd sprawdzania commandToggle: ${error}`);
    return null; // fail-open — błąd bazy nie powinien blokować komend
  }
}
