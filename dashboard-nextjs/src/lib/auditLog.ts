import mongoose from "mongoose";
import AuditLogModel, { IAuditLogChange } from "@/models/AuditLog";

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
  description?: string;
  metadata?: Record<string, any>;
  changes?: IAuditLogChange[];
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await connectDB();
    await AuditLogModel.create({
      ...params,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Buduje listę zmian (from/to) porównując stary i nowy dokument configu pole po polu, wg podanych
 * etykiet. Pomija pola, które się nie zmieniły. Wartości boolean/undefined są czytelnie formatowane
 * ("włączone"/"wyłączone"/"brak"), reszta idzie przez `formatValue` (domyślnie String()).
 *
 * Współdzielone przez wszystkie route'y configu, żeby każdy moduł budował `changes[]` tym samym,
 * spójnym sposobem zamiast duplikować logikę porównywania.
 */
export function diffFields<T extends Record<string, any>>(
  oldDoc: T | null | undefined,
  newDoc: T,
  fields: { field: keyof T & string; label: string; formatValue?: (v: any) => string }[]
): IAuditLogChange[] {
  const changes: IAuditLogChange[] = [];

  for (const { field, label, formatValue } of fields) {
    const oldVal = oldDoc?.[field];
    const newVal = newDoc[field];

    const normalized = (v: any) => (v === undefined || v === null ? null : JSON.stringify(v));
    if (normalized(oldVal) === normalized(newVal)) continue;

    const fmt = formatValue ?? defaultFormatValue;
    changes.push({
      field,
      label,
      ...(oldDoc && oldVal !== undefined ? { from: fmt(oldVal) } : {}),
      to: fmt(newVal),
    });
  }

  return changes;
}

function defaultFormatValue(v: any): string {
  if (v === undefined || v === null || v === "") return "brak";
  if (typeof v === "boolean") return v ? "włączone" : "wyłączone";
  if (Array.isArray(v)) return String(v.length);
  return String(v);
}
