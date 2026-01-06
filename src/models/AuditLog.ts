import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1, createdAt: -1 })
@index({ userId: 1, createdAt: -1 })
class AuditLog {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ required: true, type: () => String })
  public username!: string;

  @prop({ required: true, type: () => String })
  public action!: string;

  @prop({ required: true, type: () => String })
  public module!: string;

  @prop({ type: () => String })
  public description?: string;

  @prop({ type: () => Object })
  public metadata?: Record<string, any>;

  @prop({ required: true, default: () => new Date() })
  public createdAt!: Date;
}

export const AuditLogModel = getModelForClass(AuditLog);
export type AuditLogDocument = DocumentType<AuditLog>;
