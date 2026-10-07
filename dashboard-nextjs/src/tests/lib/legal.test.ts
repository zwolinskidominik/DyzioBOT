import { describe, it, expect } from "vitest";
import { LEGAL, LEGAL_HAS_PLACEHOLDERS, resolveLegalLang } from "@/lib/legal";

describe("resolveLegalLang", () => {
  it("uses English only for ?lang=en", () => {
    expect(resolveLegalLang("en")).toBe("en");
  });

  it("falls back to Polish — the binding version — for anything else", () => {
    expect(resolveLegalLang(undefined)).toBe("pl");
    expect(resolveLegalLang("pl")).toBe("pl");
    expect(resolveLegalLang("de")).toBe("pl");
    // ?lang=en&lang=en daje tablicę — nie zgadujemy, wracamy do wersji wiążącej.
    expect(resolveLegalLang(["en", "en"])).toBe("pl");
  });
});

describe("LEGAL", () => {
  it("flags the documents as drafts while required operator details are placeholders", () => {
    const required = [LEGAL.city, LEGAL.postalAddress, LEGAL.supportServerUrl];
    expect(LEGAL_HAS_PLACEHOLDERS).toBe(required.some((value) => value.startsWith("[")));
  });

  it("states the retention periods implemented in the bot", () => {
    // Wartości muszą się zgadzać z kodem bota (src/services/guildDataRetentionService.ts,
    // TTL w src/models/ActivityBucket.ts i StreamNotificationLog.ts). Zmiana w bocie bez
    // zmiany tutaj oznacza, że polityka prywatności mija się z prawdą.
    expect(LEGAL.guildDataRetentionDays).toBe(30);
    expect(LEGAL.activityBucketDays).toBe(32);
    expect(LEGAL.streamLogDays).toBe(60);
    // Kopie zapasowe: KEEP_DAYS w ops/mongo/backup.sh i KeepDays w ops/mongo/pull-backup.ps1.
    expect(LEGAL.backupServerDays).toBe(7);
    expect(LEGAL.backupOffsiteDays).toBe(30);
  });
});
