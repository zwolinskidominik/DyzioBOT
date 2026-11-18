import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type VoiceChannel,
} from 'discord.js';
import { MinecraftStateModel } from '../../models/MinecraftState';
import { safeSetChannelName } from '../../utils/channelHelpers';
import logger from '../../utils/logger';

/**
 * Kanał głosowy-licznik stanu serwera (np. „🟢 Online: 3/20”) w kategorii „⛏️ Minecraft”
 * zakładanej przez bota przy pierwszym uruchomieniu (ID zapisane w bazie). Widoczny dla wszystkich,
 * nikt nie może na niego wejść.
 *
 * Discord pozwala na ok. 2 zmiany nazwy kanału na 10 min (przekroczenie blokuje zmiany), dlatego
 * nazwa zmienia się tylko przy różnicy i najwyżej raz na 5 min; czeka zawsze tylko najnowszy stan.
 */

export const CATEGORY_NAME = '⛏️ Minecraft';
export const INITIAL_CHANNEL_NAME = '🔴 Offline';
export const RENAME_MIN_INTERVAL_MS = 5 * 60_000;

export class RenameLimiter {
  private desired: string | null = null;
  private lastRenameAt: number | null = null;

  public constructor(
    private readonly minIntervalMs = RENAME_MIN_INTERVAL_MS,
    private readonly now: () => number = Date.now
  ) {}

  /** Zapamiętuje najnowszą nazwę do ustawienia (poprzednia, jeszcze nieustawiona, przepada). */
  public request(name: string | null): void {
    if (name !== null) this.desired = name;
  }

  /** Nazwa do ustawienia TERAZ albo `null` (brak różnicy albo limit czasu jeszcze nie minął). */
  public takeDue(currentName: string): string | null {
    if (this.desired === null || this.desired === currentName) return null;
    if (this.lastRenameAt !== null && this.now() - this.lastRenameAt < this.minIntervalMs) return null;
    this.lastRenameAt = this.now();
    return this.desired;
  }
}

function asCategory(guild: Guild, id: string | undefined | null): CategoryChannel | null {
  if (!id) return null;
  const channel = guild.channels.cache.get(id);
  return channel?.type === ChannelType.GuildCategory ? channel : null;
}

function asVoice(guild: Guild, id: string | undefined): VoiceChannel | null {
  if (!id) return null;
  const channel = guild.channels.cache.get(id);
  return channel?.type === ChannelType.GuildVoice ? channel : null;
}

/**
 * Zwraca kanał-licznik, zakładając kategorię i kanał, jeśli ich nie ma (np. usunięte ręcznie).
 * ID zapisuje w bazie, więc po restarcie bota nic nie powstaje drugi raz.
 */
export async function ensureStatsChannel(guild: Guild): Promise<VoiceChannel | null> {
  try {
    const state =
      (await MinecraftStateModel.findOne({ guildId: guild.id })) ?? new MinecraftStateModel({ guildId: guild.id });

    let channel = asVoice(guild, state.statsChannelId);
    if (channel) {
      // Licznik przeniesiony ręcznie do innej kategorii - zapamiętaj ją i nie zakładaj własnej.
      if (channel.parentId && channel.parentId !== state.categoryId) state.categoryId = channel.parentId;
    } else {
      // Pierwszy raz (albo po ręcznym usunięciu) bot zakłada kategorię sam i zapamiętuje jej ID.
      let category = asCategory(guild, state.categoryId);
      if (!category) {
        category = await guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory });
        state.categoryId = category.id;
      }
      channel = await guild.channels.create({
        name: INITIAL_CHANNEL_NAME,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Connect] },
          ...(guild.members.me
            ? [{ id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] }]
            : []),
        ],
      });
      state.statsChannelId = channel.id;
    }

    if (state.isModified()) await state.save();
    return channel;
  } catch (err) {
    logger.error(`[MC] Nie udało się przygotować kanału-licznika (guild=${guild.id}): ${err}`);
    return null;
  }
}

/** Ustawia nazwę licznika, jeśli limiter na to pozwala. */
export async function applyStatsChannelName(channel: VoiceChannel, limiter: RenameLimiter): Promise<void> {
  const due = limiter.takeDue(channel.name);
  if (!due) return;
  try {
    await safeSetChannelName(channel, due);
  } catch (err) {
    logger.warn(`[MC] Nie udało się zmienić nazwy licznika: ${err}`);
  }
}
