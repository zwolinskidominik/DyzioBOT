const debounceMap: Map<string, NodeJS.Timeout> = new Map();

export function debounce(guildId: string, func: () => void, delay: number = 2000): void {
  if (debounceMap.has(guildId)) {
    clearTimeout(debounceMap.get(guildId)!);
  }
  const timeout = setTimeout(() => {
    func();
    debounceMap.delete(guildId);
  }, delay);
  debounceMap.set(guildId, timeout);
}
