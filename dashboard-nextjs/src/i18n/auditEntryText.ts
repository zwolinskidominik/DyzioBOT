import type { Lang } from "./config";
import { auditEntryMessages, type AuditValue } from "./messages/auditEntries";
import { auditLogsMessages } from "./messages/auditLogs";
import { translateLegacyText } from "./legacyApiText";
import type { IAuditLogChange } from "@/models/AuditLog";

/** Minimalny kształt wpisu potrzebny do zbudowania tekstów (pasuje do dokumentu AuditLog z .lean()). */
interface AuditEntryLike {
  descriptionKey?: string | undefined;
  descriptionParams?: Record<string, string | number | boolean> | undefined;
  description?: string | undefined;
  changes?: IAuditLogChange[] | undefined;
}

export interface RenderedAuditChange {
  field: string;
  label: string;
  from?: string;
  to: string;
}

function isDescriptionKey(key: string): key is keyof (typeof auditEntryMessages)["pl"]["descriptions"] {
  return Object.prototype.hasOwnProperty.call(auditEntryMessages.pl.descriptions, key);
}

function isLabelKey(key: string): key is keyof (typeof auditEntryMessages)["pl"]["labels"] {
  return Object.prototype.hasOwnProperty.call(auditEntryMessages.pl.labels, key);
}

function isValueToken(key: string): key is keyof (typeof auditEntryMessages)["pl"]["values"] {
  return Object.prototype.hasOwnProperty.call(auditEntryMessages.pl.values, key);
}

/** Wartość zmiany jako tekst w języku panelu. Starsze wpisy mają gotowy polski tekst - tłumaczymy go słownikiem legacy. */
export function formatAuditValue(value: AuditValue | undefined, lang: Lang, legacy: boolean): string {
  const t = lang === "en" ? auditLogsMessages.en : auditLogsMessages.pl;
  const values = lang === "en" ? auditEntryMessages.en.values : auditEntryMessages.pl.values;
  if (value === undefined || value === null || value === "") return t.valueNone;
  if (typeof value === "boolean") return value ? t.valueOn : t.valueOff;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return isValueToken(value.token) ? values[value.token] : String(value.token);
  return legacy ? translateLegacyText(value, lang) : value;
}

/** Opis i zmiany wpisu logu panelu w języku panelu (z kodów, a dla starszych wpisów z zapisanego polskiego tekstu). */
export function renderAuditEntry(entry: AuditEntryLike, lang: Lang): { description: string; changes: RenderedAuditChange[] } {
  const m = lang === "en" ? auditEntryMessages.en : auditEntryMessages.pl;
  const description =
    entry.descriptionKey && isDescriptionKey(entry.descriptionKey)
      ? m.descriptions[entry.descriptionKey](entry.descriptionParams ?? {})
      : translateLegacyText(entry.description, lang);

  const changes = (entry.changes ?? []).map((change): RenderedAuditChange => {
    const legacy = !change.labelKey;
    const label =
      change.labelKey && isLabelKey(change.labelKey)
        ? m.labels[change.labelKey](change.labelParams ?? {})
        : translateLegacyText(change.label, lang);
    return {
      field: change.field,
      label,
      ...(change.from !== undefined ? { from: formatAuditValue(change.from, lang, legacy) } : {}),
      to: formatAuditValue(change.to, lang, legacy),
    };
  });

  return { description, changes };
}
