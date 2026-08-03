export interface DiscordChannelLike {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id?: string | null;
  [key: string]: unknown;
}

export interface DiscordRoleLike {
  id: string;
  name: string;
  position: number;
  color?: number;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDiscordChannelLike(value: unknown): value is DiscordChannelLike {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.type === "number" &&
    typeof value.position === "number"
  );
}

function isDiscordRoleLike(value: unknown): value is DiscordRoleLike {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.position === "number"
  );
}

export function sortDiscordChannels<T extends DiscordChannelLike>(channels: readonly T[]): T[] {
  const categoryPositions = new Map<string, number>();

  for (const channel of channels) {
    if (channel.type === 4) {
      categoryPositions.set(channel.id, channel.position);
    }
  }

  const groupPosition = (channel: T) => {
    if (channel.parent_id) {
      return categoryPositions.get(channel.parent_id) ?? channel.position;
    }

    return channel.position;
  };

  return [...channels].sort((a, b) => {
    const groupDiff = groupPosition(a) - groupPosition(b);
    if (groupDiff !== 0) return groupDiff;

    const positionDiff = a.position - b.position;
    if (positionDiff !== 0) return positionDiff;

    const typeDiff = a.type - b.type;
    if (typeDiff !== 0) return typeDiff;

    return a.name.localeCompare(b.name, "pl");
  });
}

export function sortDiscordRoles<T extends DiscordRoleLike>(roles: readonly T[]): T[] {
  return [...roles].sort((a, b) => {
    const positionDiff = b.position - a.position;
    if (positionDiff !== 0) return positionDiff;

    return a.name.localeCompare(b.name, "pl");
  });
}

export function toSortedDiscordChannels(input: unknown): DiscordChannelLike[] {
  if (!Array.isArray(input)) return [];
  return sortDiscordChannels(input.filter(isDiscordChannelLike));
}

export function toSortedDiscordRoles(input: unknown): DiscordRoleLike[] {
  if (!Array.isArray(input)) return [];
  return sortDiscordRoles(input.filter(isDiscordRoleLike));
}