import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

class RoleReward {
  @prop({ required: true, type: () => Number, min: 1 })
  public level!: number;

  @prop({ required: true, type: () => String })
  public roleId!: string;

  @prop({ type: () => String, default: '' })
  public rewardMessage?: string;
}

class RoleMultiplier {
  @prop({ required: true, type: () => String })
  public roleId!: string;

  @prop({ required: true, type: () => Number, min: 0.1, max: 10 })
  public multiplier!: number;
}

class ChannelMultiplier {
  @prop({ required: true, type: () => String })
  public channelId!: string;

  @prop({ required: true, type: () => Number, min: 0.1, max: 10 })
  public multiplier!: number;
}

@index({ guildId: 1 }, { unique: true })
export class LevelConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ default: false, type: () => Boolean })
  public enabled!: boolean;

  @prop({ default: 5, type: () => Number, min: 0 })
  public xpPerMsg!: number;

  @prop({ default: 10, type: () => Number, min: 0 })
  public xpPerMinVc!: number;

  @prop({ default: 0, type: () => Number, min: 0 })
  public cooldownSec!: number;

  @prop({ type: () => String })
  public notifyChannelId?: string;

  @prop({ default: false, type: () => Boolean })
  public enableLevelUpMessages!: boolean;

  @prop({
    type: () => String,
    default: '{user} jesteś kozakiem! Wbiłeś/aś: **{level}** level. 👏',
  })
  public levelUpMessage!: string;

  @prop({
    type: () => String,
    default: '{user}! Zdobyto nową rolę na serwerze: {roleId}! Dziękujemy za aktywność!',
  })
  public rewardMessage!: string;

  @prop({ type: () => [RoleReward], _id: false, default: [] })
  public roleRewards!: RoleReward[];

  @prop({ type: () => [RoleMultiplier], _id: false, default: [] })
  public roleMultipliers!: RoleMultiplier[];

  @prop({ type: () => [ChannelMultiplier], _id: false, default: [] })
  public channelMultipliers!: ChannelMultiplier[];

  @prop({ type: () => [String], default: [] })
  public ignoredChannels!: string[];

  @prop({ type: () => [String], default: [] })
  public ignoredRoles!: string[];

  @prop({ type: () => String, default: '#3b82f6' })
  public cardThemeColor!: string;

  @prop({ default: true, type: () => Boolean })
  public showRankBadge!: boolean;

  @prop({ default: true, type: () => Boolean })
  public removePreviousRewards!: boolean;
}

export const LevelConfigModel = getModelForClass(LevelConfig);
export type LevelConfigDocument = DocumentType<LevelConfig>;
