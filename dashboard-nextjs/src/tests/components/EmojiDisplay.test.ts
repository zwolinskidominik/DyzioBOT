import { describe, it, expect } from "vitest";
import {
  hasCustomEmoji,
  getCustomEmojiId,
  hasExternalEmoji,
} from "@/components/EmojiDisplay";

// ---------------------------------------------------------------------------
// getCustomEmojiId
// ---------------------------------------------------------------------------
describe("getCustomEmojiId", () => {
  it("extracts ID from static emoji <:name:id>", () => {
    expect(getCustomEmojiId("<:pepega:123456789>")).toBe("123456789");
  });

  it("extracts ID from animated emoji <a:name:id>", () => {
    expect(getCustomEmojiId("<a:wave:987654321>")).toBe("987654321");
  });

  it("returns null for unicode emoji", () => {
    expect(getCustomEmojiId("👍")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getCustomEmojiId("")).toBeNull();
  });

  it("returns null for partial emoji syntax", () => {
    expect(getCustomEmojiId("<:name>")).toBeNull();
    expect(getCustomEmojiId(":name:123>")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasCustomEmoji
// ---------------------------------------------------------------------------
describe("hasCustomEmoji", () => {
  it("returns true when at least one reaction is a custom emoji", () => {
    expect(hasCustomEmoji(["👍", "<:pepega:123>"])).toBe(true);
  });

  it("returns true for animated emoji", () => {
    expect(hasCustomEmoji(["<a:fire:999>"])).toBe(true);
  });

  it("returns false when all reactions are unicode", () => {
    expect(hasCustomEmoji(["👍", "👎", "🤔"])).toBe(false);
  });

  it("returns false for empty reactions array", () => {
    expect(hasCustomEmoji([])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasExternalEmoji
// ---------------------------------------------------------------------------
describe("hasExternalEmoji", () => {
  const botIds = new Set(["111", "222", "333"]);

  it("returns false when botEmojiIds is null (not loaded yet)", () => {
    expect(hasExternalEmoji(["<:pepega:999>"], null)).toBe(false);
  });

  it("returns true when botEmojiIds is empty Set (API failed) and there are custom emojis", () => {
    expect(hasExternalEmoji(["<:pepega:999>"], new Set())).toBe(true);
  });

  it("returns false when botEmojiIds is empty Set and reactions are unicode only", () => {
    expect(hasExternalEmoji(["👍", "👎"], new Set())).toBe(false);
  });

  it("returns false when all custom emojis are from bot guilds", () => {
    expect(hasExternalEmoji(["<:a:111>", "<:b:222>"], botIds)).toBe(false);
  });

  it("returns true when a reaction emoji ID is NOT in botEmojiIds", () => {
    expect(hasExternalEmoji(["<:external:999>"], botIds)).toBe(true);
  });

  it("returns true when mixed: some bot, some external", () => {
    expect(hasExternalEmoji(["<:bot:111>", "<:external:999>"], botIds)).toBe(true);
  });

  it("returns false for unicode-only reactions (no custom emoji IDs)", () => {
    expect(hasExternalEmoji(["👍", "👎"], botIds)).toBe(false);
  });

  it("returns false for empty reactions array", () => {
    expect(hasExternalEmoji([], botIds)).toBe(false);
  });
});
