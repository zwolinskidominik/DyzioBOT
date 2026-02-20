import { getModelForClass, prop, type DocumentType } from '@typegoose/typegoose';

export class MusicConfig {
  @prop({ required: true, unique: true, type: () => String })
  guildId!: string;

  @prop({ default: true, type: () => Boolean })
  enabled!: boolean;

  @prop({ default: 50, min: 0, max: 100, type: () => Number })
  defaultVolume!: number;

  @prop({ default: 100, min: 1, type: () => Number })
  maxQueueSize!: number;

  @prop({ default: 0, min: 0, type: () => Number })
  maxSongDuration!: number;

  @prop({ required: false, type: () => String })
  djRoleId?: string;

  @prop({ type: () => [String], default: [] })
  allowedChannels!: string[];

  @prop({ default: true, type: () => Boolean })
  announceSongs!: boolean;

  @prop({ default: true, type: () => Boolean })
  leaveOnEmpty!: boolean;

  @prop({ default: true, type: () => Boolean })
  leaveOnEnd!: boolean;

  @prop({ default: 300, min: 0, type: () => Number })
  leaveTimeout!: number;

  @prop({ default: '!', type: () => String })
  prefix!: string;

  @prop({ default: Date.now, type: () => Date })
  createdAt!: Date;

  @prop({ default: Date.now, type: () => Date })
  updatedAt!: Date;
}

export const MusicConfigModel = getModelForClass(MusicConfig);
export type MusicConfigDocument = DocumentType<MusicConfig>;
