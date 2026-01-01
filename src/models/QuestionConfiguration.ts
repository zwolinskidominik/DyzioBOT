import { getModelForClass, prop, DocumentType } from '@typegoose/typegoose';

class QuestionConfiguration {
  @prop({ required: true, unique: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: true })
  public enabled!: boolean;

  @prop({ required: true, type: () => String })
  public questionChannelId!: string;

  @prop({ type: () => String })
  public pingRoleId?: string;
}

export const QuestionConfigurationModel = getModelForClass(QuestionConfiguration);
export type QuestionConfigurationDocument = DocumentType<QuestionConfiguration>;
