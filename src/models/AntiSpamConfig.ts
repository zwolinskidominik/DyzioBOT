import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

/** `'none'` = brak dodatkowej kary (tylko ewentualne usunięcie wiadomości). */
export type AntiSpamPunishment = 'none' | 'warn' | 'mute' | 'kick' | 'ban';
export type AntiSpamMode = 'single' | 'ladder';

/**
 * Konfiguracja pojedynczej reguły Anti-Spam (rate / invites / mentions / repeat).
 * Wszystkie pola są zawsze obecne — część z nich (threshold, windowSeconds,
 * allowOwnServerInvites) ma znaczenie tylko dla niektórych reguł, reszta je ignoruje.
 */
export class AntiSpamRuleConfig {
  @prop({ type: Boolean, default: false })
  public on!: boolean;

  /** Czy usuwać wiadomość, która złamała regułę. */
  @prop({ type: Boolean, default: true })
  public deleteMessage!: boolean;

  /** 'single' = zawsze ta sama kara. 'ladder' = eskalacja wg `steps`. */
  @prop({ type: String, default: 'single' })
  public mode!: AntiSpamMode;

  /** Kara używana w trybie 'single'. */
  @prop({ type: String, default: 'mute' })
  public action!: AntiSpamPunishment;

  /** Kolejne kary w trybie 'ladder' (1. wykrycie → steps[0], 2. → steps[1], itd. — ostatni krok powtarza się). */
  @prop({ type: () => [String], default: ['warn'] })
  public steps!: AntiSpamPunishment[];

  /** Czas wyciszenia w minutach (bucket: '5' | '10' | '60' | '1440'), używany gdy kara = 'mute'. */
  @prop({ type: String, default: '5' })
  public muteDuration!: string;

  /** Po ilu godzinach licznik eskalacji/wykryć zeruje się (bucket: '1' | '24' | '168'). */
  @prop({ type: String, default: '24' })
  public reset!: string;

  /** Próg liczbowy (rate: liczba wiadomości, mentions: liczba wzmianek, repeat: liczba powtórzeń). */
  @prop({ type: Number, default: 5 })
  public threshold!: number;

  /** Okno czasowe w sekundach (używane tylko przez regułę 'rate'). */
  @prop({ type: Number, default: 3 })
  public windowSeconds!: number;

  /** Czy zaproszenia do TEGO serwera są dozwolone (używane tylko przez regułę 'invites'). */
  @prop({ type: Boolean, default: true })
  public allowOwnServerInvites!: boolean;
}

@modelOptions({
  schemaOptions: {
    collection: 'antispamconfigs',
    timestamps: true,
  },
})
export class AntiSpamConfig {
  @prop({ required: true, unique: true, type: String })
  public guildId!: string;

  @prop({ type: Boolean, default: false })
  public enabled!: boolean;

  /** Za szybkie pisanie (rate-limit). */
  @prop({ type: () => AntiSpamRuleConfig, default: () => ({}) })
  public rate!: AntiSpamRuleConfig;

  /** Linki z zaproszeniami do innych serwerów. */
  @prop({ type: () => AntiSpamRuleConfig, default: () => ({}) })
  public invites!: AntiSpamRuleConfig;

  /** Masowe wzmianki (@user/@role, a także @everyone/@here gdy reguła jest włączona). */
  @prop({ type: () => AntiSpamRuleConfig, default: () => ({}) })
  public mentions!: AntiSpamRuleConfig;

  /** Powtarzające się wiadomości (ta sama treść wysłana N razy pod rząd). */
  @prop({ type: () => AntiSpamRuleConfig, default: () => ({}) })
  public repeat!: AntiSpamRuleConfig;

  /** Kanały pomijane przez wszystkie reguły. */
  @prop({ type: () => [String], default: [] })
  public ignoredChannels!: string[];

  /** Role pomijane przez wszystkie reguły. */
  @prop({ type: () => [String], default: [] })
  public ignoredRoles!: string[];
}

export const AntiSpamConfigModel = getModelForClass(AntiSpamConfig);
