import { prop, getModelForClass, modelOptions, Severity } from '@typegoose/typegoose';
import { LogEventType } from '../interfaces/LogEvent';

@modelOptions({
  schemaOptions: {
    collection: 'logconfigurations',
    timestamps: true,
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
})
export class LogConfiguration {
  @prop({ required: true, unique: true, type: String })
  public guildId!: string;

  @prop({ type: Boolean, default: false })
  public enabled!: boolean;

  @prop({ type: () => Object, default: {} })
  public logChannels!: Partial<Record<LogEventType, string>>;

  @prop({ type: () => Object, default: {} })
  public enabledEvents!: Partial<Record<LogEventType, boolean>>;

  @prop({ type: () => [String], default: [] })
  public ignoredChannels?: string[];

  @prop({ type: () => [String], default: [] })
  public ignoredRoles?: string[];

  @prop({ type: () => [String], default: [] })
  public ignoredUsers?: string[];

  @prop({ type: () => Object, default: {} })
  public colorOverrides?: Partial<Record<LogEventType, string>>;
}

export const LogConfigurationModel = getModelForClass(LogConfiguration);
