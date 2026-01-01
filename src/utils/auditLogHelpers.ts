import { Guild, AuditLogEvent, GuildAuditLogsEntry, User } from 'discord.js';
import logger from './logger';

export async function getAuditLogEntry(
  guild: Guild,
  event: AuditLogEvent,
  targetId?: string,
  maxAge: number = 5000
): Promise<GuildAuditLogsEntry | null> {
  try {
    const auditLogs = await guild.fetchAuditLogs({
      type: event,
      limit: 10,
    });

    const now = Date.now();
    
    for (const entry of auditLogs.entries.values()) {
      if (now - entry.createdTimestamp > maxAge) continue;
      
      if (targetId && entry.target && 'id' in entry.target) {
        if (entry.target.id === targetId) return entry;
      } else if (!targetId) {
        return entry;
      }
    }

    return null;
  } catch (error) {
    logger.debug(`Nie można pobrać audit log: ${error}`);
    return null;
  }
}

export async function getModerator(
  guild: Guild,
  event: AuditLogEvent,
  targetId?: string
): Promise<User | null> {
  const entry = await getAuditLogEntry(guild, event, targetId);
  const executor = entry?.executor;
  
  if (!executor || !('tag' in executor)) return null;
  
  return executor as User;
}

export async function getReason(
  guild: Guild,
  event: AuditLogEvent,
  targetId?: string
): Promise<string | null> {
  const entry = await getAuditLogEntry(guild, event, targetId);
  return entry?.reason ?? null;
}
