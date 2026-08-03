import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

export type TempChannelType = 'panel' | 'standard';

export class TempChannelCreatorConfig {
  @prop({ required: true, type: () => String })
  public channelId!: string;

  @prop({ required: true, type: () => String, default: 'panel' })
  public type!: TempChannelType;
}

@index({ guildId: 1 }, { unique: true })
class TempChannelConfiguration {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  // Opt-out semantics: default true so guilds with creator channels configured
  // before this flag existed keep working unchanged.
  @prop({ type: () => Boolean, default: true })
  public enabled!: boolean;

  /** @deprecated legacy field kept for backward compatibility — derived from `creators` on every save. */
  @prop({ required: true, type: () => [String], default: [] })
  public channelIds!: string[];

  @prop({ type: () => [TempChannelCreatorConfig], default: [] })
  public creators!: TempChannelCreatorConfig[];
}

export const TempChannelConfigurationModel = getModelForClass(TempChannelConfiguration);
export type TempChannelConfigurationDocument = DocumentType<TempChannelConfiguration>;
