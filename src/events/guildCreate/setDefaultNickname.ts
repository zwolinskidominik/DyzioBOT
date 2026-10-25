import { Client, Guild, PermissionFlagsBits } from 'discord.js';
import logger from '../../utils/logger';

/**
 * Nazwa użytkownika bota to „DeezyBOT" (Discord nie przydziela już „Deezy" - za dużo kont o tej
 * nazwie), ale aplikacja nazywa się „Deezy". Na liście członków i przy wiadomościach Discord
 * pokazuje nick, więc po dodaniu na serwer ustawiamy sobie nick „Deezy".
 */
export const DEFAULT_BOT_NICKNAME = 'Deezy';

export default async function run(guild: Guild, _client: Client): Promise<void> {
  try {
    const me = guild.members.me ?? (await guild.members.fetchMe());
    // Administracja zdążyła ustawić własny nick (albo bot wrócił z nickiem) - nie nadpisujemy.
    if (me.nickname) return;
    if (!me.permissions.has(PermissionFlagsBits.ChangeNickname)) return;

    await me.setNickname(DEFAULT_BOT_NICKNAME, 'Domyślny nick bota Deezy');
  } catch (err) {
    logger.warn(`[Nickname] Nie ustawiono nicku bota na serwerze ${guild.id}: ${err}`);
  }
}
