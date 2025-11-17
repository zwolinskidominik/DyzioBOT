import { Client } from 'discord.js';
import { LevelModel } from '../models/Level';
import { LevelConfigModel } from '../models/LevelConfig';
import { deltaXp } from '../utils/levelMath';
import { notifyLevelUp } from './levelNotifier';
import { syncRewardRoles } from './rewardRoles';
import xpCache from '../cache/xpCache';

export async function modifyXp(client: Client, gid: string, uid: string, delta: number) {
  if (delta === 0) return;

  const cfg = await LevelConfigModel.findOne({ guildId: gid }).lean();
  const rewards = cfg?.roleRewards ?? [];

  const doc =
    (await LevelModel.findOne({ guildId: gid, userId: uid })) ??
    new LevelModel({ guildId: gid, userId: uid, xp: 0, level: 1 });

  let lvl = doc.level;
  let xp = doc.xp + delta;

  while (xp >= deltaXp(lvl)) {
    xp -= deltaXp(lvl);
    lvl++;
    await notifyLevelUp(client, gid, uid, lvl);
  }

  while (xp < 0 && lvl > 1) {
    lvl--;
    xp += deltaXp(lvl);
  }
  if (xp < 0) xp = 0;

  if (lvl < doc.level) {
    const g = client.guilds.cache.get(gid);
    if (g) {
      const m = await g.members.fetch(uid).catch(() => null);
      if (m) await syncRewardRoles(m, lvl, rewards);
    }
  }
  await LevelModel.updateOne({ guildId: gid, userId: uid }, { level: lvl, xp }, { upsert: true });

  xpCache.invalidateUser(gid, uid);
}
