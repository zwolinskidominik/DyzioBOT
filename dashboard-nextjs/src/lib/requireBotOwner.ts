import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { OWNER_IDS } from "./owner";

/**
 * Dostęp tylko dla właściciela bota (OWNER_IDS). Dla tras zmieniających dane WSPÓLNE dla całego bota
 * (globalne pule słów Wisielca/Wordle, pula Pytań Dnia) - samo `requireGuildAccess` tu nie wystarcza,
 * bo każdy administrator dowolnego serwera mógłby zmienić dane, które widzą wszystkie serwery.
 *
 * Użycie: const ownerError = requireBotOwner(session); if (ownerError) return ownerError;
 */
export function requireBotOwner(session: Session | null | undefined): NextResponse | null {
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OWNER_IDS.includes(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
