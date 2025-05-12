import { getModelForClass, prop, DocumentType } from '@typegoose/typegoose';

class GreetingsConfiguration {
  @prop({ required: true, unique: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public greetingsChannelId!: string;
}

export const GreetingsConfigurationModel = getModelForClass(GreetingsConfiguration);
export type GreetingsConfigurationDocument = DocumentType<GreetingsConfiguration>;
