import { Client } from 'discord.js';
import cron from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { BotStatusModel } from '../../models/BotStatus';
import logger from '../../utils/logger';

async function writeHeartbeat(client: Client): Promise<void> {
  if (!client.isReady()) return;

  await BotStatusModel.findOneAndUpdate(
    { key: 'main' },
    { key: 'main', ping: Math.max(0, Math.round(client.ws.ping)), updatedAt: new Date() },
    { upsert: true }
  );
}

export default function run(client: Client): void {
  writeHeartbeat(client).catch((err) => logger.error(`[BOT-STATUS-HEARTBEAT] ${err}`));

  cron.schedule(CRON.BOT_STATUS_HEARTBEAT, () => {
    writeHeartbeat(client).catch((err) => logger.error(`[BOT-STATUS-HEARTBEAT] ${err}`));
  });
}
