import { describe, it, expect } from "vitest";
import { langFromAcceptLanguage, resolveLang, isLang } from "@/i18n/config";
import { antiSpamMessages } from "@/i18n/messages/antiSpam";
import { auditLogsMessages } from "@/i18n/messages/auditLogs";
import { autorolesMessages } from "@/i18n/messages/autoroles";
import { botEmojisMessages } from "@/i18n/messages/botEmojis";
import { channelStatsMessages } from "@/i18n/messages/channelStats";
import { commandsMessages } from "@/i18n/messages/commands";
import { commonMessages } from "@/i18n/messages/common";
import { disboardMessages } from "@/i18n/messages/disboard";
import { giveawayMessages } from "@/i18n/messages/giveaway";
import { greetingsMessages } from "@/i18n/messages/greetings";
import { guildsMessages } from "@/i18n/messages/guilds";
import { hangmanMessages } from "@/i18n/messages/hangman";
import { homeMessages } from "@/i18n/messages/home";
import { landingMessages } from "@/i18n/messages/landing";
import { monthlyStatsMessages } from "@/i18n/messages/monthlyStats";
import { reactionRolesMessages } from "@/i18n/messages/reactionRoles";
import { settingsMessages } from "@/i18n/messages/settings";
import { suggestionsMessages } from "@/i18n/messages/suggestions";
import { tempChannelsMessages } from "@/i18n/messages/tempChannels";
import { ticketsMessages } from "@/i18n/messages/tickets";
import { wordleMessages } from "@/i18n/messages/wordle";

const DICTIONARIES = {
  antiSpamMessages,
  auditLogsMessages,
  autorolesMessages,
  botEmojisMessages,
  channelStatsMessages,
  commandsMessages,
  commonMessages,
  disboardMessages,
  giveawayMessages,
  greetingsMessages,
  guildsMessages,
  hangmanMessages,
  homeMessages,
  landingMessages,
  monthlyStatsMessages,
  reactionRolesMessages,
  settingsMessages,
  suggestionsMessages,
  tempChannelsMessages,
  ticketsMessages,
  wordleMessages,
};

/** Spłaszczone klucze słownika z typem wartości ("string", "function" albo "array"). */
function shape(value: unknown, prefix = ""): string[] {
  if (typeof value === "string" || typeof value === "function") return [`${prefix}:${typeof value}`];
  // Listy (np. gotowe szablony) mogą mieć w każdym języku inną długość.
  if (Array.isArray(value)) return [`${prefix}:array`];
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
