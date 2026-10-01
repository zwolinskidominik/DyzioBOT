import { getModelForClass, modelOptions, prop, DocumentType } from '@typegoose/typegoose';

/**
 * Serwery, z których bot został usunięty, wraz z datą odejścia.
 *
 * Po upływie okresu retencji (GUILD_DATA_RETENTION_DAYS w guildDataRetentionService) wszystkie
 * dane serwera są kasowane. Jeśli bot wróci na serwer wcześniej, wpis jest usuwany i nic nie ginie.
 * Ten okres jest opisany w polityce prywatności — zmiana tutaj wymaga też zmiany tam.
 */
@modelOptions({ schemaOptions: { timestamps: true, collection: 'guilddepartures' } })
class GuildDeparture {
  @prop({ required: true, unique: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => Date })
  public leftAt!: Date;
}

export const GuildDepartureModel = getModelForClass(GuildDeparture);
export type GuildDepartureDocument = DocumentType<GuildDeparture>;
