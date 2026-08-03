import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

export type SuggestionVotingFormat = 'counts' | 'percent' | 'bar';

@index({ guildId: 1 }, { unique: true })
class SuggestionConfiguration {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: false })
  public enabled!: boolean;

  @prop({ required: true, type: () => String })
  public suggestionChannelId!: string;

  /** Sposób prezentacji wyników głosowania w embedzie: liczniki / procenty / pasek. */
  @prop({ type: () => String, default: 'bar' })
  public votingFormat!: SuggestionVotingFormat;

  /** Czy ukrywać tożsamość autora sugestii w embedzie. */
  @prop({ type: () => Boolean, default: false })
  public anonymous!: boolean;

  /** Kolor embeda sugestii (hex, np. #4C4C54). */
  @prop({ type: () => String, default: '#4C4C54' })
  public embedColor!: string;
}

export const SuggestionConfigurationModel = getModelForClass(SuggestionConfiguration);
export type SuggestionConfigurationDocument = DocumentType<SuggestionConfiguration>;
