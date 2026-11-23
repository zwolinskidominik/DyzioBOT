import { timingSafeEqual } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Lista modów GameZone pod „tajnym linkiem” (/gz/<token>) - bez logowania, dla osób z linkiem
 * z Discorda GameZone. Repo jest publiczne, więc ani token, ani sam plik HTML nie leżą w gicie:
 * token jest w GAMEZONE_MODS_TOKEN (.env.local), a plik w assets/private/ (gitignored, bind mount
 * ./assets:/assets jak przy uploadach Powitań). Zły token = zwykłe 404, bez podpowiedzi.
 */
const MODS_FILE = path.join(process.cwd(), "..", "assets", "private", "gamezone-mods.html");

function tokenMatches(given: string, expected: string | undefined): boolean {
  if (!expected || expected.length < 16) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenMatches(token, process.env.GAMEZONE_MODS_TOKEN)) {
    return new Response("Not found", { status: 404 });
  }

  let html: string;
  try {
    html = await readFile(MODS_FILE, "utf8");
  } catch {
    return new Response("Not found", { status: 404 });
  }

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Strona nie trafia do wyszukiwarek, a klik w link do moda nie przekazuje dalej adresu z tokenem.
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, max-age=300",
    },
  });
}
