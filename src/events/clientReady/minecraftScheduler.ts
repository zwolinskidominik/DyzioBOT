import { Client } from 'discord.js';
import cron from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { getMinecraftRuntime, runMinecraftCycle } from '../../services/minecraft/runtime';
import logger from '../../utils/logger';

/**
 * Co minutę: stan serwera Minecraft GameZone → licznik w kategorii „⛏️ Minecraft”, stały panel
 * /minecraft i wyrównanie whitelisty. Działa tylko, gdy funkcja jest skonfigurowana (MC_*).
 */
export default async function run(client: Client): Promise<void> {
  if (!getMinecraftRuntime()) return;

  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runMinecraftCycle(client);
    } catch (err) {
      logger.error(`[MC] Błąd cyklu Minecraft: ${err}`);
    } finally {
      busy = false;
    }
  };

  cron.schedule(CRON.MINECRAFT_CHECK, tick);
  void tick();
}
