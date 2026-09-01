import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

export type WarnMode = 'single' | 'ladder';
/** 'none' = samo ostrzeżenie bez dodatkowej kary. */
export type WarnAction = 'none' | 'mute' | 'kick' | 'ban';

/**
 * Konfiguracja pojedynczej komendy moderacyjnej. `extraRoleIds` to role, które
 * mogą użyć komendy MIMO braku natywnego uprawnienia Discorda (własna warstwa
 * ponad `.setDefaultMemberPermissions()` — sprawdzana ręcznie w run() komendy,
 * bo CommandHandler blokowałby interakcję zanim ten kod się wykona).
 */
export class ModerationCommandConfig {
  @prop({ type: Boolean, default: true })
  public on!: boolean;

  @prop({ type: () => [String], default: [] })
  public extraRoleIds!: string[];

  @prop({ type: Boolean, default: true })
  public dm!: boolean;

  @prop({ type: Boolean, default: true })
  public log!: boolean;
}

/** Pojedynczy stopień drabinki ostrzeżeń (lub kara w trybie 'single'). */
export class WarnStepConfig {
  @prop({ type: String, default: 'mute' })
  public action!: WarnAction;

  /** Czas wyciszenia w minutach — ma znaczenie tylko gdy action === 'mute'. */
  @prop({ type: Number, default: 15 })
  public durationMinutes!: number;
}

@modelOptions({
  schemaOptions: {
    collection: 'moderationconfigs',
    timestamps: true,
  },
})
export class ModerationConfig {
  @prop({ required: true, unique: true, type: String })
  public guildId!: string;

  /** Wyłącznik główny — gdy false, ŻADNA komenda moderacyjna nie działa, niezależnie od `on` per-komenda. */
  @prop({ type: Boolean, default: true })
  public enabled!: boolean;

  @prop({ type: () => ModerationCommandConfig, default: () => ({}) })
  public warn!: ModerationCommandConfig;

  @prop({ type: () => ModerationCommandConfig, default: () => ({}) })
  public warnRemove!: ModerationCommandConfig;

  @prop({ type: () => ModerationCommandConfig, default: () => ({}) })
  public mute!: ModerationCommandConfig;

  @prop({ type: () => ModerationCommandConfig, default: () => ({}) })
  public kick!: ModerationCommandConfig;

  @prop({ type: () => ModerationCommandConfig, default: () => ({}) })
  public ban!: ModerationCommandConfig;

  @prop({ type: () => ModerationCommandConfig, default: () => ({}) })
  public unban!: ModerationCommandConfig;

  @prop({ type: () => ModerationCommandConfig, default: () => ({}) })
  public clear!: ModerationCommandConfig;

  @prop({ type: String, default: 'ladder' })
  public warnMode!: WarnMode;

  /** Tryb 'single': ta sama kara dla KAŻDEGO ostrzeżenia, bez auto-kick/ban. */
  @prop({ type: () => WarnStepConfig, default: () => ({ action: 'none', durationMinutes: 15 }) })
  public warnSingle!: WarnStepConfig;

  /**
   * Tryb 'ladder': kolejne stopnie eskalacji (1. ostrzeżenie → steps[0], itd.).
   * Domyślna drabinka odzwierciedla dotychczasowe hardcoded wartości z warnService.ts
   * (15min / 3h / 1dzień / ban), żeby włączenie tego modelu nie zmieniło cicho
   * zachowania dla serwerów, które jeszcze nie mają zapisanego configu.
   */
  @prop({
    type: () => [WarnStepConfig],
    default: () => [
      { action: 'mute', durationMinutes: 15 },
      { action: 'mute', durationMinutes: 180 },
      { action: 'mute', durationMinutes: 1440 },
      { action: 'ban', durationMinutes: 0 },
    ],
  })
  public warnSteps!: WarnStepConfig[];

  @prop({ type: Boolean, default: true })
  public warnDm!: boolean;

  @prop({ type: Boolean, default: true })
  public warnExpiryOn!: boolean;

  @prop({ type: Number, default: 90 })
  public warnExpiryDays!: number;
}

export const ModerationConfigModel = getModelForClass(ModerationConfig);
