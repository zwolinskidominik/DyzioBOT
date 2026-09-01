import { prop, getModelForClass, modelOptions, index } from '@typegoose/typegoose';
import type { AntiSpamPunishment } from './AntiSpamConfig';

/**
 * Zapis pojedynczego zadziałania reguły Anti-Spam. Używane do:
 * - eskalacji w trybie "ladder" (ile razy user złamał regułę w oknie resetu),
 * - statystyki "interwencji w X dni" na dashboardzie.
 */
@modelOptions({
  schemaOptions: {
    collection: 'antispamincidents',
    timestamps: true,
  },
})
@index({ guildId: 1, userId: 1, rule: 1, createdAt: -1 })
@index({ guildId: 1, createdAt: -1 })
export class AntiSpamIncident {
  @prop({ required: true, type: String })
  public guildId!: string;

  @prop({ required: true, type: String })
  public userId!: string;

  /** 'rate' | 'invites' | 'mentions' | 'repeat'. */
  @prop({ required: true, type: String })
  public rule!: string;

  @prop({ required: true, type: String })
  public actionTaken!: AntiSpamPunishment;
}

export const AntiSpamIncidentModel = getModelForClass(AntiSpamIncident);
