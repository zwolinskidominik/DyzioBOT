import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

export type TicketBannerMode = 'preset' | 'text' | 'none';

export class TicketTypeBannerConfig {
  @prop({ required: true, type: () => String, default: 'preset' })
  public mode!: TicketBannerMode;

  @prop({ type: () => String })
  public presetId?: string;

  @prop({ type: () => String })
  public text?: string;
}

export class TicketTypeConfig {
  @prop({ required: true, type: () => String })
  public id!: string;

  @prop({ required: true, type: () => String })
  public emoji!: string;

  @prop({ required: true, type: () => String })
  public name!: string;

  @prop({ type: () => String, default: '' })
  public description!: string;

  @prop({ required: true, type: () => [String], default: [] })
  public roleIds!: string[];

  @prop({ type: () => String, default: '#5865F2' })
  public color!: string;

  @prop({ type: () => TicketTypeBannerConfig, default: () => ({ mode: 'preset' }) })
  public banner!: TicketTypeBannerConfig;

  /** Mały obrazek w prawym górnym rogu embeda powitalnego (URL). Brak → ikona serwera. */
  @prop({ type: () => String })
  public thumbnail?: string;

  /** Krótki opis widoczny pod nazwą typu w dropdownie panelu (max 100 znaków, osobne od wiadomości powitalnej). */
  @prop({ type: () => String, default: '' })
  public dropdownDescription!: string;
}

export class TicketPanelMessageConfig {
  @prop({ type: () => String })
  public emoji?: string;

  @prop({ type: () => String, default: 'Kontakt z Administracją' })
  public title!: string;

  @prop({
    type: () => String,
    default: 'Aby skontaktować się z wybranym działem administracji, wybierz odpowiednią kategorię poniżej:',
  })
  public description!: string;

  @prop({ type: () => String, default: '#5865F2' })
  public color!: string;

  @prop({ type: () => String, default: 'Wybierz odpowiednią kategorię' })
  public placeholder!: string;

  @prop({ type: () => TicketTypeBannerConfig, default: () => ({ mode: 'preset', presetId: 'ticketBanner.png' }) })
  public banner!: TicketTypeBannerConfig;
}

export class TicketAutomationConfig {
  /** 0 = brak limitu otwartych ticketów na użytkownika. */
  @prop({ type: () => Number, default: 0 })
  public maxOpenPerUser!: number;

  /** 0 = wyłączone. Liczba godzin bezczynności przed auto-zamknięciem. */
  @prop({ type: () => Number, default: 0 })
  public autoCloseHours!: number;

  @prop({ type: () => Boolean, default: false })
  public transcriptEnabled!: boolean;

  @prop({ type: () => String })
  public transcriptChannelId?: string;
}

@index({ guildId: 1 }, { unique: true })
class TicketConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: false })
  public enabled!: boolean;

  @prop({ required: true, type: () => String })
  public categoryId!: string;

  @prop({ type: () => String })
  public panelChannelId?: string;

  @prop({ type: () => String })
  public panelMessageId?: string;

  @prop({ type: () => [TicketTypeConfig], default: [] })
  public types!: TicketTypeConfig[];

  @prop({ type: () => TicketAutomationConfig, default: () => ({}) })
  public automation!: TicketAutomationConfig;

  @prop({ type: () => TicketPanelMessageConfig, default: () => ({}) })
  public panelMessage!: TicketPanelMessageConfig;
}

export const TicketConfigModel = getModelForClass(TicketConfig);
export type TicketConfigDocument = DocumentType<TicketConfig>;
