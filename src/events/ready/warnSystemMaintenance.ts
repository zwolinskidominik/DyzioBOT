import { schedule } from 'node-cron';
import { WarnModel, WarnDocument } from '../../models/Warn';
import logger from '../../utils/logger';
import { env } from '../../config';
const { GUILD_ID } = env();

export default async function run(): Promise<void> {
  schedule(
    '0 0 * * *',
    async () => {
      try {
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setMonth(expiryDate.getMonth() - 3);

        const warnings = (await WarnModel.find({
          guildId: GUILD_ID,
        }).exec()) as WarnDocument[];
        for (const warn of warnings) {
          const before = warn.warnings.length;
          warn.warnings = warn.warnings.filter((w) => w.date > expiryDate);
          const afterCount = warn.warnings.length;
          const removed = before - afterCount;
          if (removed > 0) {
            await warn.save();
            logger.info(
              `🍂 Wygasły ${removed} ostrzeżeń dla userId=${warn.userId}, pozostało ${afterCount}`
            );
          }
        }
      } catch (error) {
        logger.error(`Błąd podczas wygasania ostrzeżeń: ${error}`);
      }
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );
}
