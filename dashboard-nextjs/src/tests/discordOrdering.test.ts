import { describe, expect, it } from "vitest";
import { toSortedDiscordChannels, toSortedDiscordRoles } from "@/lib/discordOrdering";

describe("discordOrdering", () => {
  it("orders channels by category position and then channel position", () => {
    const channels = toSortedDiscordChannels([
      { id: "minecraft", name: "Minecraft", type: 0, position: 2, parent_id: "games" },
      { id: "general", name: "Czat-ogolny", type: 0, position: 1, parent_id: "info" },
      { id: "games", name: "Gry", type: 4, position: 20 },
      { id: "info", name: "Informacje", type: 4, position: 10 },
      { id: "rules", name: "Regulamin", type: 0, position: 0, parent_id: "info" },
      { id: "loose", name: "Bez kategorii", type: 0, position: 30 },
    ]);

    expect(channels.filter((channel) => channel.type !== 4).map((channel) => channel.id)).toEqual([
      "rules",
      "general",
      "minecraft",
      "loose",
    ]);
  });

  it("orders roles from highest Discord position to lowest", () => {
    const roles = toSortedDiscordRoles([
      { id: "muted", name: "Muted", position: 1 },
      { id: "admin", name: "Admin", position: 10 },
      { id: "member", name: "Member", position: 3 },
    ]);

    expect(roles.map((role) => role.id)).toEqual(["admin", "member", "muted"]);
  });
});