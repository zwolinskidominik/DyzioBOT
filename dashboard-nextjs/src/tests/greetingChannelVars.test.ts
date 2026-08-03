import { describe, expect, it } from "vitest";
import { getMissingChannelVariables, getUsedChannelVariables } from "@/lib/greetingChannelVars";

describe("getUsedChannelVariables", () => {
  it("detects each channel variable in the text", () => {
    expect(getUsedChannelVariables(["Zobacz {rulesChannel} i {chatChannel}"])).toEqual([
      "rulesChannel",
      "chatChannel",
    ]);
  });

  it("returns an empty array when no channel variables are present", () => {
    expect(getUsedChannelVariables(["Witaj {user} na {server}"])).toEqual([]);
  });

  it("scans across multiple texts and ignores nullish entries", () => {
    expect(getUsedChannelVariables([null, "{rolesChannel}", undefined, "{user}"])).toEqual([
      "rolesChannel",
    ]);
  });
});

describe("getMissingChannelVariables", () => {
  it("returns variables whose channel field is empty", () => {
    const missing = getMissingChannelVariables(["{rulesChannel} {rolesChannel} {chatChannel}"], {
      rulesChannelId: "123",
      rolesChannelId: "",
      chatChannelId: undefined,
    });
    expect(missing).toEqual(["rolesChannel", "chatChannel"]);
  });

  it("returns nothing when every used variable has a configured channel", () => {
    const missing = getMissingChannelVariables(["{rulesChannel}"], {
      rulesChannelId: "123",
    });
    expect(missing).toEqual([]);
  });

  it("ignores channels that are not referenced in the text", () => {
    const missing = getMissingChannelVariables(["Witaj {user}"], {
      rulesChannelId: "",
      rolesChannelId: "",
      chatChannelId: "",
    });
    expect(missing).toEqual([]);
  });
});
