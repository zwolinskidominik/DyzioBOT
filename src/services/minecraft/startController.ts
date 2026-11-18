import type { MinecraftMonitor, MonitorSnapshot } from './monitor';
import type { ServerView } from './serverState';

/**
 * Uruchamianie serwera z przycisku „▶️ Uruchom serwer”: POST /start w usłudze, potem co 10 s
 * sprawdzanie stanu aż do gotowości (limit 5 min). Cooldown 5 min na cały serwer Discord - liczony
 * dopiero po udanym zleceniu startu (błąd usługi nie blokuje ponownej próby).
 */

export const START_COOLDOWN_MS = 5 * 60_000;
export const START_POLL_INTERVAL_MS = 10_000;
export const START_TIMEOUT_MS = 5 * 60_000;

export type StartOutcome =
  | { kind: 'ready'; view: ServerView }
  | { kind: 'timeout'; view: ServerView }
  /** Usługa nie przyjęła zlecenia (błąd, zły token) - można spróbować od razu ponownie. */
  | { kind: 'unavailable' }
  | { kind: 'cooldown'; remainingMs: number }
  | { kind: 'busy' };

export function progressText(view: ServerView): string {
  switch (view.kind) {
    case 'online':
      return '✅ Serwer gotowy - wchodźcie!';
    case 'starting':
      return view.phase === 'machine' ? '⏳ Maszyna startuje…' : '⏳ Minecraft się ładuje…';
    case 'unresponsive':
      return '⚠️ Maszyna działa, ale Minecraft nie odpowiada.';
    case 'stopping':
    case 'offline':
      return '⏳ Maszyna startuje…';
    case 'unknown':
      return '⏳ Sprawdzam stan serwera…';
  }
}

/**
 * Zaraz po zleceniu startu usługa przez kilka sekund może jeszcze widzieć maszynę jako wyłączoną -
 * w trakcie startu to po prostu „maszyna startuje”, nie 🔴.
 */
export function duringStart(snapshot: MonitorSnapshot): MonitorSnapshot {
  const { view } = snapshot;
  if (view.kind === 'offline' || view.kind === 'stopping') {
    return { ...snapshot, view: { kind: 'starting', phase: 'machine' } };
  }
  return snapshot;
}

export interface StartControllerDeps {
  now?: (() => number) | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });

export class StartController {
  private lastStartAt: number | null = null;
  private running = false;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  public constructor(
    private readonly monitor: Pick<MinecraftMonitor, 'control' | 'refresh' | 'rememberMachine'>,
    deps: StartControllerDeps = {}
  ) {
    this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? defaultSleep;
  }

  public get inProgress(): boolean {
    return this.running;
  }

  /** Ile jeszcze trwa cooldown (0 = można uruchamiać). */
  public cooldownRemaining(): number {
    if (this.lastStartAt === null) return 0;
    return Math.max(0, START_COOLDOWN_MS - (this.now() - this.lastStartAt));
  }

  /**
   * Zleca start i czeka na gotowość, raportując każdy etap przez `onProgress`.
   * `onProgress` nie może rzucać (błąd edycji wiadomości nie przerywa startu).
   */
  public async start(onProgress: (snapshot: MonitorSnapshot) => Promise<void>): Promise<StartOutcome> {
    if (this.running) return { kind: 'busy' };
    const remaining = this.cooldownRemaining();
    if (remaining > 0) return { kind: 'cooldown', remainingMs: remaining };

    this.running = true;
    try {
      const result = await this.monitor.control.start();
      if (!result.ok) return { kind: 'unavailable' };
      this.monitor.rememberMachine(result);
      this.lastStartAt = this.now();

      const deadline = this.now() + START_TIMEOUT_MS;
      let snapshot = duringStart(await this.monitor.refresh());
      while (true) {
        await onProgress(snapshot);
        if (snapshot.view.kind === 'online') return { kind: 'ready', view: snapshot.view };
        if (this.now() >= deadline) return { kind: 'timeout', view: snapshot.view };
        await this.sleep(START_POLL_INTERVAL_MS);
        snapshot = duringStart(await this.monitor.refresh());
      }
    } finally {
      this.running = false;
    }
  }
}
