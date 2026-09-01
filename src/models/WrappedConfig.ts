import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';
import { DEFAULT_WRAPPED_THEME, WrappedTheme } from '../services/serverWrappedService';

@index({ guildId: 1 }, { unique: true })
export class WrappedConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => String })
  public channelId?: string;

  @prop({ default: false, type: () => Boolean })
  public enabled!: boolean;

  @prop({ default: DEFAULT_WRAPPED_THEME, type: () => String })
  public colorTheme!: WrappedTheme;
}

export const WrappedConfigModel = getModelForClass(WrappedConfig);
export type WrappedConfigDocument = DocumentType<WrappedConfig>;
