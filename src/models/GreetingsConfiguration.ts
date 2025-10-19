import { getModelForClass, prop, DocumentType } from '@typegoose/typegoose';

class GreetingsConfiguration {
  @prop({ required: true, unique: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public greetingsChannelId!: string;

  // Feature toggles with sensible defaults
  @prop({ type: () => Boolean, default: true })
  public welcomeEnabled!: boolean;

  @prop({ type: () => Boolean, default: true })
  public goodbyeEnabled!: boolean;

  @prop({ type: () => Boolean, default: false })
  public dmEnabled!: boolean;
}

export const GreetingsConfigurationModel = getModelForClass(GreetingsConfiguration);
export type GreetingsConfigurationDocument = DocumentType<GreetingsConfiguration>;
