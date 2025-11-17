import { Client, TextChannel, MessageMentionOptions, Snowflake } from 'discord.js';
import { LevelConfigModel } from '../models/LevelConfig';
import { syncRewardRoles } from './rewardRoles';
import logger from '../utils/logger';

export async function notifyLevelUp(c: Client, gid: string, uid: string, lvl: number) {
  const cfg = await LevelConfigModel.findOne({ guildId: gid }).lean();
  if (!cfg?.notifyChannelId || !cfg?.enableLevelUpMessages) return;

  const g = c.guilds.cache.get(gid);
  if (!g) return;
  const ch = g.channels.cache.get(cfg.notifyChannelId) as TextChannel | undefined;
  if (!ch?.send) return;

  let m = g.members.cache.get(uid);
  if (!m) {
    m = await g.members.fetch(uid).catch(() => undefined);
  }
  if (!m) return;

  const { gained } = await syncRewardRoles(m, lvl, cfg.roleRewards);
  const am: MessageMentionOptions = { users: [uid as Snowflake], roles: [] };

  const tpl = gained
    ? (cfg.rewardMessage?.trim() ?? '🎉 {user} zdobył nową rolę {roleId} za poziom **{level}**!')
    : (cfg.levelUpMessage?.trim() ?? '🎉 {user} osiągnął poziom **{level}**!');

  await ch
    .send({
      content: tpl
        .replace(/{user}/g, `<@${uid}>`)
        .replace(/{level}/g, `${lvl}`)
        .replace(/{roleId}/g, gained ? `<@&${gained}>` : ''),
      allowedMentions: am,
    })
    .catch(logger.error);
}
