const debounceMap = new Map<string, NodeJS.Timeout>();
export function debounce(key: string, fn: () => void, delay = 2000): void {
  const existing = debounceMap.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    try {
      fn();
    } finally {
      debounceMap.delete(key);
    }
  }, delay);
  debounceMap.set(key, t);
}

const lastCallMap = new Map<string, number>();
export function tryAcquireCooldown(key: string, interval = 2000): boolean {
  const now = Date.now();
  const last = lastCallMap.get(key);
  if (last !== undefined && now - last < interval) return false;
  lastCallMap.set(key, now);
  return true;
}
