import { EventEmitter } from 'events';
import { Client, GuildMember, VoiceState, Message, User, GuildChannel, Guild } from 'discord.js';
import logger from '../../../src/utils/logger';

/**
 * EventHarness - Narzędzie do symulacji zdarzeń Discord dla testów integracyjnych
 * 
 * Umożliwia:
 * - Emitowanie zdarzeń Discord w kontrolowany sposób
 * - Asynchroniczne oczekiwanie na przetworzenie zdarzeń
 * - Śledzenie wywołanych event handlerów
 * - Mockowanie czasów i kolejności zdarzeń
 */
export class EventHarness extends EventEmitter {
  private static instance: EventHarness | null = null;
  private client: Client | null = null;
  private eventTracker: Map<string, number> = new Map();
  private readonly eventQueue: Array<{ event: string; data: any[]; timestamp: number }> = [];
  private processingEvents = false;

  private constructor() {
    super();
    this.setMaxListeners(100); // Zwiększamy limit dla testów
  }

  /**
   * Singleton pattern - jeden harness dla całej sesji testowej
   */
  public static getInstance(): EventHarness {
    if (!EventHarness.instance) {
      EventHarness.instance = new EventHarness();
    }
    return EventHarness.instance;
  }

  /**
   * Resetuje harness do stanu początkowego
   */
  public reset(): void {
    this.removeAllListeners();
    this.eventTracker.clear();
    this.eventQueue.length = 0;
    this.processingEvents = false;
    this.client = null;
  }

  /**
   * Ustawia klienta Discord do symulacji
   */
  public setClient(client: Client): void {
    this.client = client;
  }

  /**
   * Emituje zdarzenie Discord i śledzi jego wywołanie
   */
  public async emitEvent(event: string, ...args: any[]): Promise<boolean> {
    if (!this.client) {
      throw new Error('Client nie został ustawiony. Użyj setClient() przed emitowaniem zdarzeń.');
    }

    // Śledzenie zdarzeń
    const count = this.eventTracker.get(event) || 0;
    this.eventTracker.set(event, count + 1);

    // Dodaj do kolejki
    this.eventQueue.push({
      event,
      data: args,
      timestamp: Date.now()
    });

    // Emituj na kliencie Discord
    const result = this.client.emit(event, ...args);

    // Emituj na harness dla oczekujących listenerów
    super.emit(event, ...args);
    super.emit('eventEmitted', { event, args, timestamp: Date.now() });

    // Clear the event queue after processing single event
    // Give a small delay to allow listeners to process
    setTimeout(() => {
      this.eventQueue.length = 0;
    }, 10);

    return result;
  }

  /**
   * Oczekuje na określone zdarzenie z timeoutem
   */
  public async waitFor(
    event: string,
    predicate?: (...args: any[]) => boolean,
    timeout = 5000
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeListener(event, handler);
        reject(new Error(`Timeout oczekiwania na zdarzenie '${event}' (${timeout}ms)`));
      }, timeout);

      const handler = (...args: any[]) => {
        if (!predicate || predicate(...args)) {
          clearTimeout(timeoutId);
          this.removeListener(event, handler);
          resolve(args);
        }
        // If predicate is not satisfied, keep listening for more events
      };

      // Use 'on' instead of 'once' to handle multiple events until predicate is satisfied
      this.on(event, handler);
    });
  }

  /**
   * Oczekuje na przetworzenie wszystkich zdarzeń w kolejce
   */
  public async waitForProcessing(timeout = 10000): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout oczekiwania na przetworzenie zdarzeń (${timeout}ms)`));
      }, timeout);

      const checkProcessing = () => {
        if (!this.processingEvents && this.eventQueue.length === 0) {
          clearTimeout(timeoutId);
          resolve();
        } else {
          setTimeout(checkProcessing, 50);
        }
      };

      checkProcessing();
    });
  }

  /**
   * Czyści kolejkę zdarzeń (tylko do testów)
   */
  public clearEventQueue(): void {
    this.eventQueue.length = 0;
  }

  /**
   * Zwraca liczbę wywołań określonego zdarzenia
   */
  public getEventCount(event: string): number {
    return this.eventTracker.get(event) || 0;
  }

  /**
   * Zwraca wszystkie śledzenie zdarzeń
   */
  public getEventStats(): Record<string, number> {
    return Object.fromEntries(this.eventTracker);
  }

  /**
   * Zwraca kolejkę zdarzeń
   */
  public getEventQueue(): Array<{ event: string; data: any[]; timestamp: number }> {
    return [...this.eventQueue];
  }

  /**
   * Symuluje zdarzenie gotowości bota
   */
  public async emitReady(client?: Client): Promise<void> {
    const targetClient = client || this.client;
    if (!targetClient) {
      throw new Error('Client nie został ustawiony');
    }

    await this.emitEvent('ready', targetClient);
  }

  /**
   * Symuluje dołączenie użytkownika do serwera
   */
  public async emitGuildMemberAdd(member: GuildMember): Promise<void> {
    await this.emitEvent('guildMemberAdd', member);
  }

  /**
   * Symuluje opuszczenie serwera przez użytkownika
   */
  public async emitGuildMemberRemove(member: GuildMember): Promise<void> {
    await this.emitEvent('guildMemberRemove', member);
  }

  /**
   * Symuluje aktualizację użytkownika (boost, zmiana nicku, etc.)
   */
  public async emitGuildMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    await this.emitEvent('guildMemberUpdate', oldMember, newMember);
  }

  /**
   * Symuluje zmianę stanu voice (dołączenie/opuszczenie kanału głosowego)
   */
  public async emitVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    await this.emitEvent('voiceStateUpdate', oldState, newState);
  }

  /**
   * Symuluje utworzenie wiadomości
   */
  public async emitMessageCreate(message: Message): Promise<void> {
    await this.emitEvent('messageCreate', message);
  }

  /**
   * Symuluje edycję wiadomości
   */
  public async emitMessageUpdate(oldMessage: Message | null, newMessage: Message): Promise<void> {
    await this.emitEvent('messageUpdate', oldMessage, newMessage);
  }

  /**
   * Symuluje usunięcie wiadomości
   */
  public async emitMessageDelete(message: Message): Promise<void> {
    await this.emitEvent('messageDelete', message);
  }

  /**
   * Symuluje dodanie reakcji do wiadomości
   */
  public async emitMessageReactionAdd(reaction: any, user: User): Promise<void> {
    await this.emitEvent('messageReactionAdd', reaction, user);
  }

  /**
   * Symuluje usunięcie kanału
   */
  public async emitChannelDelete(channel: GuildChannel): Promise<void> {
    await this.emitEvent('channelDelete', channel);
  }

  /**
   * Symuluje usunięcie serwera
   */
  public async emitGuildDelete(guild: Guild): Promise<void> {
    await this.emitEvent('guildDelete', guild);
  }

  /**
   * Grupowe emitowanie zdarzeń z opóźnieniami
   */
  public async emitBatch(events: Array<{
    type: string;
    args: any[];
    delay?: number;
  }>): Promise<void> {
    this.processingEvents = true;

    try {
      for (const eventData of events) {
        if (eventData.delay) {
          await new Promise(resolve => setTimeout(resolve, eventData.delay));
        }
        await this.emitEvent(eventData.type, ...eventData.args);
      }
      
      // Clear the event queue after processing all events
      this.eventQueue.length = 0;
    } finally {
      this.processingEvents = false;
    }
  }

  /**
   * Symuluje sekwencję zdarzeń użytkownika dołączającego do voice channel
   */
  public async simulateUserJoiningVoice(
    member: GuildMember,
    oldState: VoiceState,
    newState: VoiceState
  ): Promise<void> {
    await this.emitBatch([
      {
        type: 'voiceStateUpdate',
        args: [oldState, newState],
        delay: 0
      }
    ]);
  }

  /**
   * Symuluje kompletny flow nowego użytkownika
   */
  public async simulateNewUserFlow(member: GuildMember): Promise<void> {
    await this.emitBatch([
      {
        type: 'guildMemberAdd',
        args: [member],
        delay: 0
      },
      {
        type: 'guildMemberUpdate', 
        args: [member, member], // Symulacja auto-role
        delay: 100
      }
    ]);
  }

  /**
   * Symuluje flow boostowania serwera
   */
  public async simulateServerBoost(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    await this.emitBatch([
      {
        type: 'guildMemberUpdate',
        args: [oldMember, newMember],
        delay: 0
      }
    ]);
  }

  /**
   * Debugowanie - wyświetla aktywne listenery
   */
  public getActiveListeners(): Record<string, number> {
    const listeners: Record<string, number> = {};
    for (const event of this.eventNames()) {
      listeners[event.toString()] = this.listenerCount(event);
    }
    return listeners;
  }

  /**
   * Czyści listenery dla określonego zdarzenia
   */
  public clearEventListeners(event: string): void {
    this.removeAllListeners(event);
  }
}

/**
 * Factory function dla łatwego dostępu
 */
export function createEventHarness(): EventHarness {
  return EventHarness.getInstance();
}

/**
 * Helper do resetowania harness między testami
 */
export function resetEventHarness(): void {
  const harness = EventHarness.getInstance();
  harness.reset();
}

export default EventHarness;