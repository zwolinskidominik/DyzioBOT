import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

export const DEFAULT_DISBOARD_MESSAGE =
  '### Cześć i czołem! <a:pepo_howody:1351311201614827583>  \n' +
  'Pomóżcie nam rosnąć w siłę! Zostawcie szczerą recenzję o naszym serwerze na Disboardzie. \n' +
  'Każda opinia – niezależnie od tego, czy pozytywna, czy negatywna – jest dla nas bardzo cenna. \n\n' +
  '**Z góry dziękuję każdemu, kto znajdzie chwilę, by pomóc.** <:pepe_ok:1351199540304285726> \n' +
  '**Link do zamieszczenia recenzji:** https://disboard.org/pl/server/881293681783623680\n' +
  '-# Dla każdego, kto zdecyduje się napisać swoją opinię i zgłosi się do administracji serwera, przewidziano jednorazową nagrodę w postaci bonusu +5.000 XP.';

@modelOptions({
  schemaOptions: {
    collection: 'disboardconfigs',
    timestamps: true,
  },
})
export class DisboardConfig {
  @prop({ required: true, unique: true, type: String })
  public guildId!: string;

  @prop({ type: Boolean, default: false })
  public enabled!: boolean;

  /** Text channel where reminders are posted. */
  @prop({ type: String, default: '' })
  public channelId!: string;

  /** Message content to send (supports Discord markdown). */
  @prop({ type: String, default: DEFAULT_DISBOARD_MESSAGE })
  public message!: string;

  /** Timestamp of the last reminder sent. */
  @prop({ type: Date, default: null })
  public lastSentAt!: Date | null;

  /** Pre-computed next send timestamp (randomised). */
  @prop({ type: Date, default: null })
  public nextSendAt!: Date | null;
}

export const DisboardConfigModel = getModelForClass(DisboardConfig);
