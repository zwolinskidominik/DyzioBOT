import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

/**
 * Szablony wiadomości "dołączenie" per sytuacja. Puste pole = użyj wbudowanej
 * treści domyślnej (patrz `JOIN_SITUATIONS` w inviteTrackerService.ts).
 */
class JoinMessages {
  /** Zaproszony przez znaną osobę. */
  @prop({ type: () => String, default: '' })
  public normal!: string;

  /** Użytkownik zaprosił sam siebie (inviterId === joinedUserId). */
  @prop({ type: () => String, default: '' })
  public selfInvite!: string;

  /** Nie udało się ustalić, kto zaprosił. */
  @prop({ type: () => String, default: '' })
  public unknown!: string;

  /** Dołączył przez niestandardowy (vanity) link serwera. */
  @prop({ type: () => String, default: '' })
  public vanity!: string;

  /** Dodano bota na serwer. */
  @prop({ type: () => String, default: '' })
  public botAdd!: string;
}

/** Szablony wiadomości "opuszczenie" per sytuacja. */
class LeaveMessages {
  @prop({ type: () => String, default: '' })
  public normal!: string;

  @prop({ type: () => String, default: '' })
  public unknown!: string;

  @prop({ type: () => String, default: '' })
  public vanity!: string;

  /** Usunięto bota z serwera. */
  @prop({ type: () => String, default: '' })
  public botRemove!: string;
}

class JoinSection {
  @prop({ type: () => Boolean, default: true })
  public enabled!: boolean;

  @prop({ type: () => String, default: null })
  public logChannelId?: string | null;

  /** Gdy true, wiadomości tej sekcji wysyłane są jako embed (kolor/tytuł zależny od sytuacji). */
  @prop({ type: () => Boolean, default: false })
  public embed!: boolean;

  /** Niestandardowy kolor embeda (hex, np. "#3B82F6"). Puste = użyj domyślnego koloru sytuacji. */
  @prop({ type: () => String, default: '' })
  public embedColor?: string;

  @prop({ type: () => JoinMessages, default: () => ({}), _id: false })
  public messages!: JoinMessages;
}

class LeaveSection {
  @prop({ type: () => Boolean, default: true })
  public enabled!: boolean;

  @prop({ type: () => String, default: null })
  public logChannelId?: string | null;

  @prop({ type: () => Boolean, default: false })
  public embed!: boolean;

  /** Niestandardowy kolor embeda (hex, np. "#3B82F6"). Puste = użyj domyślnego koloru sytuacji. */
  @prop({ type: () => String, default: '' })
  public embedColor?: string;

  @prop({ type: () => LeaveMessages, default: () => ({}), _id: false })
  public messages!: LeaveMessages;
}

@index({ guildId: 1 }, { unique: true })
class InviteTrackerConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  /** Globalny wyłącznik modułu — gdy false, bot nic nie wysyła niezależnie od sekcji. */
  @prop({ type: () => Boolean, default: false })
  public enabled!: boolean;

  @prop({ type: () => JoinSection, default: () => ({}), _id: false })
  public join!: JoinSection;

  @prop({ type: () => LeaveSection, default: () => ({}), _id: false })
  public leave!: LeaveSection;
}

export const InviteTrackerConfigModel = getModelForClass(InviteTrackerConfig);
export type InviteTrackerConfigDocument = DocumentType<InviteTrackerConfig>;
