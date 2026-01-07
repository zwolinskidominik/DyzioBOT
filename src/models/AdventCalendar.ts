import { prop, getModelForClass, DocumentType, index, modelOptions, Severity } from '@typegoose/typegoose';

interface DayReward {
  day: number;
  xp: number;
  openedAt: Date;
}

@index({ guildId: 1, userId: 1 }, { unique: true })
@modelOptions({ options: { allowMixed: Severity.ALLOW } })
class AdventCalendar {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ type: () => Array, default: [] })
  public openedDays!: DayReward[];

  @prop({ default: 0, type: () => Number })
  public totalXP!: number;
}

export const AdventCalendarModel = getModelForClass(AdventCalendar);
export type AdventCalendarDocument = DocumentType<AdventCalendar>;
