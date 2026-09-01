import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
export class TournamentConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: false })
  public enabled!: boolean;

  @prop({ type: () => String })
  public channelId?: string;

  @prop({ 
    type: () => String, 
    default: `# Zasady co poniedziałkowych mixów 5vs5 {roleMention}
**Do kogo można się zgłaszać z dodatkowymi pytaniami o turniej?** 
 {organizerRoleMention}: {organizerUserPings}
### Zbiórka i start
-# Zbieramy się na kanale głosowym {voiceChannelLink} o godzinie **20:30 w każdy poniedziałek**. Do turnieju może dołączyć **każdy** zainteresowany rywalizacją i dobrą zabawą. Następnie przechodzimy do **losowania drużyn** na kole fortuny.
### Zakaz używania cheatów
-# Używanie programów wspomagających jest surowo zabronione. Turniej opiera się na uczciwej rywalizacji i dobrej atmosferze!
### Eksperymentowanie z bronią
-# Zeusy, kosy, granaty oraz wszelkie nietypowe bronie są mile widziane! Staraj się nie tryhardować - to nie jest mecz o rangę!
### Kultura
-# Szanujmy zarówno przeciwników, jak i swoich teammate'ów. Obrażanie, negatywne komentarze lub wyzwiska są zabronione – celem jest pozytywna atmosfera i dobra zabawa.` 
  })
  public messageTemplate!: string;

  @prop({ type: () => String, default: '25 20 * * 1' })
  public cronSchedule!: string;

  @prop({ type: () => String, default: '🎮' })
  public reactionEmoji!: string;

  @prop({ type: () => String, default: 'text' })
  public messageMode!: 'embed' | 'text';

  @prop({ type: () => String, default: '#3b82f6' })
  public embedColor!: string;

  @prop({ type: () => String, default: '🏆 Turniej CS2' })
  public titleText!: string;

  @prop({ type: () => String })
  public footerText?: string;

  /** Rola uczestników turnieju ({roleMention}). */
  @prop({ type: () => String })
  public participantRoleId?: string;

  /** Rola organizatorów turnieju ({organizerRoleMention}). */
  @prop({ type: () => String })
  public organizerRoleId?: string;

  /** Użytkownicy-organizatorzy pingowani w wiadomości ({organizerUserPings}). */
  @prop({ type: () => [String], default: [] })
  public organizerUserIds!: string[];

  /** Kanał głosowy turnieju ({voiceChannelLink}). */
  @prop({ type: () => String })
  public voiceChannelId?: string;
}

export const TournamentConfigModel = getModelForClass(TournamentConfig);
export type TournamentConfigDocument = DocumentType<TournamentConfig>;
