import { Client, TextChannel, MessageMentionOptions, Snowflake } from 'discord.js';
import { LevelConfigModel } from '../models/LevelConfig';
import { syncRewardRoles } from './rewardRoles';
import logger from '../utils/logger';

export async function notifyLevelUp(c: Client, gid: string, uid: string, lvl: number) {
  const cfg = await LevelConfigModel.findOne({ guildId: gid }).lean();
  if (!cfg) return;

  const g = c.guilds.cache.get(gid);
  if (!g) return;

  let m = g.members.cache.get(uid);
  if (!m) {
    m = await g.members.fetch(uid).catch(() => undefined);
  }
  if (!m) return;

  // Synchronizacja ról-nagród nie może zależeć od tego, czy skonfigurowano
  // kanał powiadomień — wcześniej brak notifyChannelId blokował przyznawanie
  // ról w ogóle.
  await syncRewardRoles(m, lvl, cfg.roleRewards ?? [], cfg.removePreviousRewards ?? true);

  if (!cfg.notifyChannelId) return;

  const ch = g.channels.cache.get(cfg.notifyChannelId) as TextChannel | undefined;
  if (!ch?.send) return;

  const am: MessageMentionOptions = { users: [uid as Snowflake], roles: [] };
  const rewardForLevel = cfg.roleRewards?.find(r => r.level === lvl);

  // Opt-out semantics (default true) — istniejące configi bez tego pola mają
  // działać tak jak wcześniej (wiadomość o nagrodzie zawsze włączona).
  if (rewardForLevel && cfg.enableRewardMessages !== false) {
    const tpl = rewardForLevel.rewardMessage?.trim() || cfg.rewardMessage?.trim() || '🎉 {user} zdobył nową rolę {roleId} za poziom **{level}**!';

    await ch
      .send({
        content: tpl
          .replace(/{user}/g, `<@${uid}>`)
          .replace(/{level}/g, `${lvl}`)
          .replace(/{roleId}/g, `<@&${rewardForLevel.roleId}>`),
        allowedMentions: am,
      })
      .catch(logger.error);
    return;
  }

  // Brak nagrody za ten poziom (albo jest, ale wiadomości o nagrodzie są
  // wyłączone) — wyślij ogólną wiadomość o awansie, jeśli włączona.
  if (cfg.enableLevelUpMessages && cfg.levelUpMessage?.trim()) {
    await ch
      .send({
        content: cfg.levelUpMessage
          .replace(/{user}/g, `<@${uid}>`)
          .replace(/{level}/g, `${lvl}`),
        allowedMentions: am,
      })
      .catch(logger.error);
  }
}
