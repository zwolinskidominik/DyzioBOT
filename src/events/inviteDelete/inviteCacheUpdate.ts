import { Invite } from 'discord.js';
import { markInviteDeleted } from '../../services/inviteUsageService';
import logger from '../../utils/logger';

/**
 * Zaproszenie usunięte (ręcznie albo przez Discord po zużyciu limitu). Pamięci NIE odświeżamy:
 * Discord potrafi wysłać to zdarzenie, zanim przyjdzie dołączenie, które to zaproszenie zużyło —
 * gdybyśmy je wyrzucili, nie dałoby się ustalić autora. Przy następnym dołączeniu
 * detectUsedInvite i tak porówna stan i wyczyści pamięć. W historii licznik zostaje.
 */
export default async function run(invite: Invite): Promise<void> {
  try {
    if (!invite.guild) return;
    await markInviteDeleted(invite.guild.id, invite.code);
  } catch (error) {
    logger.warn(`[InviteCache] Nie udało się oznaczyć usuniętego zaproszenia: ${error}`);
  }
}
