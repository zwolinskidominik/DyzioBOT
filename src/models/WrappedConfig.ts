import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
export class WrappedConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => String })
  public channelId?: string;

  @prop({ default: false, type: () => Boolean })
  public enabled!: boolean;
}

export const WrappedConfigModel = getModelForClass(WrappedConfig);
export type WrappedConfigDocument = DocumentType<WrappedConfig>;
