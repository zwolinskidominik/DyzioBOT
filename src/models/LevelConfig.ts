import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

class RoleReward {
  @prop({ required: true, type: () => Number })
  public level!: number;

  @prop({ required: true, type: () => String })
  public roleId!: string;

  @prop({ type: () => String, default: '' })
  public rewardMessage?: string;
}

@index({ guildId: 1 }, { unique: true })
export class LevelConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ default: 5, type: () => Number })
  public xpPerMsg!: number;

  @prop({ default: 10, type: () => Number })
  public xpPerMinVc!: number;

  @prop({ default: 0, type: () => Number })
  public cooldownSec!: number;

  @prop({ type: () => String })
  public notifyChannelId?: string;

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
}

export const LevelConfigModel = getModelForClass(LevelConfig);
export type LevelConfigDocument = DocumentType<LevelConfig>;
