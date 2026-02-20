import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

@modelOptions({
  schemaOptions: {
    collection: 'logconfigurations',
    timestamps: true,
  },
})
export class LogConfiguration {
  @prop({ required: true, unique: true, type: String })
  public guildId!: string;

  @prop({ type: Boolean, default: false })
  public enabled!: boolean;

  @prop({ type: () => String, default: {} })
  public logChannels!: Map<string, string>;

  @prop({ type: () => Boolean, default: {} })
  public enabledEvents!: Map<string, boolean>;

  @prop({ type: () => [String], default: [] })
  public ignoredChannels?: string[];

  @prop({ type: () => [String], default: [] })
  public ignoredRoles?: string[];

  @prop({ type: () => [String], default: [] })
  public ignoredUsers?: string[];

  @prop({ type: () => String, default: {} })
  public colorOverrides?: Map<string, string>;
}

export const LogConfigurationModel = getModelForClass(LogConfiguration);
