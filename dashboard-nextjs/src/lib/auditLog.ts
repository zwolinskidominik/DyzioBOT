import mongoose from "mongoose";
import AuditLogModel, { IAuditLogChange } from "@/models/AuditLog";
import {
  auditEntryMessages,
  type AuditDescriptionKey,
  type AuditLabelKey,
  type AuditParams,
  type AuditValue,
} from "@/i18n/messages/auditEntries";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

interface CreateAuditLogParams {
  guildId: string;
  userId: string;
  username: string;
  action: string;
  module: string;
  /** Kod opisu z `auditEntryMessages.descriptions`; tekst powstaje przy odczycie w języku panelu. */
  descriptionKey: AuditDescriptionKey;
  descriptionParams?: AuditParams | undefined;
  metadata?: Record<string, unknown> | undefined;
  changes?: IAuditLogChange[] | undefined;
}

/**
 * Zapisuje wpis logu panelu z kodem akcji (descriptionKey + parametry) zamiast gotowego zdania.
 * Polski `description` zapisujemy dodatkowo tylko dla wyszukiwarki i starszych narzędzi.
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await connectDB();
    const descriptionParams = params.descriptionParams ?? {};
    await AuditLogModel.create({
      guildId: params.guildId,
      userId: params.userId,
      username: params.username,
      action: params.action,
      module: params.module,
      descriptionKey: params.descriptionKey,
      descriptionParams,
      description: auditEntryMessages.pl.descriptions[params.descriptionKey](descriptionParams),
      ...(params.metadata ? { metadata: params.metadata } : {}),
      ...(params.changes ? { changes: params.changes } : {}),
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

/** Jedna zmiana pola z kodem etykiety; `label` (PL) jest dopisywany automatycznie. */
export function auditChange(
  field: string,
  labelKey: AuditLabelKey,
  to: AuditValue,
  from?: AuditValue | undefined,
  labelParams?: AuditParams | undefined
): IAuditLogChange {
  const params = labelParams ?? {};
  return {
    field,
    labelKey,
    ...(labelParams ? { labelParams } : {}),
    label: auditEntryMessages.pl.labels[labelKey](params),
    ...(from !== undefined ? { from } : {}),
    to,
  };
}

/**
 * Buduje listę zmian (from/to) porównując stary i nowy dokument configu pole po polu. Pomija pola,
 * które się nie zmieniły. Wartości zapisujemy surowe (boolean/null/liczba/tekst, tablice jako liczba
 * elementów), a formatuje je dopiero odczyt w języku panelu. `formatValue` może zwrócić token
 * (`{ token: "default" }`) albo inną surową wartość.
 */
export function diffFields<T extends object>(
  oldDoc: T | null | undefined,
  newDoc: T,
  fields: { field: keyof T & string; labelKey: AuditLabelKey; formatValue?: ((v: unknown) => AuditValue) | undefined }[]
): IAuditLogChange[] {
  const changes: IAuditLogChange[] = [];
  const read = (doc: object | null | undefined, key: string): unknown => (doc ? Reflect.get(doc, key) : undefined);

  for (const { field, labelKey, formatValue } of fields) {
    const oldVal: unknown = read(oldDoc, field);
    const newVal: unknown = read(newDoc, field);

    const normalized = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));
    if (normalized(oldVal) === normalized(newVal)) continue;

    const fmt = formatValue ?? rawAuditValue;
    changes.push(auditChange(field, labelKey, fmt(newVal), oldDoc && oldVal !== undefined ? fmt(oldVal) : undefined));
  }

  return changes;
}

/** Surowa wartość do zapisu w zmianie: puste → null, tablica → liczba elementów, obiekt → „zmieniono”. */
export function rawAuditValue(v: unknown): AuditValue {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") return v;
  if (Array.isArray(v)) return v.length;
  return { token: "changed" };
}
