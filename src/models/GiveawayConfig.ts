import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

class RoleMultiplier {
  @prop({ required: true, type: () => String })
  public roleId!: string;

  @prop({ required: true, type: () => Number, min: 1 })
  public multiplier!: number;
}

class GiveawayConfig {
  @prop({ required: true, unique: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: false })
  public enabled!: boolean;

  @prop({ type: () => String })
  public additionalNote?: string;

  @prop({ type: () => [RoleMultiplier], default: [] })
  public roleMultipliers!: RoleMultiplier[];
}

export const GiveawayConfigModel = getModelForClass(GiveawayConfig);
export type GiveawayConfigDocument = DocumentType<GiveawayConfig>;
