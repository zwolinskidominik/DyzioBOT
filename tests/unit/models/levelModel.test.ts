import { LevelModel } from '../../../src/models/Level';
import { LevelConfigModel } from '../../../src/models/LevelConfig';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('Level & LevelConfig Models', () => {
  beforeAll(async () => {
    await connectTestDb();
    await LevelModel.ensureIndexes();
    await LevelConfigModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('Level defaults xp=0 level=1', async () => {
    const lvl = await LevelModel.create({ guildId: 'g1', userId: 'u1' });
    expect(lvl.xp).toBe(0);
    expect(lvl.level).toBe(1);
  });

  it('rejects negative xp or level', async () => {
    await expect(
      LevelModel.create({ guildId: 'g1', userId: 'u2', xp: -5 }) as any
    ).rejects.toThrow();
    await expect(
      LevelModel.create({ guildId: 'g1', userId: 'u3', level: 0 }) as any
    ).rejects.toThrow();
  });

  it('LevelConfig defaults & roleRewards empty', async () => {
    const cfg = await LevelConfigModel.create({ guildId: 'gCfg' });
    expect(cfg.xpPerMsg).toBe(5);
    expect(cfg.xpPerMinVc).toBe(10);
    expect(cfg.cooldownSec).toBe(0);
    expect(cfg.roleRewards).toEqual([]);
  });

  it('rejects negative xpPerMsg/xpPerMinVc/cooldownSec', async () => {
    await expect(
      LevelConfigModel.create({ guildId: 'gNeg1', xpPerMsg: -1 }) as any
    ).rejects.toThrow();
    await expect(
      LevelConfigModel.create({ guildId: 'gNeg2', xpPerMinVc: -2 }) as any
    ).rejects.toThrow();
    await expect(
      LevelConfigModel.create({ guildId: 'gNeg3', cooldownSec: -3 }) as any
    ).rejects.toThrow();
  });

  it('adds roleRewards and enforces level>=1', async () => {
    const guildId = `gRoles-${Date.now()}-${Math.random()}`;
    const cfg = await LevelConfigModel.create({ guildId });
    cfg.roleRewards.push({ level: 2, roleId: 'role1' });
    await cfg.save();
    const reloaded = await LevelConfigModel.findOne({ guildId });
    expect(reloaded?.roleRewards[0].level).toBe(2);
    await expect(async () => {
      reloaded!.roleRewards.push({ level: 0, roleId: 'bad' } as any);
      await reloaded!.save();
    }).rejects.toThrow();
  });

  it('enforces unique guildId constraint', async () => {
    await LevelConfigModel.create({ guildId: 'unique-test' });
    await expect(
      LevelConfigModel.create({ guildId: 'unique-test' }) as any
    ).rejects.toThrow();
  });

  it('sets default message templates correctly', async () => {
    const cfg = await LevelConfigModel.create({ guildId: 'msgTest' });
    expect(cfg.levelUpMessage).toBe('{user} jesteś kozakiem! Wbiłeś/aś: **{level}** level. 👏');
    expect(cfg.rewardMessage).toBe('{user}! Zdobyto nową rolę na serwerze: {roleId}! Dziękujemy za aktywność!');
  });

  it('handles optional fields correctly', async () => {
    const cfg = await LevelConfigModel.create({ guildId: 'minimal' });
    expect(cfg.notifyChannelId).toBeUndefined();
    
    const cfgWithOptional = await LevelConfigModel.create({ 
      guildId: 'withOptional', 
      notifyChannelId: 'channel123' 
    });
    expect(cfgWithOptional.notifyChannelId).toBe('channel123');
  });

  it('properly handles roleRewards with optional rewardMessage', async () => {
    const guildId = `roleRewardTest-${Date.now()}-${Math.random()}`;
    const cfg = await LevelConfigModel.create({ guildId });
    
    cfg.roleRewards.push({ level: 5, roleId: 'role5' });
    
    cfg.roleRewards.push({ 
      level: 10, 
      roleId: 'role10', 
      rewardMessage: 'Custom reward message!' 
    });
    
    await cfg.save();
    
    const reloaded = await LevelConfigModel.findOne({ guildId });
    expect(reloaded?.roleRewards[0].rewardMessage).toBe('');
    expect(reloaded?.roleRewards[1].rewardMessage).toBe('Custom reward message!');
  });

  it('validates roleRewards roleId is required', async () => {
    const cfg = await LevelConfigModel.create({ guildId: 'roleIdTest' });
    
    await expect(async () => {
      cfg.roleRewards.push({ level: 1, roleId: '' } as any);
      await cfg.save();
    }).rejects.toThrow();
    
    await expect(async () => {
      cfg.roleRewards.push({ level: 1 } as any);
      await cfg.save();
    }).rejects.toThrow();
  });
});
