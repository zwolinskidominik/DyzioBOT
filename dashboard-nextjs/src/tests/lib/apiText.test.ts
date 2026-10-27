import { describe, it, expect } from "vitest";
import { translateApiText, translateDayLabel } from "@/i18n/apiText";

describe("translateApiText", () => {
  it("leaves Polish text untouched for the Polish dashboard", () => {
    expect(translateApiText("Zaktualizowano profil bota na tym serwerze", "pl")).toBe("Zaktualizowano profil bota na tym serwerze");
  });

  it("translates stored audit log descriptions, labels and values", () => {
    expect(translateApiText("Zaktualizowano profil bota na tym serwerze", "en")).toBe("Updated the bot profile on this server");
    expect(translateApiText("Zaktualizowano konfigurację logów (2 zmian)", "en")).toBe("Updated the log settings (2 changes)");
    expect(translateApiText("Aktualizacja serwera: kanał", "en")).toBe("Server updated: channel");
    expect(translateApiText("Banner bota", "en")).toBe("Bot banner");
    expect(translateApiText("zmieniono", "en")).toBe("changed");
  });

  it("translates module issues, emoji groups and punishment extras", () => {
    expect(translateApiText("Brak wybranego kanału powitań", "en")).toBe("No welcome channel picked");
    expect(translateApiText("Pasek postępu sugestii", "en")).toBe("Suggestion progress bar");
    expect(translateApiText("15 minut", "en")).toBe("15 min");
    expect(translateApiText("3 godziny", "en")).toBe("3 hours");
  });

  it("keeps unknown text such as channel names as is", () => {
    expect(translateApiText("#ogólny", "en")).toBe("#ogólny");
    expect(translateApiText(undefined, "en")).toBe("");
  });

  it("formats DD.MM day labels for English", () => {
    expect(translateDayLabel("27.09", "en")).toBe("Sep 27");
    expect(translateDayLabel("27.09", "pl")).toBe("27.09");
  });
});
