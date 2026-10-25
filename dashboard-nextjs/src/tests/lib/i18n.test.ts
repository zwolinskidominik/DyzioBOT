import { describe, it, expect } from "vitest";
import { langFromAcceptLanguage, resolveLang, isLang } from "@/i18n/config";
import { commonMessages } from "@/i18n/messages/common";
import { landingMessages } from "@/i18n/messages/landing";
import { guildsMessages } from "@/i18n/messages/guilds";

const DICTIONARIES = { commonMessages, landingMessages, guildsMessages };

/** Spłaszczone klucze słownika z typem wartości ("string" albo "function"). */
function shape(value: unknown, prefix = ""): string[] {
  if (typeof value === "string" || typeof value === "function") return [`${prefix}:${typeof value}`];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => shape(child, prefix ? `${prefix}.${key}` : key)).sort();
  }
  return [`${prefix}:${typeof value}`];
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [String(value)];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("language detection", () => {
  it("uses Polish for Polish browsers and English for everyone else", () => {
    expect(langFromAcceptLanguage("pl-PL,pl;q=0.9,en;q=0.8")).toBe("pl");
    expect(langFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(langFromAcceptLanguage("de-DE")).toBe("en");
    expect(langFromAcceptLanguage(undefined)).toBe("pl");
  });

  it("prefers the language chosen in the switcher (cookie) over the browser", () => {
    expect(resolveLang("en", "pl-PL")).toBe("en");
    expect(resolveLang("pl", "en-US")).toBe("pl");
    expect(resolveLang("xx", "en-US")).toBe("en");
    expect(isLang("de")).toBe(false);
  });
});

describe.each(Object.entries(DICTIONARIES))("%s", (_name, messages) => {
  it("has the same keys in English as in Polish", () => {
    expect(shape(messages.en)).toEqual(shape(messages.pl));
  });

  it("uses plain dashes, never typographic ones", () => {
    for (const text of [...strings(messages.pl), ...strings(messages.en)]) {
      expect(text).not.toMatch(/[—–]/);
    }
  });
});
