/**
 * Detects which channel-bound greeting variables ({rulesChannel}, {rolesChannel},
 * {chatChannel}) are used in message text, so the UI can require their channels.
 * Pure + unit-testable.
 */

export type ChannelVariableKey = "rulesChannel" | "rolesChannel" | "chatChannel";

export type ChannelFieldId = "rulesChannelId" | "rolesChannelId" | "chatChannelId";

export const CHANNEL_VARIABLE_TOKEN: Record<ChannelVariableKey, string> = {
  rulesChannel: "{rulesChannel}",
  rolesChannel: "{rolesChannel}",
  chatChannel: "{chatChannel}",
};

export const CHANNEL_VARIABLE_FIELD: Record<ChannelVariableKey, ChannelFieldId> = {
  rulesChannel: "rulesChannelId",
  rolesChannel: "rolesChannelId",
  chatChannel: "chatChannelId",
};

export const CHANNEL_VARIABLE_LABEL: Record<ChannelVariableKey, string> = {
  rulesChannel: "Kanał regulaminu",
  rolesChannel: "Kanał ról",
  chatChannel: "Kanał czatu",
};

const CHANNEL_VARIABLE_KEYS = Object.keys(CHANNEL_VARIABLE_TOKEN) as ChannelVariableKey[];

/** Returns the set of channel variables referenced anywhere in the given texts. */
export function getUsedChannelVariables(texts: Array<string | null | undefined>): ChannelVariableKey[] {
  const joined = texts.filter(Boolean).join("\n");
  return CHANNEL_VARIABLE_KEYS.filter((key) => joined.includes(CHANNEL_VARIABLE_TOKEN[key]));
}

/**
 * Given used variables and a lookup of channel field values, returns the channel
 * variables whose target channel has not been configured yet.
 */
export function getMissingChannelVariables(
  texts: Array<string | null | undefined>,
  channelValues: Partial<Record<ChannelFieldId, string | undefined>>
): ChannelVariableKey[] {
  return getUsedChannelVariables(texts).filter((key) => {
    const fieldId = CHANNEL_VARIABLE_FIELD[key];
    return !channelValues[fieldId];
  });
}
