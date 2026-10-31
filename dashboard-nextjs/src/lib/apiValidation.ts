import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiMessages } from "@/i18n/apiServer";

/**
 * Wspólna walidacja treści zapytań API. Każda trasa zapisująca dane parsuje body schematem Zod:
 * nieznane pola są odrzucane (whitelist), typy i długości sprawdzone, zanim cokolwiek trafi do bazy.
 */

/** ID Discorda (snowflake). */
export const snowflake = z.string().regex(/^\d{17,20}$/);

/** ID Discorda albo „brak” (pusty tekst / null), tak jak wysyła je panel przy odznaczeniu. */
export const optionalSnowflake = z.union([snowflake, z.literal(""), z.null()]).optional();

/** Kolor w formacie #RRGGBB. */
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Kolor #RRGGBB albo pusty (kolor domyślny). */
export const optionalHexColor = z.union([hexColor, z.literal(""), z.null()]).optional();

/** Treść wiadomości Discorda (limit Discorda dla treści/opisu embeda to 4000 znaków). */
export const messageText = z.string().max(4000);

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Czyta JSON z żądania i waliduje schematem. Błąd = gotowa odpowiedź 400 z komunikatem w języku panelu. */
export async function parseJsonBody<S extends z.ZodType>(request: Request, schema: S): Promise<ParseResult<z.output<S>>> {
  const raw: unknown = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const { t } = await getApiMessages();
  return {
    ok: false,
    response: NextResponse.json({ error: t.errors.invalidData, details: z.flattenError(parsed.error) }, { status: 400 }),
  };
}
