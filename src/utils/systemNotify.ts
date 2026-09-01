import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { GuildSettingsModel } from '../models/GuildSettings';
import logger from './logger';

export type SystemNotifyKind = 'missing_channel' | 'missing_permissions';

interface SystemNotifyParams {
  guildId: string;
  kind: SystemNotifyKind;
  message: string;
}

/**
 * Wysyła powiadomienie systemowe na kanał skonfigurowany w module Ustawienia
 * (GuildSettings.systemNotifyChannelId) — np. gdy bot nie ma uprawnień do
 * jakiegoś innego, skonfigurowanego wcześniej kanału (logi, urodziny, itp.).
 *
 * Celowo NIGDY nie rzuca ani nie propaguje błędu wyżej — to już JEST obsługa
 * błędu, więc porażka wysyłki samego powiadomienia może się tylko zalogować,
 * nigdy zapętlić (np. gdyby sam kanał powiadomień też miał zepsute uprawnienia).
 */
export async function notifySystemChannel(client: Client, params: SystemNotifyParams): Promise<void> {
  const { guildId, kind, message } = params;
  try {
    const settings = await GuildSettingsModel.findOne({ guildId }).lean();
    const channelId = settings?.systemNotifyChannelId;
    if (!channelId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel?.send) return;

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('⚠️ Powiadomienie systemowe')
      .setDescription(message)
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd wysyłania powiadomienia systemowego (${kind}, guild=${guildId}): ${error}`);
  }
}
