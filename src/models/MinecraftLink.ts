import { index, prop, getModelForClass, DocumentType, modelOptions } from '@typegoose/typegoose';

/**
 * Powiązanie osoby z Discorda z jej nickiem w Minecrafcie (whitelista serwera GameZone).
 * Dopisuje i usuwa administrator; bot wyrównuje whitelistę na serwerze przez RCON, gdy serwer działa.
 *
 * status:
 * - `pending`        - czeka na włączenie serwera (jeszcze nie dopisany),
 * - `added`          - dopisany na whitelistę,
 * - `no_such_player` - Minecraft nie zna takiego nicka; bot nie ponawia, admin musi poprawić nick,
 * - `removing`       - admin usunął osobę; po usunięciu z whitelisty wpis znika z bazy.
 */
export const MINECRAFT_LINK_STATUSES = ['pending', 'added', 'no_such_player', 'removing'] as const;
export type MinecraftLinkStatus = (typeof MINECRAFT_LINK_STATUSES)[number];

@index({ guildId: 1, userId: 1 }, { unique: true })
@index({ guildId: 1, nickLower: 1 }, { unique: true })
@modelOptions({ schemaOptions: { timestamps: true, collection: 'minecraft_links' } })
class MinecraftLink {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ required: true, type: () => String })
  public nick!: string;

  /** Do unikalności nicka bez rozróżniania wielkości liter (Minecraft tak je traktuje). */
  @prop({ required: true, type: () => String })
  public nickLower!: string;

  @prop({ required: true, type: () => String, enum: MINECRAFT_LINK_STATUSES, default: 'pending' })
  public status!: MinecraftLinkStatus;

  /** Stary nick po zmianie - bot usunie go z whitelisty przy najbliższej okazji. */
  @prop({ type: () => String })
  public previousNick?: string | undefined;

  @prop({ required: true, type: () => String })
  public addedBy!: string;

  public createdAt?: Date;
  public updatedAt?: Date;
}

export const MinecraftLinkModel = getModelForClass(MinecraftLink);
export type MinecraftLinkDocument = DocumentType<MinecraftLink>;
