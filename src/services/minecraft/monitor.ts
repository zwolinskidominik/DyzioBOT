import type { MinecraftConfig } from '../../config/minecraft';
import { ControlClient, type ControlResult } from './controlClient';
import { isExpectedServer, pingServer, type PingResponse } from './serverListPing';
import { deriveServerView, type ServerView } from './serverState';

/**
 * Sprawdza stan serwera z możliwie małym ruchem do usługi w Google:
 * 1. ping na ostatnio znane IP (sprawdzony MOTD i wersja),
 * 2. dopiero gdy nie odpowiada - `/status` z usługi (stan maszyny + aktualne IP) i ping na nowe IP.
 * Przy działającym serwerze usługa Cloud Run w ogóle nie jest budzona.
 */

export type PingFn = (host: string, port: number) => Promise<PingResponse | null>;

export interface MonitorSnapshot {
  view: ServerView;
  /** Aktualne IP maszyny (do pingu i RCON) - `null`, gdy maszyna nie działa albo nieznane. */
  ip: string | null;
  checkedAt: number;
}

export class MinecraftMonitor {
  private lastKnownIp: string | null = null;
  private last: MonitorSnapshot | null = null;
  private inFlight: Promise<MonitorSnapshot> | null = null;

  public constructor(
    private readonly config: Pick<MinecraftConfig, 'gamePort' | 'expectedMotd' | 'expectedVersion'>,
    public readonly control: Pick<ControlClient, 'status' | 'start'>,
    private readonly ping: PingFn = pingServer,
    private readonly now: () => number = Date.now
  ) {}

  public get snapshot(): MonitorSnapshot | null {
    return this.last;
  }

  /** Zapamiętuje IP z odpowiedzi usługi (np. po POST /start). */
  public rememberMachine(result: ControlResult): void {
    if (result.ok) this.lastKnownIp = result.data.ip;
  }

  public refresh(): Promise<MonitorSnapshot> {
    if (!this.inFlight) {
      this.inFlight = this.check().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async verifiedPing(ip: string | null): Promise<PingResponse | null> {
    if (!ip) return null;
    const response = await this.ping(ip, this.config.gamePort);
    if (!response) return null;
    // Inny serwer pod tym IP (np. IP przydzielone komuś innemu po wyłączeniu maszyny) = brak odpowiedzi.
    return isExpectedServer(response, this.config.expectedMotd, this.config.expectedVersion) ? response : null;
  }

  private async check(): Promise<MonitorSnapshot> {
    const firstIp = this.lastKnownIp;
    let ping = await this.verifiedPing(firstIp);
    let machine: ControlResult | undefined;

    if (!ping) {
      machine = await this.control.status();
      if (machine.ok) {
        this.lastKnownIp = machine.data.ip;
        if (machine.data.status === 'RUNNING' && machine.data.ip && machine.data.ip !== firstIp) {
          ping = await this.verifiedPing(machine.data.ip);
        }
      }
    }

    const snapshot: MonitorSnapshot = {
      view: deriveServerView({ ping, machine, now: this.now() }),
      ip: ping ? this.lastKnownIp : machine?.ok ? machine.data.ip : this.lastKnownIp,
      checkedAt: this.now(),
    };
    this.last = snapshot;
    return snapshot;
  }
}
