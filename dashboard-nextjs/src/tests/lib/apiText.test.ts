import { describe, it, expect } from "vitest";
import { translateLegacyText } from "@/i18n/legacyApiText";
import { formatAuditValue, renderAuditEntry } from "@/i18n/auditEntryText";

describe("translateLegacyText (older Polish audit entries and bot-written extras)", () => {
  it("leaves Polish text untouched for the Polish dashboard", () => {
    expect(translateLegacyText("Zaktualizowano profil bota na tym serwerze", "pl")).toBe("Zaktualizowano profil bota na tym serwerze");
  });

  it("translates stored audit log descriptions, labels and values", () => {
    expect(translateLegacyText("Zaktualizowano profil bota na tym serwerze", "en")).toBe("Updated the bot profile on this server");
    expect(translateLegacyText("Zaktualizowano konfigurację logów (2 zmian)", "en")).toBe("Updated the log settings (2 changes)");
    expect(translateLegacyText("Aktualizacja serwera: kanał", "en")).toBe("Server updated: channel");
    expect(translateLegacyText("Banner bota", "en")).toBe("Bot banner");
    expect(translateLegacyText("zmieniono", "en")).toBe("changed");
  });

  it("translates punishment extras written by the bot", () => {
    expect(translateLegacyText("15 minut", "en")).toBe("15 min");
    expect(translateLegacyText("3 godziny", "en")).toBe("3 hours");
  });

  it("keeps unknown text such as channel names as is", () => {
    expect(translateLegacyText("#ogólny", "en")).toBe("#ogólny");
    expect(translateLegacyText(undefined, "en")).toBe("");
  });
});

describe("renderAuditEntry", () => {
  const entry = {
    descriptionKey: "logsUpdated",
    descriptionParams: { count: 2 },
    description: "Zaktualizowano konfigurację logów (2 zmiany)",
    changes: [
      { field: "enabledEvents.guildUpdate", labelKey: "logEventLogging" as const, labelParams: { event: "guildUpdate" }, label: "Aktualizacja serwera: logowanie", from: false, to: true },
      { field: "colorOverrides.guildUpdate", labelKey: "logEventColor" as const, labelParams: { event: "guildUpdate" }, label: "Aktualizacja serwera: kolor", from: { token: "default" as const }, to: "#ff0000" },
    ],
  };

  it("builds English text from stored keys", () => {
    const r = renderAuditEntry(entry, "en");
    expect(r.description).toBe("Updated the log settings (2 changes)");
    expect(r.changes[0]).toEqual({ field: "enabledEvents.guildUpdate", label: "Server updated: logging", from: "off", to: "on" });
    expect(r.changes[1]).toMatchObject({ label: "Server updated: color", from: "default", to: "#ff0000" });
  });

  it("builds Polish text from stored keys", () => {
    const r = renderAuditEntry(entry, "pl");
    expect(r.description).toBe("Zaktualizowano konfigurację logów (2 zmiany)");
    expect(r.changes[0]).toMatchObject({ label: "Aktualizacja serwera: logowanie", from: "wyłączone", to: "włączone" });
  });

  it("falls back to the stored Polish text for older entries", () => {
    const r = renderAuditEntry({ description: "Zaktualizowano konfigurację turnieju", changes: [{ field: "enabled", label: "Włączony", from: "wyłączone", to: "włączone" }] }, "en");
    expect(r.description).toBe("Updated the tournament settings");
    expect(r.changes[0]).toMatchObject({ label: "Enabled", from: "off", to: "on" });
  });

  it("does not translate raw user values in new entries", () => {
    expect(formatAuditValue("brak", "en", false)).toBe("brak");
    expect(formatAuditValue(null, "en", false)).toBe("none");
  });
});
