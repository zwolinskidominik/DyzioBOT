import type { ControlResult } from './controlClient';
import type { PingResponse } from './serverListPing';

/**
 * Łączny stan serwera z dwóch źródeł: pingu Minecrafta (czy gra odpowiada) i usługi
 * gamezone-control (czy maszyna działa). Czyste funkcje - bez sieci, łatwe do testów.
 */

/** Minecraft milczy dłużej niż tyle od startu maszyny = problem (normalnie gotowy po 60-85 s). */
export const UNRESPONSIVE_AFTER_MS = 5 * 60_000;

export type ServerView =
  | { kind: 'online'; online: number; max: number; players: string[] }
  | { kind: 'starting'; phase: 'machine' | 'minecraft' }
  | { kind: 'unresponsive' }
  | { kind: 'stopping' }
  | { kind: 'offline' }
  /** Usługa nie odpowiedziała, a ping też nie - nie wiadomo, co się dzieje. */
  | { kind: 'unknown' };

export interface StateInput {
  /** Odpowiedź pingu, już sprawdzona (MOTD + wersja) - inny serwer pod tym IP = `null`. */
  ping: PingResponse | null;
  /** Wynik usługi; `undefined` = nie pytaliśmy (ping odpowiedział). */
  machine: ControlResult | undefined;
  now: number;
}

export function deriveServerView({ ping, machine, now }: StateInput): ServerView {
  if (ping) return { kind: 'online', online: ping.online, max: ping.max, players: ping.players };
  if (!machine || !machine.ok) return { kind: 'unknown' };

  const { status, lastStart, started } = machine.data;
  switch (status) {
    case 'RUNNING': {
      if (lastStart && now - lastStart.getTime() > UNRESPONSIVE_AFTER_MS) return { kind: 'unresponsive' };
      return { kind: 'starting', phase: 'minecraft' };
    }
    case 'PROVISIONING':
    case 'STAGING':
    case 'REPAIRING':
      return { kind: 'starting', phase: 'machine' };
    case 'STOPPING':
    case 'SUSPENDING':
      return { kind: 'stopping' };
    case 'TERMINATED':
    case 'STOPPED':
    case 'SUSPENDED':
      // Zaraz po POST /start usługa przez kilka sekund może jeszcze widzieć TERMINATED.
      return started ? { kind: 'starting', phase: 'machine' } : { kind: 'offline' };
  }
}

/** Nazwa kanału-licznika. `null` = nie zmieniaj (stan nieznany - nie mrugaj licznikiem). */
export function channelNameFor(view: ServerView): string | null {
  switch (view.kind) {
    case 'online':
      return `🟢 Online: ${view.online}/${view.max}`;
    case 'starting':
      return '🟡 Startuje…';
    case 'unresponsive':
      return '⚠️ Nie odpowiada';
    case 'stopping':
    case 'offline':
      return '🔴 Offline';
    case 'unknown':
      return null;
  }
}

/** Czy maszyna działa (lub startuje) - wtedy przycisk „Uruchom” jest nieaktywny. */
export function isMachineUp(view: ServerView): boolean {
  return view.kind === 'online' || view.kind === 'starting' || view.kind === 'unresponsive' || view.kind === 'stopping';
}
