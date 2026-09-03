import { getModelForClass, modelOptions, prop, DocumentType } from '@typegoose/typegoose';

/**
 * Pojedynczy dokument (singleton, key='main') z ostatnim heartbeatem bota —
 * czytany przez dashboard, żeby pokazać status online + ping w nagłówku strony
 * głównej. Zapisywany cyklicznie z src/events/clientReady/botStatusHeartbeat.ts.
 */
@modelOptions({ schemaOptions: { collection: 'botstatus' } })
export class BotStatus {
  @prop({ required: true, unique: true, type: () => String, default: 'main' })
  public key!: string;

  @prop({ required: true, type: () => Number })
  public ping!: number;

  @prop({ required: true, type: () => Date })
  public updatedAt!: Date;
}

export const BotStatusModel = getModelForClass(BotStatus);
export type BotStatusDocument = DocumentType<BotStatus>;
