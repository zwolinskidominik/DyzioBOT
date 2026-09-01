import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

/**
 * Per-guild przełącznik modułu "Narzędzia" (komendy fun/ + misc/, bez moderacji).
 * Semantyka opt-out: brak dokumentu lub `enabled` nieustawione = moduł włączony.
 */
@modelOptions({
  schemaOptions: {
    collection: 'commandconfigs',
    timestamps: true,
  },
})
export class CommandConfig {
  @prop({ required: true, unique: true, type: String })
  public guildId!: string;

  @prop({ type: Boolean, default: true })
  public enabled!: boolean;

  /** Nazwy pojedynczych komend (data.name) wyłączonych na tym serwerze. */
  @prop({ type: () => [String], default: [] })
  public disabledCommands!: string[];
}

export const CommandConfigModel = getModelForClass(CommandConfig);
