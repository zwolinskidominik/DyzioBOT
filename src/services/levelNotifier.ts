import { Client, TextChannel, MessageMentionOptions, Snowflake } from 'discord.js';
import { LevelConfigModel } from '../models/LevelConfig';
import { syncRewardRoles } from './rewardRoles';
import logger from '../utils/logger';

export async function notifyLevelUp(c: Client, gid: string, uid: string, lvl: number) {
  const cfg = await LevelConfigModel.findOne({ guildId: gid }).lean();
  if (!cfg?.notifyChannelId) return;

  const g = c.guilds.cache.get(gid);
  if (!g) return;

  let m = g.members.cache.get(uid);
  if (!m) {
    m = await g.members.fetch(uid).catch(() => undefined);
  }
  if (!m) return;

  // Zawsze synchronizuj role nagrody
  await syncRewardRoles(m, lvl, cfg.roleRewards);

  // Sprawdź czy ten poziom ma przypisaną nagrodę
  const rewardForLevel = cfg.roleRewards?.find(r => r.level === lvl);
  
  // Wysyłaj powiadomienie tylko gdy poziom ma nagrodę (niezależnie czy użytkownik już miał rolę)
  if (!rewardForLevel) return;

  const ch = g.channels.cache.get(cfg.notifyChannelId) as TextChannel | undefined;
  if (!ch?.send) return;

  const am: MessageMentionOptions = { users: [uid as Snowflake], roles: [] };

  const tpl = cfg.rewardMessage?.trim() ?? '🎉 {user} zdobył nową rolę {roleId} za poziom **{level}**!';

  await ch
    .send({
      content: tpl
        .replace(/{user}/g, `<@${uid}>`)
        .replace(/{level}/g, `${lvl}`)
        .replace(/{roleId}/g, `<@&${rewardForLevel.roleId}>`),
      allowedMentions: am,
    })
    .catch(logger.error);
}
