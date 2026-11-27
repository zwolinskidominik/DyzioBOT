import { index, prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

/**
 * Ostatnie statystyki graczy GameZone pobrane z gamezone-control (GET /stats). Trzymane w bazie,
 * żeby /mc-stats i /mc-top działały też, gdy usługa chwilowo nie odpowiada. Jeden dokument na serwer.
 */
export class MinecraftPlayerStat {
  @prop({ required: true, type: () => String })
  public uuid!: string;

  @prop({ required: true, type: () => String })
  public name!: string;

  /** Czas gry w tickach (20 ticków = 1 s), statystyka minecraft:play_time. */
  @prop({ required: true, type: () => Number })
  public playTime!: number;

  @prop({ required: true, type: () => Number })
  public deaths!: number;
}

@index({ guildId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { timestamps: true, collection: 'minecraft_stats' } })
class MinecraftStatsSnapshot {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  /** Kiedy serwer Minecraft zapisał statystyki (z usługi; null = nieznane). */
  @prop({ type: () => Date })
  public statsUpdatedAt?: Date | null;

  @prop({ type: () => [MinecraftPlayerStat], default: [], _id: false })
  public players!: MinecraftPlayerStat[];
}

export const MinecraftStatsSnapshotModel = getModelForClass(MinecraftStatsSnapshot);
