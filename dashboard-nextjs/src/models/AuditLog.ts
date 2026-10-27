import mongoose from "mongoose";
import type { AuditDescriptionKey, AuditLabelKey, AuditParams, AuditValue } from "@/i18n/messages/auditEntries";

/** Pojedyncza zmiana pola: kod etykiety + surowa stara/nowa wartość (tekst powstaje przy odczycie). */
export interface IAuditLogChange {
  field: string;
  /** Kod etykiety z auditEntryMessages.labels; brak = starszy wpis z gotową polską etykietą. */
  labelKey?: AuditLabelKey | undefined;
  labelParams?: AuditParams | undefined;
  /** Polska etykieta (wyszukiwarka, starsze wpisy). */
  label: string;
  /** Brak `from` = pole nowo utworzone (nie było wcześniej ustawione). */
  from?: AuditValue | undefined;
  to: AuditValue;
}

export interface IAuditLog {
  guildId: string;
  userId: string;
  username: string;
  action: string;
  module: string;
  /** Kod opisu z auditEntryMessages.descriptions; brak = starszy wpis z gotowym polskim zdaniem. */
  descriptionKey?: AuditDescriptionKey | undefined;
  descriptionParams?: AuditParams | undefined;
  /** Polski opis (wyszukiwarka, starsze wpisy). */
  description?: string;
  /** Zapasowa, płaska migawka nowego stanu — zachowana dla wstecznej kompatybilności ze starymi wpisami. */
  metadata?: Record<string, unknown>;
  /** Strukturalne zmiany pól (from/to) — wypełniane od migracji na Logi panelu kontrolnego 2.0. */
  changes?: IAuditLogChange[];
  createdAt: Date;
}

const AuditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    action: { type: String, required: true },
    module: { type: String, required: true },
    descriptionKey: { type: String },
    descriptionParams: { type: Object },
    description: { type: String },
    metadata: { type: Object },
    changes: { type: Array },
    createdAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: false }
);

AuditLogSchema.index({ guildId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

// Wymuś przerejestrowanie modelu przy każdym hot-reloadzie Next.js dev servera — bez tego
// `mongoose.models.AuditLog` zostaje ze STARYM schematem (sprzed dodania `changes`) do restartu procesu.
if (mongoose.models.AuditLog) {
  delete mongoose.models.AuditLog;
}

const AuditLogModel = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLogModel;
