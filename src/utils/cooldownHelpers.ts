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

interface ThrottleState {
  last: number;
  timeout?: NodeJS.Timeout;
  trailingArgs?: unknown[];
}
const throttleMap = new Map<string, ThrottleState>();
export function throttle(
  key: string,
  fn: (...args: any[]) => void,
  interval = 2000,
  options: { leading?: boolean; trailing?: boolean } = { leading: true, trailing: true }
) {
  const now = Date.now();
  let state = throttleMap.get(key);
  if (!state) {
    state = { last: 0 };
    throttleMap.set(key, state);
  }
  const elapsed = now - state.last;

  const invoke = (args: unknown[]) => {
    state!.last = Date.now();
    fn(...(args as any));
  };

  if (elapsed >= interval) {
    if (options.leading !== false) invoke([]);
    else state.last = now;
  } else if (options.trailing !== false) {
    state.trailingArgs = [];
    if (!state.timeout) {
      const remaining = interval - elapsed;
      state.timeout = setTimeout(() => {
        state!.timeout = undefined;
        if (state!.trailingArgs) invoke(state!.trailingArgs);
        state!.trailingArgs = undefined;
      }, remaining);
    }
  }
}

const lastCallMap = new Map<string, number>();
export function tryAcquireCooldown(key: string, interval = 2000): boolean {
  const now = Date.now();
  const last = lastCallMap.get(key);
  if (last !== undefined && now - last < interval) return false;
  lastCallMap.set(key, now);
  return true;
}
