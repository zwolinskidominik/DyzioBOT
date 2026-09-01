import { GuildMember } from 'discord.js';
import type { DocumentType } from '@typegoose/typegoose';
import {
  ModerationConfigModel,
  ModerationConfig,
  ModerationCommandConfig,
} from '../models/ModerationConfig';

export type ModerationCommandKey =
  | 'warn'
  | 'warnRemove'
  | 'mute'
  | 'kick'
  | 'ban'
  | 'unban'
  | 'clear';

export type ModerationConfigDocument = DocumentType<ModerationConfig>;

/** Pobiera config serwera, tworząc go z domyślnymi wartościami przy pierwszym użyciu. */
export async function getOrCreateModerationConfig(
  guildId: string
): Promise<ModerationConfigDocument> {
  return ModerationConfigModel.findOneAndUpdate(
    { guildId },
    { $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export interface CommandAccessResult {
  allowed: boolean;
  /** Komunikat do pokazania użytkownikowi, gdy allowed === false. */
  reason?: string;
  config: ModerationConfigDocument;
}

/**
 * Sprawdza czy komenda może zostać wykonana: moduł włączony → komenda włączona →
 * moderator ma natywne uprawnienie Discorda LUB jedną z ról z `extraRoleIds`.
 * Musi być wołane RĘCZNIE na początku run() każdej komendy moderacyjnej — te
 * komendy NIE mają `userPermissions` w ICommandConfig, bo CommandHandler
 * odrzuciłby interakcję przed dotarciem do tej logiki (extraRoleIds ma prawo
 * przepuścić kogoś BEZ natywnego uprawnienia).
 */
export async function checkCommandAccess(params: {
  guildId: string;
  member: GuildMember;
  commandKey: ModerationCommandKey;
  requiredPermission: bigint;
}): Promise<CommandAccessResult> {
  const { guildId, member, commandKey, requiredPermission } = params;
  const config = await getOrCreateModerationConfig(guildId);

  if (!config.enabled) {
    return { allowed: false, reason: 'Moduł moderacji jest wyłączony na tym serwerze.', config };
  }

  const cmdConfig: ModerationCommandConfig = config[commandKey];
  if (!cmdConfig.on) {
    return { allowed: false, reason: 'Ta komenda jest wyłączona na tym serwerze.', config };
  }

  if (member.permissions.has(requiredPermission)) {
    return { allowed: true, config };
  }

  const hasExtraRole = cmdConfig.extraRoleIds.some((roleId) => member.roles.cache.has(roleId));
  if (hasExtraRole) {
    return { allowed: true, config };
  }

  return { allowed: false, reason: 'Nie masz uprawnień do użycia tej komendy.', config };
}
