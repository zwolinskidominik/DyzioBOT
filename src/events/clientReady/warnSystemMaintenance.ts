import { schedule } from 'node-cron';
import { WarnModel, WarnDocument } from '../../models/Warn';
import logger from '../../utils/logger';

export default async function run(): Promise<void> {
  schedule(
    '0 0 * * *',
    async () => {
      try {
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setMonth(expiryDate.getMonth() - 3);

        const warnings = (await WarnModel.find({ guildId: process.env.GUILD_ID }).exec()) as WarnDocument[];
        for (const warn of warnings) {
          const before = warn.warnings.length;
          warn.warnings = warn.warnings.filter((w) => w.date > expiryDate);
          const afterCount = warn.warnings.length;
          const removed = before - afterCount;
          
          if (removed > 0) {
            try {
              await warn.save();
              logger.info(
                `🍂 Wygasły ${removed} ostrzeżeń dla userId=${warn.userId}, pozostało ${afterCount}`
              );
            } catch (saveError) {
              logger.error(`Błąd zapisu dla userId=${warn.userId}: ${saveError}`, saveError);
              // Jeśli błąd walidacji, usuń cały dokument z błędnymi danymi
              if (saveError instanceof Error && saveError.message.includes('validation failed')) {
                await WarnModel.deleteOne({ _id: warn._id });
                logger.warn(`Usunięto uszkodzony dokument ostrzeżeń dla userId=${warn.userId}`);
              }
            }
          }
        }
      } catch (error) {
        logger.error('Błąd podczas utrzymania systemu ostrzeżeń', error);
      }
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );
}
