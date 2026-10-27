import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

/**
 * Strażnik: API panelu nie może zwracać gołych polskich tekstów. Komunikaty idą przez
 * `getApiMessages()` (src/i18n/messages/api.ts), a logi panelu zapisują kody (auditEntries.ts).
 * Polski tekst w API/lib jest dozwolony tylko jako treść wysyłana przez bota na Discorda
 * (domyślne szablony, panel ticketów, embed ról) albo dane, które nie trafiają do panelu.
 * Nowy wyjątek: dopisz plik/literał poniżej albo dodaj na końcu linii komentarz `i18n-ignore`.
 */

const SRC = path.resolve(__dirname, "../..");
const SCANNED_DIRS = ["app/api", "lib"];

/** Całe pliki z treścią bota albo danymi spoza panelu. */
const ALLOWED_FILES = new Set([
  "app/api/cs2/image/route.ts", // prywatna strona właściciela
  "app/api/cs2/investments/route.ts",
  "app/api/cs2/price/route.ts",
  "app/api/guild/[guildId]/disboard/config/route.ts", // domyślna wiadomość bota
  "app/api/guild/[guildId]/stream-config/route.ts", // domyślny szablon powiadomienia
  "app/api/guild/[guildId]/reaction-roles/route.ts", // embed panelu ról wysyłany przez bota
  "app/api/guild/[guildId]/tickets/config/route.ts", // domyślny panel ticketów
  "lib/greetingChannelVars.ts",
  "lib/legal.ts", // dane administratora
  "lib/monthlyStats.ts", // grafika rankingu bota
  "lib/ticketPanelBanner.ts", // banner panelu ticketów + logi serwera
  "lib/twitchApi.ts", // błąd konfiguracji serwera (logi)
]);

/** Pojedyncze literały z treścią bota w plikach, które poza tym muszą być czyste. */
const ALLOWED_LITERALS = new Set([
  "'{user} jesteś kozakiem! Wbiłeś/aś: **{level}** level. 👏'",
  "'{user}! Zdobyto nową rolę na serwerze: {roleId}! Dziękujemy za aktywność!'",
  '"Otwórz zgłoszenie"',
  '"Kontakt z Administracją"',
  '"Aby skontaktować się z wybranym działem administracji, wybierz odpowiednią kategorię poniżej:"',
  '"Wybierz odpowiednią kategorię"',
]);

const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

function polishLiterals(file: string): string[] {
  const found: string[] = [];
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("//")) return;
      if (line.includes("i18n-ignore")) return;
      const code = line.replace(/\s\/\/\s.*$/, "");
      for (const match of code.match(STRING_LITERAL) ?? []) {
        if (POLISH.test(match) && !ALLOWED_LITERALS.has(match)) found.push(`${i + 1}: ${match.slice(0, 80)}`);
      }
    });
  return found;
}

describe("API texts are localized on the server", () => {
  const files = SCANNED_DIRS.flatMap((dir) => walk(path.join(SRC, dir)));

  it("scans the API and lib folders", () => {
    expect(files.length > 20).toBeTruthy();
  });

  it("has no hardcoded Polish strings outside bot content", () => {
    const offenders = files
      .map((file) => path.relative(SRC, file).split(path.sep).join("/"))
      .filter((rel) => !ALLOWED_FILES.has(rel))
      .flatMap((rel) => polishLiterals(path.join(SRC, rel)).map((hit) => `${rel}:${hit}`));
    expect(offenders).toEqual([]);
  });
});
