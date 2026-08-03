import { getModelForClass, index, modelOptions, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1, fileName: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: 'greetinggifstates', timestamps: true } })
class GreetingGifState {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public fileName!: string;

  @prop({ type: () => Boolean, default: true })
  public disabled!: boolean;

  @prop({ type: () => String })
  public disabledBy?: string;

  @prop({ type: () => Date })
  public disabledAt?: Date;
}

export const GreetingGifStateModel = getModelForClass(GreetingGifState);
export type GreetingGifStateDocument = DocumentType<GreetingGifState>;