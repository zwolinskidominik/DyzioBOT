import { CommandConfigModel } from '../../models/CommandConfig';
import logger from '../../utils/logger';

/**
 * Komendy dostały angielskie nazwy (angielska wersja bota). Wyłączenia komend z dashboardu
 * (CommandConfig.disabledCommands) są zapisane po nazwach - przenosimy je na nowe, żeby wyłączona
 * komenda nie włączyła się sama. Idempotentne: przy kolejnych startach nic nie znajduje.
 */
export const RENAMED_COMMANDS: Readonly<Record<string, string>> = {
  ciekawostka: 'fact',
  dowcip: 'joke',
  'kamien-papier-nozyce': 'rock-paper-scissors',
  wisielec: 'hangman',
  'wisielec-top': 'hangman-top',
  'kalendarz-adwentowy': 'advent-calendar',
  wrozba: 'fortune',
  pogoda: 'weather',
};

export default async function run(): Promise<void> {
  try {
    let changed = 0;
    for (const [oldName, newName] of Object.entries(RENAMED_COMMANDS)) {
      // Celowo bez guildId: jednorazowa migracja nazw na wszystkich serwerach naraz.
      const result = await CommandConfigModel.updateMany(
        { disabledCommands: oldName },
        { $set: { 'disabledCommands.$': newName } }
      );
      changed += result.modifiedCount;
    }
    if (changed > 0) logger.info(`[i18n] Przeniesiono ${changed} wyłączeń komend na nowe angielskie nazwy.`);
  } catch (err) {
    logger.error(`[i18n] Migracja nazw komend w CommandConfig nie powiodła się: ${err}`);
  }
}
