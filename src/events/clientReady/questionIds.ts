import { ensureQuestionIds } from '../../services/questionService';
import logger from '../../utils/logger';

/**
 * Przy starcie bota nadaje stałe questionId starym pytaniom dnia, które go nie mają.
 * Bez tego takie pytania nie dają się oznaczyć jako wysłane i wracają w kółko.
 */
export default async function run(): Promise<void> {
  const result = await ensureQuestionIds();
  if (!result.ok) {
    logger.warn(`[QOTD] ${result.message}`);
    return;
  }
  if (result.data > 0) {
    logger.info(`[QOTD] Uzupełniono stałe ID ${result.data} pytaniom dnia.`);
  }
}
